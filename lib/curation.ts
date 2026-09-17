import { z } from "zod";
import { randomUUID } from "node:crypto";
import { pool, tx } from "./db";
import { fetchSource, storeItems } from "./collect";
import { HttpError, preferencesSchema, selectItems, type Item } from "./model";
import { rankArticles, scoreVersion } from "./scoring";
import {
  accountCandidates,
  recordHistory,
  recordPublicSources,
} from "./ranking";
import { topics } from "./catalog";
export const sourceInput = z.object({
  name: z.string().trim().min(1).max(100),
  url: z.url().max(2000),
  topic: z.string().max(60),
});
export async function addPersonalSource(accountId: string, input: unknown) {
  const b = sourceInput.parse(input);
  if (!topics.includes(b.topic))
    throw new HttpError(400, "Choose a listed topic.");
  const id = randomUUID();
  const items = await fetchSource(
    {
      id: "private:" + id,
      ...b,
      homepage: b.url,
      kind: "rss",
      type: "article",
    },
    accountId,
  );
  await tx(async (d) => {
    await d.query("SELECT id FROM accounts WHERE id=$1 FOR UPDATE", [
      accountId,
    ]);
    if (
      Number(
        (
          await d.query(
            "SELECT count(*) FROM connections WHERE account_id=$1",
            [accountId],
          )
        ).rows[0].count,
      ) >= 10
    )
      throw new HttpError(400, "You can connect up to ten personal sources.");
    await d.query(
      "INSERT INTO connections(id,account_id,name,url,topic,status,checked_at) VALUES($1,$2,$3,$4,$5,'healthy',now())",
      [id, accountId, b.name, b.url, b.topic],
    );
  });
  await storeItems(items);
  return { id, items: items.length };
}
export async function refreshPersonalSource(accountId: string, id: string) {
  const c = (
    await pool().query(
      "SELECT * FROM connections WHERE account_id=$1 AND id=$2",
      [accountId, id],
    )
  ).rows[0];
  if (!c) throw new HttpError(404, "Source not found");
  try {
    const items = await fetchSource(
      {
        id: "private:" + c.id,
        name: c.name,
        url: c.url,
        homepage: c.url,
        topic: c.topic,
        kind: "rss",
        type: "article",
      },
      accountId,
    );
    await storeItems(items);
    await pool().query(
      "UPDATE connections SET status='healthy',error=NULL,checked_at=now() WHERE id=$1 AND account_id=$2",
      [id, accountId],
    );
    return { items: items.length };
  } catch (e) {
    await pool().query(
      "UPDATE connections SET status='unavailable',error='Source refresh failed',checked_at=now() WHERE id=$1 AND account_id=$2",
      [id, accountId],
    );
    throw e;
  }
}
export async function buildPersonalEdition(
  accountId: string,
  publicOnly = false,
) {
  const c = await accountCandidates(accountId, publicOnly);
  const feeds = (
    await pool().query(
      "SELECT id,name,slug,preferences FROM newspaper_feeds WHERE account_id=$1 ORDER BY created_at",
      [accountId],
    )
  ).rows;
  const rank = (prefs: unknown) => {
    const p = preferencesSchema.parse(prefs);
    return rankArticles(
      selectItems(c.items, p, c.items.length),
      p,
      c.profile,
      c.scores,
      p.length,
    ).map(({ owner_id, ...i }) => i);
  };
  return {
    front: rank(c.preferences),
    feeds: feeds.map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      items: rank(f.preferences),
    })),
    profile: c.profile,
    builtAt: new Date().toISOString(),
  };
}
const avg = (items: Item[]) =>
  items.length
    ? Math.round(
        (10 * items.reduce((s, i) => s + (i.ranking?.value || 0), 0)) /
          items.length,
      ) / 10
    : 0;
