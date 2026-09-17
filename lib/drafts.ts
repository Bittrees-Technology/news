import { z } from "zod";
import { pool, tx } from "./db";
import { HttpError, type Item } from "./model";
import { buildPersonalEdition } from "./curation";
export const editDraftSchema = z.object({
  revision: z.number().int().min(0),
  items: z
    .array(
      z.object({
        id: z.string().length(64),
        title: z.string().trim().min(1).max(250),
        summary: z.string().trim().max(2000),
      }),
    )
    .min(1)
    .max(100),
});
export async function getDraft(accountId: string) {
  const p = (
    await pool().query(
      "SELECT name,slug,description,draft,draft_revision FROM newspapers WHERE account_id=$1",
      [accountId],
    )
  ).rows[0];
  if (!p) throw new HttpError(409, "Name and save your newspaper first.");
  return p;
}
export async function generateDraft(accountId: string) {
  const p = await getDraft(accountId),
    draft = await buildPersonalEdition(accountId);
  if (!draft.front.length)
    throw new HttpError(
      409,
      "No stories match your settings. Broaden your topics, sources or ranking filters.",
    );
  const r = await pool().query(
    "UPDATE newspapers SET draft=$2,draft_revision=draft_revision+1 WHERE account_id=$1 AND draft_revision=$3 RETURNING name,slug,description,draft,draft_revision",
    [accountId, JSON.stringify(draft), p.draft_revision],
  );
  if (!r.rowCount)
    throw new HttpError(
      409,
      "The preview changed while generating. Reload before trying again.",
    );
  return r.rows[0];
}
export async function editDraft(accountId: string, input: unknown) {
  const b = editDraftSchema.parse(input);
  if (new Set(b.items.map((i) => i.id)).size !== b.items.length)
    throw new HttpError(
      400,
      "An article can appear only once on the front page.",
    );
  return tx(async (d) => {
    const p = (
      await d.query("SELECT * FROM newspapers WHERE account_id=$1 FOR UPDATE", [
        accountId,
      ])
    ).rows[0];
    if (!p?.draft || p.draft_revision !== b.revision)
      throw new HttpError(
        409,
        "This preview has changed. Reload before saving.",
      );
    const originals = new Map<string, Item>(
      p.draft.front.map((i: Item) => [i.id, i]),
    );
    const front = b.items.map((i) => {
      const original = originals.get(i.id);
      if (!original)
        throw new HttpError(
          400,
          "Choose articles from your generated preview.",
        );
      if (
        original.title === i.title &&
        (original.summary ?? original.excerpt) === i.summary
      )
        return original;
      return {
        ...original,
        original_title: (original as any).original_title || original.title,
        title: i.title,
        summary: i.summary,
        user_edited: true,
        summary_kind: "user_edited",
      };
    });
    const draft = { ...p.draft, front, editedAt: new Date().toISOString() };
    return (
      await d.query(
        "UPDATE newspapers SET draft=$2,draft_revision=draft_revision+1 WHERE account_id=$1 RETURNING name,slug,description,draft,draft_revision",
        [accountId, JSON.stringify(draft)],
      )
    ).rows[0];
  });
}
export async function publishDraft(accountId: string, revision: number) {
  return tx(async (d) => {
    const p = (
      await d.query("SELECT * FROM newspapers WHERE account_id=$1 FOR UPDATE", [
        accountId,
      ])
    ).rows[0];
    if (!p?.draft || p.draft_revision !== revision)
      throw new HttpError(
        409,
        "The draft changed. Preview it again before publishing.",
      );
    const items: Item[] = [
      ...p.draft.front,
      ...p.draft.feeds.flatMap((f: any) => f.items),
    ];
    const allowed = new Set(
      (
        await d.query(
          "SELECT i.id FROM items i WHERE i.id=ANY($1::text[]) AND (i.owner_id IS NULL OR (i.owner_id=$2 AND EXISTS(SELECT 1 FROM connections c WHERE c.account_id=$2 AND 'private:'||c.id::text=i.source_id AND c.share_public=true)))",
          [items.map((i) => i.id), accountId],
        )
      ).rows.map((r) => r.id),
    );
    if (items.some((i) => !allowed.has(i.id)))
      throw new HttpError(
        409,
        "This preview contains private or removed source material. Approve source sharing or remove it before publishing.",
      );
    await d.query(
      "UPDATE newspapers SET snapshot=draft,published=true,last_published_at=now(),publication_version=publication_version+1,publish_error=NULL WHERE account_id=$1",
      [accountId],
    );
    await d.query(
      "INSERT INTO newspaper_editions(account_id,snapshot) VALUES($1,$2)",
      [accountId, JSON.stringify(p.draft)],
    );
    return { published: true, url: "/" + p.slug };
  });
}
