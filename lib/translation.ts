import { createHash } from "node:crypto";
import { isSourcePassage } from "./grounding";
import { z } from "zod";
import { pool } from "./db";
import { HttpError, type Item } from "./model";
export const translationKey = (item: Item) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        "en-v1",
        item.id,
        item.title,
        item.summary || item.excerpt,
      ]),
    )
    .digest("hex");
export const translationResultSchema = z.object({
  key: z.string().regex(/^[a-f0-9]{64}$/),
  lease: z.uuid(),
  language: z.string().regex(/^[a-z]{2,3}$/),
  title: z.string().min(1).max(600).optional(),
  summary: z.string().max(1800).optional(),
  model: z.string().min(1).max(100),
  error: z.boolean().optional(),
  deferred: z.boolean().optional(),
});
export function translatedResult(
  b: z.infer<typeof translationResultSchema>,
  original?: { title: string; summary: string },
) {
  if (b.language === "en") return { language: "en", model: b.model };
  if (!b.title || b.summary === undefined)
    throw new HttpError(400, "Translated title and summary are required");
  if (
    original &&
    b.title.trim() === original.title.trim() &&
    b.summary.trim() === original.summary.trim()
  )
    throw new HttpError(400, "Source text was not translated");
  return {
    language: b.language,
    title: b.title,
    summary: b.summary,
    model: b.model,
  };
}
export async function translationStatus(keys: string[]) {
  if (!keys.length) return [];
  return (
    await pool().query(
      "SELECT key,status,result FROM translations WHERE key=ANY($1::text[])",
      [keys],
    )
  ).rows;
}
export async function withTranslations(items: Item[]): Promise<Item[]> {
  try {
    return await attachTranslations(items);
  } catch {
    console.warn("Translation cache unavailable; serving original source text");
    return items;
  }
}
async function attachTranslations(items: Item[]): Promise<Item[]> {
  // The public editorial worker only receives public-source text, never private curation or account data.
  const candidates = items.filter((i) => !i.owner_id);
  if (!candidates.length) return items;
  const originals = (
    await pool().query(
      "SELECT id,title,summary,excerpt FROM items WHERE id=ANY($1::text[]) AND owner_id IS NULL",
      [candidates.map((i) => i.id)],
    )
  ).rows;
  const publicItems = candidates.filter((i) => {
    const original = originals.find((o) => o.id === i.id),
      text = i.summary || i.excerpt;
    return (
      original &&
      i.title === original.title &&
      (text === (original.summary || original.excerpt) ||
        text === original.excerpt ||
        isSourcePassage(text, original.excerpt || original.title))
    );
  });
  if (!publicItems.length) return items;
  const keys = publicItems.map(translationKey);
  const rows = await translationStatus(keys);
  const found = new Map(rows.map((r) => [r.key, r]));
  if (publicItems.length)
    await pool().query(
      `INSERT INTO translations(key,payload,priority,item_published_at) SELECT key,payload,priority,item_published_at FROM jsonb_to_recordset($1::jsonb) AS x(key text,payload jsonb,priority numeric,item_published_at timestamptz) ON CONFLICT(key) DO UPDATE SET priority=EXCLUDED.priority,item_published_at=EXCLUDED.item_published_at WHERE (translations.priority,translations.item_published_at) IS DISTINCT FROM (EXCLUDED.priority,EXCLUDED.item_published_at)`,
      [
        JSON.stringify(
          publicItems.map((i) => ({
            key: translationKey(i),
            priority: i.ranking?.value || 0,
            item_published_at: i.published_at,
            payload: { title: i.title, summary: i.summary || i.excerpt },
          })),
        ),
      ],
    );
  return items.map((i) => {
    if (!publicItems.includes(i)) return i;
    const key = translationKey(i),
      row = found.get(key);
    return {
      ...i,
      translation_key: key,
      translation_status: row?.status || "pending",
      translation: row?.status === "done" ? row.result : undefined,
    };
  });
}
export async function claimTranslation() {
  // A separate outbound worker can retry a failed item without blocking an edition.
  await pool().query(
    "UPDATE translations SET status='failed' WHERE status='working' AND attempts>=3 AND claimed_at<now()-interval '40 minutes'",
  );
  const r = await pool().query(`WITH candidate AS (
    SELECT key FROM translations WHERE (status='pending' OR status='working' AND claimed_at<now()-interval '40 minutes') AND attempts<3 AND available_at<=now() ORDER BY (coalesce(item_published_at,created_at)>=now()-interval '24 hours') DESC,priority DESC,created_at DESC FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE translations t SET status='working',claimed_at=now(),lease=gen_random_uuid(),attempts=attempts+1 FROM candidate c WHERE t.key=c.key RETURNING t.key,t.lease,t.payload`);
  return r.rows[0] || null;
}
export async function saveTranslation(
  b: z.infer<typeof translationResultSchema>,
) {
  const active = (
    await pool().query(
      "SELECT payload FROM translations WHERE key=$1 AND lease=$2 AND status='working'",
      [b.key, b.lease],
    )
  ).rows[0];
  if (!active)
    throw new HttpError(409, "Translation lease is no longer active");
  if(b.deferred){
    const r=await pool().query("UPDATE translations SET status='pending',attempts=greatest(0,attempts-1),lease=NULL,claimed_at=NULL,available_at=now()+interval '30 seconds' WHERE key=$1 AND lease=$2 AND status='working' RETURNING key",[b.key,b.lease]);
    if(!r.rowCount)throw new HttpError(409,'Translation lease is no longer active');return {ok:true};
  }
  const result = b.error ? null : translatedResult(b, active.payload);
  const r = await pool().query(
    `UPDATE translations SET status=CASE WHEN $3::boolean THEN CASE WHEN attempts>=3 THEN 'failed' ELSE 'pending' END ELSE 'done' END,result=$4,completed_at=now() WHERE key=$1 AND lease=$2 AND status='working' RETURNING key`,
    [b.key, b.lease, !!b.error, result ? JSON.stringify(result) : null],
  );
  if (!r.rowCount)
    throw new HttpError(409, "Translation lease is no longer active");
  return { ok: true };
}
