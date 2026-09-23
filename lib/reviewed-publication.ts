import { createHash } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import { tx } from "./db";
import { HttpError } from "./model";

const contract = "news-reviewed-publication-v1" as const;
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const publishReviewedSchema = z.strictObject({
  operationId: z.uuid(),
  revision: z.number().int().min(0).max(2147483646),
  publicationVersion: z.number().int().min(0).max(2147483646),
  reviewDigest: digestSchema,
  confirmed: z.literal(true),
  audience: z.literal("public"),
});
export const publicationReceiptSchema = z.strictObject({
  operationId: z.uuid(),
});
const itemShape = z
  .object({
    id: z.string().regex(/^[a-f0-9]{64}$/),
    source_id: z.string().min(1).max(256),
    url: z.url().refine((v) => {
      const u = new URL(v);
      return u.protocol === "https:" && !u.username && !u.password;
    }),
    title: z.string().min(1).max(2000),
    topic: z.string().max(100),
    kind: z.string().max(100),
    published_at: z.iso.datetime(),
    tags: z.array(z.string().max(100)).max(50).optional(),
    authors: z.array(z.string().max(200)).max(20).optional(),
    publication: z.string().max(500).optional(),
    briefing_preview: z.string().max(16000).optional(),
    original_title: z.string().max(2000).optional(),
    observation_period: z.string().max(200).nullish(),
    released_at: z.iso.datetime().nullish(),
    retrieved_at: z.iso.datetime().nullish(),
    date_basis: z.string().max(100).optional(),
    translation_key: z.string().max(512).optional(),
    translation_status: z.string().max(100).optional(),
    translation: z
      .object({
        language: z.string().max(30),
        title: z.string().max(2000).optional(),
        summary: z.string().max(16000).optional(),
        model: z.string().max(256),
      })
      .optional(),
    excerpt: z.string().max(32000),
    summary: z.string().max(16000).nullish(),
    summary_kind: z.string().max(100),
    user_edited: z.boolean().optional(),
  })
  .refine((i) =>
    i.user_edited === true
      ? i.summary_kind === "user_edited"
      : i.summary_kind !== "user_edited",
  );
const snapshotShape = z.object({
  front: z.array(itemShape).min(1).max(100),
  feeds: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string().max(100),
        slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        items: z.array(itemShape).max(100),
      }),
    )
    .max(20),
  builtAt: z.iso.datetime().optional(),
  editedAt: z.iso.datetime().optional(),
});
/** Canonical digest is a consistency check, not proof of a human decision or a new grant. */
export function canonicalPublication(value: unknown): string {
  let nodes = 0,
    bytes = 0;
  const spend = (value: string) => {
    bytes += Buffer.byteLength(value);
    if (bytes > 8 * 1024 * 1024)
      throw new HttpError(400, "Publication content exceeds review limits.");
    return value;
  };
  const visit = (v: any, depth: number): string => {
    if (++nodes > 100000 || depth > 16)
      throw new HttpError(400, "Publication content exceeds review limits.");
    if (v === null || typeof v === "string" || typeof v === "boolean")
      return spend(JSON.stringify(v));
    if (typeof v === "number" && Number.isFinite(v))
      return spend(JSON.stringify(v));
    if (Array.isArray(v)) {
      spend("[]" + ",".repeat(Math.max(0, v.length - 1)));
      return "[" + v.map((x) => visit(x, depth + 1)).join(",") + "]";
    }
    if (
      v &&
      typeof v === "object" &&
      Object.getPrototypeOf(v) === Object.prototype
    ) {
      const keys = Object.keys(v).sort();
      spend("{}" + ",".repeat(Math.max(0, keys.length - 1)));
      return (
        "{" +
        keys
          .map((k) => spend(JSON.stringify(k) + ":") + visit(v[k], depth + 1))
          .join(",") +
        "}"
      );
    }
    throw new HttpError(400, "Unsupported publication content.");
  };
  const result = visit(value, 0);
  if (Buffer.byteLength(result) > 8 * 1024 * 1024)
    throw new HttpError(400, "Publication content exceeds review limits.");
  return result;
}
const digest = (v: unknown) =>
  createHash("sha256").update(canonicalPublication(v)).digest("hex");