export async function recordPersonalRankings(accountId: string) {
  const p = (
    await pool().query("SELECT * FROM newspapers WHERE account_id=$1", [
      accountId,
    ])
  ).rows[0];
  if (!p) return;
  const draft: Awaited<ReturnType<typeof buildPersonalEdition>> =
    p.published && p.snapshot
      ? p.snapshot
      : await buildPersonalEdition(accountId, p.published);
  await recordHistory(
    accountId,
    "newspaper",
    [
      {
        id: p.slug,
        name: p.name,
        score: avg(draft.front),
        samples: draft.front.length,
      },
    ],
    {
      version: scoreVersion,
      profile: draft.profile,
      visibility: p.published ? "public" : "private",
    },
  );
  await recordHistory(
    accountId,
    "feed",
    draft.feeds.map((f) => ({
      id: p.slug + "/" + f.slug,
      name: f.name,
      score: avg(f.items),
      samples: f.items.length,
    })),
    {
      version: scoreVersion,
      profile: draft.profile,
      visibility: p.published ? "public" : "private",
    },
  );
  const c = await accountCandidates(accountId);
  const names = (
    await pool().query("SELECT id,name FROM connections WHERE account_id=$1", [
      accountId,
    ])
  ).rows;
  await recordHistory(
    accountId,
    "source",
    names
      .filter((n) => c.scores["private:" + n.id] !== undefined)
      .map((n) => ({
        id: "private:" + n.id,
        name: n.name,
        score: c.scores["private:" + n.id],
        samples:
          c.observations.find((o) => o.source_id === "private:" + n.id)
            ?.samples || 0,
      })),
    {
      version: scoreVersion,
      meaning: "Successful collection percentage, last 30 days",
    },
  );
  return draft;
}
export function nextPublication(cadence: string, now = new Date()) {
  if (cadence === "hourly")
    return new Date(Math.floor(now.getTime() / 3600000) * 3600000 + 3600000);
  for (let day = 0; day < 2; day++)
    for (const h of cadence === "three_daily" ? [7, 11, 19] : [11]) {
      const at = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + day,
          h,
          57,
        ),
      );
      if (at > now) return at;
    }
  throw Error("No publication slot");
}
export async function publishPersonal(accountId: string, automatic = false) {
  const before = (
    await pool().query("SELECT * FROM newspapers WHERE account_id=$1", [
      accountId,
    ])
  ).rows[0];
  if (!before) throw new HttpError(404, "Name your newspaper first.");
  if (
    automatic &&
    (!before.auto_publish ||
      (before.next_publish_at && new Date(before.next_publish_at) > new Date()))
  )
    return { skipped: true };
  const edition = await buildPersonalEdition(accountId, true);
  if (!edition.front.length)
    throw new HttpError(
      409,
      "No eligible public stories match your filters. The previous edition is retained.",
    );
  const result = await pool().query(
    "WITH published AS (UPDATE newspapers SET snapshot=$2,published=true,last_published_at=now(),publish_error=NULL,next_publish_at=$3 WHERE account_id=$1 AND publication_version=$4 AND ($5=false OR (auto_publish=true AND (next_publish_at IS NULL OR next_publish_at<=now()))) RETURNING account_id) INSERT INTO newspaper_editions(account_id,snapshot) SELECT account_id,$2 FROM published RETURNING id",
    [
      accountId,
      JSON.stringify(edition),
      before.auto_publish ? nextPublication(before.auto_cadence) : null,
      before.publication_version,
      automatic,
    ],
  );
  if (!result.rowCount)
    throw new HttpError(409, "Publication settings changed. Please retry.");
  await recordPersonalRankings(accountId);
  return { published: true, stories: edition.front.length };
}
export async function personalScheduler() {
  await recordPublicSources();
  let processed = 0;
  const deadline = Date.now() + 230000;
  while (processed < 50 && Date.now() < deadline) {
    const a = await tx(async (d) => {
      const r = (
        await d.query(
          "SELECT a.id FROM accounts a JOIN newspapers n ON n.account_id=a.id WHERE (a.curation_lease_until IS NULL OR a.curation_lease_until<now()) AND (a.next_curation_at<=now() OR (n.auto_publish=true AND n.next_publish_at<=now())) ORDER BY a.next_curation_at FOR UPDATE OF a SKIP LOCKED LIMIT 1",
        )
      ).rows[0];
      if (r)
        await d.query(
          "UPDATE accounts SET next_curation_at=now()+interval '1 hour',curation_lease_until=now()+interval '5 minutes' WHERE id=$1",
          [r.id],
        );
      return r;
    });
    if (!a) break;
    try {
      const connections = (
        await pool().query(
          "SELECT id FROM connections WHERE account_id=$1 AND (checked_at IS NULL OR checked_at<now()-interval '1 hour') ORDER BY checked_at NULLS FIRST LIMIT 3",
          [a.id],
        )
      ).rows;
      for (const c of connections)
        await refreshPersonalSource(a.id, c.id).catch(() => {});
      await recordPersonalRankings(a.id);
      const p = (
        await pool().query(
          "SELECT auto_publish,next_publish_at FROM newspapers WHERE account_id=$1",
          [a.id],
        )
      ).rows[0];
      if (
        p?.auto_publish &&
        (!p.next_publish_at || new Date(p.next_publish_at) <= new Date())
      )
        await publishPersonal(a.id, true);
    } catch {
      await pool().query(
        "UPDATE newspapers SET publish_error='Refresh failed; the previous edition is retained.',next_publish_at=CASE WHEN auto_publish THEN now()+interval '1 hour' ELSE NULL END WHERE account_id=$1",
        [a.id],
      );
    }
    await pool().query(
      "UPDATE accounts SET curation_lease_until=NULL WHERE id=$1",
      [a.id],
    );
    processed++;
  }
  // Relative positions compare only newspapers/feeds that owners have published. Private histories never enter this list.
  for (const kind of ["newspaper", "feed"]) {
    const entries = (
      await pool().query(
        "SELECT DISTINCT ON(h.entity_id) h.entity_id id,h.name,h.score::float score,h.samples FROM ranking_history h JOIN newspapers n ON n.account_id::text=h.owner_key WHERE n.published=true AND h.config->>'visibility'='public' AND h.kind=$1 AND h.bucket>now()-interval '1 day' ORDER BY h.entity_id,h.bucket DESC",
        [kind],
      )
    ).rows;
    await recordHistory("public", kind, entries, {
      version: scoreVersion,
      meaning:
        "Mean selected article score; publishers may use different weights. Not a factual-accuracy league table.",
    });
  }
  await pool().query(
    "DELETE FROM ranking_history WHERE bucket<now()-interval '90 days'",
  );
  await pool().query(
    "DELETE FROM source_observations WHERE observed_at<now()-interval '35 days'",
  );
  return { processed };
}

