import { withTranslations } from "./translation";
import { isSourcePassage } from "./grounding";
import { z } from "zod";
import { pool, tx } from "./db";
import type { Item } from "./model";
import { HttpError } from "./model";
export async function claimEditor() {
  return tx(async (d) => {
    const r = await d.query(
      "SELECT * FROM editor_jobs WHERE status='pending' OR status='working' AND claimed_at<now()-interval '25 minutes' ORDER BY publish_at DESC FOR UPDATE SKIP LOCKED LIMIT 1",
    );
    const j = r.rows[0];
    if (!j) return null;
    await d.query(
      "UPDATE editor_jobs SET status='working',claimed_at=now() WHERE id=$1",
      [j.id],
    );
    return { id: j.id, ...j.payload };
  });
}
export const editorResultSchema = z.object({
  id: z.string().max(50),
  brief: z.string().min(10).max(1200),
  stories: z
    .array(
      z.object({
        id: z.string().length(64),
        summary: z.string().min(10).max(600),
      }),
    )
    .min(3)
    .max(40),
  model: z.string().max(100),
});
export async function saveEditorResult(b: z.infer<typeof editorResultSchema>) {
  return tx(async (d) => {
    const j = (
      await d.query(
        "SELECT * FROM editor_jobs WHERE id=$1 AND status='working' FOR UPDATE",
        [b.id],
      )
    ).rows[0];
    if (!j) throw new HttpError(409, "Editorial job is not active");
    const used = new Set();
    const selected: Item[] = [];
    for (const s of b.stories) {
      const original = (j.payload.items as Item[]).find((i) => i.id === s.id);
      if (!original || used.has(s.id))
        throw new HttpError(400, "Unknown or duplicate story");
      if (!isSourcePassage(s.summary, original.excerpt || original.title))
        throw new HttpError(400, "Summary must be an exact source passage");
      used.add(s.id);
      selected.push({
        ...original,
        summary: s.summary,
        summary_kind: "extractive",
      });
    }
    await withTranslations([...selected, ...j.payload.podcasts]);
    for (const i of selected)
      await d.query(
        "UPDATE items SET summary=$2,summary_kind=$3 WHERE id=$1 AND owner_id IS NULL",
        [i.id, i.summary, i.summary_kind],
      );
    await d.query(
      "INSERT INTO editions(id,publish_at,brief,data) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
      [
        j.id,
        j.publish_at,
        `The Bittrees News desk selected ${selected.length} source-linked stories across ${[...new Set(selected.map((i) => i.topic))].join(", ")}. Summaries retain source wording; follow each link for the full report.`,
        JSON.stringify({
          items: [...selected, ...j.payload.podcasts],
          mode: "Bittrees · selected source excerpts",
          model: b.model,
          feedsOk: j.payload.stats.ok,
          feedsFailed: j.payload.stats.failed,
        }),
      ],
    );
    await d.query(
      "UPDATE editor_jobs SET status='done',result=$2 WHERE id=$1",
      [j.id, JSON.stringify({ model: b.model, stories: selected.length })],
    );
    await d.query(
      "UPDATE editions SET published_at=now() WHERE id=$1 AND published_at IS NULL AND publish_at<=now()",
      [j.id],
    );
    return { ok: true };
  });
}
