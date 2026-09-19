import { withTranslations } from "./translation";
import { publicRanked } from "./ranking";
import { pool, tx } from "./db";
import { sourceHealth } from "./source-health";
import { edit, diverse } from "./editor";
import type { Edition, Item } from "./model";
export function slotFor(now = new Date()) {
  const h = now.getUTCHours();
  const slot = h < 8 ? 7 : h < 12 ? 11 : 19;
  const at = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      slot,
      57,
    ),
  );
  return { id: at.toISOString().slice(0, 16), at };
}
export async function prepare(now = new Date()) {
  const slot = slotFor(now);
  const claimed = await pool().query(
    "INSERT INTO jobs(id,status) VALUES($1,'running') ON CONFLICT(id) DO UPDATE SET status='running',started_at=now() WHERE jobs.status='failed' OR jobs.status='running' AND jobs.started_at<now()-interval '10 minutes' RETURNING id",
    ["prepare:" + slot.id],
  );
  if (!claimed.rowCount) return { skipped: true };
  try {
    const health = await sourceHealth();
    const stats = {ok:health.healthy,failed:health.unavailable};
    const rows = (
      await pool().query(
        "SELECT * FROM items WHERE owner_id IS NULL AND (published_at>now()-interval '72 hours' OR kind='podcast' AND published_at>now()-interval '7 days') ORDER BY published_at DESC LIMIT 500",
      )
    ).rows as Item[];
    const articles = await publicRanked(
        rows.filter((i) => i.kind !== "podcast"),
      ),
      pods = rows
        .filter((i) => i.kind === "podcast")
        .filter(
          (i, n, a) => a.findIndex((x) => x.source_id === i.source_id) === n,
        )
        .slice(0, 24);
    if (process.env.EDITOR_WORKER === "true") {
      await pool().query(
        "INSERT INTO editor_jobs(id,publish_at,payload) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
        [
          slot.id,
          slot.at,
          JSON.stringify({
            items: articles.slice(0, 36),
            podcasts: pods,
            stats,
          }),
        ],
      );
      await pool().query(
        "UPDATE jobs SET status='done',finished_at=now(),detail=$2 WHERE id=$1",
        [
          "prepare:" + slot.id,
          JSON.stringify({ ...stats, queuedForEditor: true }),
        ],
      );
      return { id: slot.id, ...stats, queuedForEditor: true };
    }
    const result = await edit(articles);
    await withTranslations([...result.items, ...pods]);
    if (!result.items.length) throw Error("No fresh stories available");
    for (const i of result.items)
      if (i.summary)
        await pool().query(
          "UPDATE items SET summary=$2,summary_kind=$3 WHERE id=$1",
          [i.id, i.summary, i.summary_kind],
        );
    await pool().query(
      "INSERT INTO editions(id,publish_at,brief,data) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
      [
        slot.id,
        slot.at,
        result.brief,
        JSON.stringify({
          items: [...result.items, ...pods],
          mode: result.mode,
          feedsOk: stats.ok,
          feedsFailed: stats.failed,
        }),
      ],
    );
    await pool().query(
      "UPDATE jobs SET status='done',finished_at=now(),detail=$2 WHERE id=$1",
      ["prepare:" + slot.id, JSON.stringify(stats)],
    );
    return { id: slot.id, ...stats, mode: result.mode };
  } catch (e) {
    await pool().query(
      "UPDATE jobs SET status='failed',finished_at=now(),detail=$2 WHERE id=$1",
      [
        "prepare:" + slot.id,
        JSON.stringify({
          error: e instanceof Error ? e.message : "Generation failed",
        }),
      ],
    );
    throw e;
  }
}
export async function publish() {
  return tx(async (d) => {
    const r = await d.query(
      "UPDATE editions SET published_at=now() WHERE published_at IS NULL AND publish_at<=now() RETURNING id",
    );
    return { published: r.rows.map((x) => x.id) };
  });
}
export async function latestEdition(id?: string): Promise<Edition | null> {
  const r = id
    ? await pool().query(
        "SELECT * FROM editions WHERE id=$1 AND published_at IS NOT NULL",
        [id],
      )
    : await pool().query(
        "SELECT * FROM editions WHERE published_at IS NOT NULL ORDER BY publish_at DESC LIMIT 1",
      );
  return r.rows[0] || null;
}