export async function changeSourceSharing(
  accountId: string,
  id: string,
  share: boolean,
  remove = false,
) {
  return tx(async (d) => {
    const owned = await d.query(
      "SELECT id FROM connections WHERE id=$1 AND account_id=$2 FOR UPDATE",
      [id, accountId],
    );
    if (!owned.rowCount) throw new HttpError(404, "Source not found");
    const row = (
      await d.query(
        "SELECT snapshot FROM newspapers WHERE account_id=$1 FOR UPDATE",
        [accountId],
      )
    ).rows[0];
    let snapshot = row?.snapshot;
    if (snapshot && !share) {
      const keep = (i: Item) => i.source_id !== "private:" + id;
      snapshot = {
        ...snapshot,
        front: snapshot.front.filter(keep),
        feeds: snapshot.feeds.map((f: { items: Item[] }) => ({
          ...f,
          items: f.items.filter(keep),
        })),
      };
    }
    if (remove) {
      await d.query("DELETE FROM connections WHERE id=$1 AND account_id=$2", [
        id,
        accountId,
      ]);
      await d.query("DELETE FROM items WHERE source_id=$1 AND owner_id=$2", [
        "private:" + id,
        accountId,
      ]);
    } else
      await d.query(
        "UPDATE connections SET share_public=$3 WHERE id=$1 AND account_id=$2",
        [id, accountId, share],
      );
    if (row)
      await d.query(
        "UPDATE newspapers SET snapshot=$2,publication_version=publication_version+1 WHERE account_id=$1",
        [accountId, snapshot ? JSON.stringify(snapshot) : null],
      );
    return { ok: true };
  });
}
