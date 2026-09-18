import {
  buildPersonalEdition,
  nextPublication,
  publishPersonal,
} from "./curation";
import { z } from "zod";
import { pool, tx } from "./db";
import { HttpError, preferencesSchema, selectItems, type Item } from "./model";
import { sources, topics } from "./catalog";
const reserved = new Set([
  "account",
  "story",
  "rss",
  "rss.xml",
  "examples",
  "api",
  "archive",
  "saved",
  "about",
  "privacy",
  "terms",
  "unsubscribe",
  "admin",
  "login",
  "signup",
  "news",
  "tbn",
  "www",
  "assets",
  "favicon",
  "robots",
  "sitemap",
]);
const addressSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const slugSchema = addressSchema.refine(
  (s) => !reserved.has(s),
  "This address is reserved",
);
export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/, "");
}
export const newspaperSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: slugSchema,
  description: z.string().trim().max(300).default(""),
  published: z.boolean().default(false),
  auto_publish: z.boolean().default(false),
  auto_cadence: z.enum(["daily", "three_daily", "hourly"]).default("daily"),
});
export const feedSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(100),
  slug: addressSchema,
  preferences: preferencesSchema,
});
export async function validatePreferences(
  p: z.infer<typeof preferencesSchema>,
  accountId?: string,
) {
  if (p.topics.some((t) => !topics.includes(t)))
    throw new HttpError(
      400,
      "Choose a listed topic; your feed display name can be custom.",
    );
  const extra = p.sources.filter((id) => !sources.some((s) => s.id === id));
  if (!extra.length) return;
  if (!accountId || extra.some((id) => !/^private:[0-9a-f-]{36}$/i.test(id)))
    throw new HttpError(400, "Unknown source");
  const owned = (
    await pool().query(
      "SELECT 'private:'||id::text AS source_id FROM connections WHERE account_id=$1 AND 'private:'||id::text=ANY($2::text[])",
      [accountId, extra],
    )
  ).rows;
  if (extra.some((id) => !owned.some((r) => r.source_id === id)))
    throw new HttpError(400, "Source is not connected to your account");
}
export async function newspaperSettings(accountId: string) {
  const p =
    (
      await pool().query(
        "SELECT name,slug,description,published,auto_publish,auto_cadence,next_publish_at,last_published_at,publish_error FROM newspapers WHERE account_id=$1",
        [accountId],
      )
    ).rows[0] || null;
  const feeds = (
    await pool().query(
      "SELECT id,name,slug,preferences FROM newspaper_feeds WHERE account_id=$1 ORDER BY created_at",
      [accountId],
    )
  ).rows;
  return { newspaper: p, feeds };
}
export async function saveNewspaper(accountId: string, input: unknown) {
  const b = newspaperSchema.parse(input);
  const result = await tx(async (d) => {
    await d.query("SELECT id FROM accounts WHERE id=$1 FOR UPDATE", [
      accountId,
    ]);
    const existing = (
      await d.query("SELECT slug FROM newspapers WHERE account_id=$1", [
        accountId,
      ])
    ).rows[0];
    if (existing && existing.slug !== b.slug)
      throw new HttpError(
        400,
        "Your newspaper address stays fixed so existing links keep working. You can change its display name.",
      );
    const result = await d.query(
      "INSERT INTO newspapers(account_id,name,slug,description,published,auto_publish,auto_cadence,next_publish_at) VALUES($1,$2,$3,$4,false,$6,$7,$8) ON CONFLICT(account_id) DO UPDATE SET name=$2,description=$4,published=CASE WHEN $5 THEN newspapers.published ELSE false END,auto_publish=$6,auto_cadence=$7,next_publish_at=$8,publication_version=newspapers.publication_version+1,updated_at=now() RETURNING slug",
      [
        accountId,
        b.name,
        b.slug,
        b.description,
        b.published,
        b.auto_publish,
        b.auto_cadence,
        b.auto_publish ? nextPublication(b.auto_cadence) : null,
      ],
    );
    return result.rows[0];
  }).catch((e) => {
    if (e.code === "23505")
      throw new HttpError(
        409,
        "That newspaper address is already taken. Choose another.",
      );
    throw e;
  });
  if (b.published) await publishPersonal(accountId);
  return result;
}
export async function saveFeed(accountId: string, input: unknown) {
  const b = feedSchema.parse(input);
  await validatePreferences(b.preferences, accountId);
  return tx(async (d) => {
    const paper = (
      await d.query(
        "SELECT account_id FROM newspapers WHERE account_id=$1 FOR UPDATE",
        [accountId],
      )
    ).rows[0];
    if (!paper) throw new HttpError(409, "Name your newspaper first.");
    if (b.id) {
      const result = await d.query(
        "UPDATE newspaper_feeds SET name=$3,preferences=$4 WHERE id=$1 AND account_id=$2 AND slug=$5 RETURNING id",
        [b.id, accountId, b.name, JSON.stringify(b.preferences), b.slug],
      );
      if (!result.rowCount)
        throw new HttpError(404, "Feed not found or address changed.");
    } else {
      const n = (
        await d.query(
          "SELECT count(*)::int n FROM newspaper_feeds WHERE account_id=$1",
          [accountId],
        )
      ).rows[0].n;
      if (n >= 20)
        throw new HttpError(400, "You can create up to twenty feeds.");
      await d.query(
        "INSERT INTO newspaper_feeds(id,account_id,name,slug,preferences) VALUES(gen_random_uuid(),$1,$2,$3,$4)",
        [accountId, b.name, b.slug, JSON.stringify(b.preferences)],
      );
    }
    return { ok: true };
  }).catch((e) => {
    if (e.code === "23505")
      throw new HttpError(409, "That feed address is already in use.");
    throw e;
  });
}
export async function newspaperPage(
  slug: string,
  feedSlug: string | undefined,
  viewerId?: string,
) {
  const paper = (
    await pool().query(
      "SELECT n.*,a.preferences FROM newspapers n JOIN accounts a ON a.id=n.account_id WHERE n.slug=$1 AND (n.published=true OR n.account_id=$2)",
      [slug, viewerId || null],
    )
  ).rows[0];
  if (!paper) return null;
  const feeds = (
    await pool().query(
      "SELECT name,slug,preferences FROM newspaper_feeds WHERE account_id=$1 ORDER BY created_at",
      [paper.account_id],
    )
  ).rows;
  const feed = feedSlug ? feeds.find((f) => f.slug === feedSlug) : null;
  if (feedSlug && !feed) return null;
  const edition =
    paper.published && paper.snapshot
      ? paper.snapshot
      : await buildPersonalEdition(paper.account_id, paper.published);
  const selected = feedSlug
    ? edition.feeds.find((f: { slug: string }) => f.slug === feedSlug)?.items ||
      []
    : edition.front;
  return {
    name: paper.name,
    slug: paper.slug,
    description: paper.description,
    published: paper.published,
    feedName: feed?.name,
    feeds: feeds.map((f) => ({ name: f.name, slug: f.slug })),
    items: selected,
    publishedAt: paper.last_published_at,
  };
}

export const newspaperDetailsSchema = newspaperSchema.pick({
  name: true,
  slug: true,
  description: true,
});
export async function saveNewspaperDetails(accountId: string, input: unknown) {
  const b = newspaperDetailsSchema.parse(input),
    existing = await newspaperSettings(accountId);
  if (!existing.newspaper)
    return saveNewspaper(accountId, {
      ...b,
      published: false,
      auto_publish: false,
    });
  if (existing.newspaper.slug !== b.slug)
    throw new HttpError(400, "Your newspaper address cannot be changed.");
  await pool().query(
    "UPDATE newspapers SET name=$2,description=$3,updated_at=now(),publication_version=publication_version+1 WHERE account_id=$1",
    [accountId, b.name, b.description],
  );
  return newspaperSettings(accountId);
}