export function publicReviewSnapshot(raw: unknown) {
  // Source diagnostics, owner identifiers and receipt metadata are never public payload.
  canonicalPublication(raw);
  // Every object in the schema strips unknown fields, including nested translation metadata.
  const value = snapshotShape.parse(raw);
  for (const items of [value.front, ...value.feeds.map((f) => f.items)])
    if (new Set(items.map((i) => i.id)).size !== items.length)
      throw new HttpError(400, "Duplicate stories in a publication section.");
  if (new Set(value.feeds.map((f) => f.slug)).size !== value.feeds.length)
    throw new HttpError(400, "Duplicate publication feeds.");
  return value;
}
async function authority(
  d: PoolClient,
  accountId: string,
  credentialId: string,
  scope: "read" | "publish",
) {
  await d.query("SET LOCAL lock_timeout='3s'");
  await d.query("SET LOCAL statement_timeout='8s'");
  const r = await d.query(
    "SELECT id,scopes,expires_at FROM mcp_tokens WHERE id=$1 AND account_id=$2 AND expires_at>clock_timestamp() AND $3=ANY(scopes) FOR SHARE",
    [credentialId, accountId, scope],
  );
  if (!r.rowCount)
    throw new HttpError(
      403,
      "This connection no longer permits the requested operation.",
    );
  return r.rows[0];
}
async function lockedState(d: PoolClient, accountId: string, write: boolean) {
  // Match source-sharing changes: connection rows first, then newspaper, then items.
  const connections = (
    await d.query(
      "SELECT id,share_public FROM connections WHERE account_id=$1 ORDER BY id FOR SHARE",
      [accountId],
    )
  ).rows;
  const paper = (
    await d.query(
      "SELECT * FROM newspapers WHERE account_id=$1 " +
        (write ? "FOR UPDATE" : "FOR SHARE"),
      [accountId],
    )
  ).rows[0];
  if (!paper)
    throw new HttpError(
      409,
      "Create your newspaper and private preview first.",
    );
  return { connections, paper };
}
async function projection(
  d: PoolClient,
  accountId: string,
  credential: any,
  state: Awaited<ReturnType<typeof lockedState>>,
) {
  const { paper: p, connections } = state;
  if (!p.draft)
    throw new HttpError(
      409,
      "Create a private preview before reviewing publication.",
    );
  const snapshot = publicReviewSnapshot(p.draft);
  const items = [...snapshot.front, ...snapshot.feeds.flatMap((f) => f.items)];
  const records = (
    await d.query(
      "SELECT id,owner_id,source_id,url,excerpt FROM items WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE",
      [[...new Set(items.map((i) => i.id))]],
    )
  ).rows;
  const rows = new Map(records.map((r) => [r.id, r]));
  const shared = new Set(
    connections.filter((c) => c.share_public).map((c) => "private:" + c.id),
  );
  const blocked = [
    ...new Set(
      items
        .filter((i) => {
          const r = rows.get(i.id);
          return (
            !r ||
            r.source_id !== i.source_id ||
            r.url !== i.url ||
            r.excerpt !== i.excerpt ||
            (r.owner_id === null
              ? r.source_id.startsWith("private:")
              : r.owner_id !== accountId || !shared.has(r.source_id))
          );
        })
        .map((i) => i.id),
    ),
  ];
  const navigation = (
    await d.query(
      "SELECT name,slug FROM newspaper_feeds WHERE account_id=$1 ORDER BY created_at,id FOR SHARE",
      [accountId],
    )
  ).rows;
  if (snapshot.feeds.some((f) => !navigation.some((n) => n.slug === f.slug)))
    throw new HttpError(
      409,
      "A preview feed was removed. Regenerate the preview in News.",
    );
  const content = z
    .object({
      name: z.string().min(1).max(100),
      slug: z
        .string()
        .max(60)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      description: z.string().max(300),
      navigation: z
        .array(
          z.object({
            name: z.string().max(100),
            slug: z
              .string()
              .max(60)
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          }),
        )
        .max(20),
      snapshot: snapshotShape,
    })
    .parse({
      name: p.name,
      slug: p.slug,
      description: p.description,
      navigation,
      snapshot,
    });
  const prior = {
    published: p.published,
    lastPublishedAt: p.last_published_at?.toISOString() ?? null,
    snapshotDigest: p.snapshot ? digest(p.snapshot) : null,
  };
  const reviewDigest = digest({
    contract,
    accountId,
    credentialId: credential.id,
    scopes: [...credential.scopes].sort(),
    expiresAt: credential.expires_at.toISOString(),
    revision: p.draft_revision,
    publicationVersion: p.publication_version,
    prior,
    content,
    blocked,
  });
  return {
    contractVersion: contract,
    revision: p.draft_revision,
    publicationVersion: p.publication_version,
    reviewDigest,
    url: "https://news.bittrees.org/" + encodeURIComponent(p.slug),
    content,
    eligibility: { eligible: blocked.length === 0, blockedItemIds: blocked },
    previousPublication: prior,
    observedAt: new Date().toISOString(),
  };
}
export async function getPublicationReview(
  accountId: string,
  credentialId: string,
) {
  return tx(async (d) => {
    const credential = await authority(d, accountId, credentialId, "read");
    return projection(
      d,
      accountId,
      credential,
      await lockedState(d, accountId, false),
    );
  });
}
const receiptShape = z.strictObject({
  contractVersion: z.literal(contract),
  operationId: z.uuid(),
  reviewDigest: digestSchema,
  revision: z.number().int().min(0),
  publicationVersion: z.number().int().min(1),
  url: z.string().startsWith("https://news.bittrees.org/"),
  committedAt: z.iso.datetime(),
  status: z.literal("published"),
  historical: z.literal(true),
});
function receiptFrom(row: any) {
  const parsed = receiptShape.safeParse(row?.snapshot?._companionPublication);
  if (
    !parsed.success ||
    parsed.data.operationId !== row.id ||
    parsed.data.committedAt !== row.published_at.toISOString()
  )
    return null;
  return parsed.data;
}
export async function getPublicationReceipt(
  accountId: string,
  credentialId: string,
  input: unknown,
) {
  const b = publicationReceiptSchema.parse(input);
  return tx(async (d) => {
    await authority(d, accountId, credentialId, "read");
    const row = (
      await d.query(
        "SELECT id,published_at,snapshot FROM newspaper_editions WHERE id=$1 AND account_id=$2",
        [b.operationId, accountId],
      )
    ).rows[0];
    return { contractVersion: contract, receipt: receiptFrom(row) };
  });
}
export async function publishReviewed(
  accountId: string,
  credentialId: string,
  input: unknown,
) {
  const b = publishReviewedSchema.parse(input);
  return tx(async (d) => {
    const credential = await authority(d, accountId, credentialId, "publish");
    const state = await lockedState(d, accountId, true);
    const existing = (
      await d.query(
        "SELECT id,published_at,snapshot FROM newspaper_editions WHERE id=$1 AND account_id=$2",
        [b.operationId, accountId],
      )
    ).rows[0];
    if (existing) {
      const receipt = receiptFrom(existing);
      if (
        !receipt ||
        receipt.reviewDigest !== b.reviewDigest ||
        receipt.revision !== b.revision ||
        receipt.publicationVersion !== b.publicationVersion + 1
      )
        throw new HttpError(
          409,
          "This operation ID belongs to a different publication.",
        );
      return receipt; // Historical receipt only: never republish or restore a subsequently hidden edition.
    }
    const review = await projection(d, accountId, credential, state);
    if (
      review.revision !== b.revision ||
      review.publicationVersion !== b.publicationVersion ||
      review.reviewDigest !== b.reviewDigest
    )
      throw new HttpError(
        409,
        "Publication content or permissions changed. Review again.",
      );
    if (!review.eligibility.eligible)
      throw new HttpError(
        409,
        "Private, removed or changed source material cannot be published. Update the preview or source sharing in News.",
      );
    // Use the database clock immediately before writing; authority rows remain locked through commit.
    if (
      !(
        await d.query(
          "SELECT 1 FROM mcp_tokens WHERE id=$1 AND expires_at>clock_timestamp()",
          [credentialId],
        )
      ).rowCount
    )
      throw new HttpError(403, "This connection expired before publication.");
    const committedAt = (
      await d.query("SELECT clock_timestamp() AS time")
    ).rows[0].time.toISOString();
    const receipt = receiptShape.parse({
      contractVersion: contract,
      operationId: b.operationId,
      reviewDigest: b.reviewDigest,
      revision: b.revision,
      publicationVersion: b.publicationVersion + 1,
      url: review.url,
      committedAt,
      status: "published",
      historical: true,
    });
    // Reuse the existing edition ID as the durable operation key. Metadata is kept only in the private edition history, never in the public snapshot.
    await d.query(
      "INSERT INTO newspaper_editions(id,account_id,published_at,snapshot) VALUES($1,$2,$3,$4)",
      [
        b.operationId,
        accountId,
        committedAt,
        JSON.stringify({
          ...review.content.snapshot,
          _companionPublication: receipt,
        }),
      ],
    );
    const updated = await d.query(
      "UPDATE newspapers SET snapshot=$2,published=true,last_published_at=$3,publication_version=publication_version+1,publish_error=NULL WHERE account_id=$1 AND EXISTS(SELECT 1 FROM mcp_tokens WHERE id=$4 AND expires_at>clock_timestamp()) RETURNING account_id",
      [
        accountId,
        JSON.stringify(review.content.snapshot),
        committedAt,
        credentialId,
      ],
    );
    if (!updated.rowCount)
      throw new HttpError(403, "This connection expired before publication.");
    return receipt;
  });
}
