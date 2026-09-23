import {unstable_cache} from "next/cache";
import {rankingColumns} from "./ranking-projection";
import {recentUniqueStories} from './recent-stories';
import {communityAdjustment} from "./feedback";
import { pool } from "./db";
import {
  defaultRanking,
  rankingSchema,
  rankArticles,
  scoreVersion,
  type RankingProfile,
} from "./scoring";
import { defaults, preferencesSchema, selectItems, type Item } from "./model";
import { sources } from "./catalog";
export async function sourceScores(accountId?: string) {
  const rows = (
    await pool().query(
      "SELECT id,status,checked_at FROM sources UNION ALL SELECT 'private:'||id::text,status,checked_at FROM connections WHERE account_id=$1",
      [accountId || null],
    )
  ).rows;
  await pool().query(
    "INSERT INTO source_observations(source_id,observed_at,status) SELECT 'private:'||id::text,checked_at,status FROM connections WHERE account_id=$1 AND checked_at IS NOT NULL ON CONFLICT DO NOTHING",
    [accountId || null],
  );
  const history = (
    await pool().query(
      "SELECT source_id,count(*)::int samples,round(100.0*count(*) FILTER(WHERE status='healthy')/count(*),1)::float score FROM source_observations WHERE observed_at>now()-interval '30 days' AND source_id=ANY($1::text[]) GROUP BY source_id",
      [rows.map((r) => r.id)],
    )
  ).rows;
  const feedback=(await pool().query("SELECT source_id,count(*)::int voters,sum(vote)::float total FROM (SELECT i.source_id,f.account_id,avg(f.value)::float vote FROM article_feedback f JOIN items i ON i.id=f.item_id WHERE f.updated_at>now()-interval '90 days' AND i.source_id=ANY($1::text[]) AND (i.owner_id IS NULL OR i.owner_id=$2) GROUP BY i.source_id,f.account_id) per_reader GROUP BY source_id",[rows.map(r=>r.id),accountId||null])).rows;
  const adjustments=new Map(feedback.map(r=>[r.source_id,communityAdjustment(r.total,r.voters,10)]));
  return {
    scores: Object.fromEntries(history.map((r) => [r.source_id, Math.max(0,Math.min(100,r.score+(adjustments.get(r.source_id)||0)))])),
    observations: history,
  };
}
export async function rankedItems(
  items: Item[],
  prefs = defaults,
  profile: RankingProfile = defaultRanking,
  accountId?: string,
  limit = 100,
) {
  const { scores } = await sourceScores(accountId);
  const feedback=(await pool().query("SELECT item_id,count(*)::int voters,sum(value)::int total,sum(CASE WHEN account_id=$2 THEN value ELSE 0 END)::int own FROM article_feedback WHERE item_id=ANY($1::text[]) AND updated_at>now()-interval '90 days' GROUP BY item_id",[items.map(i=>i.id),accountId||null])).rows;
  const adjustments=Object.fromEntries(feedback.map(r=>[r.item_id,communityAdjustment(r.total,r.voters,5)+5*r.own]));
  if(accountId){
    const reading=(await pool().query("SELECT item_id,saved,is_read FROM reading WHERE account_id=$1 AND item_id=ANY($2::text[])",[accountId,items.map(i=>i.id)])).rows;
    for(const row of reading) adjustments[row.item_id]=(adjustments[row.item_id]||0)+(row.saved?3:0)-(row.is_read?1:0);
  }
  return rankArticles(
    selectItems(items, prefs, items.length),
    prefs,
    profile,
    scores,
    limit,
    new Date(),
    adjustments,
  );
}
export async function publicRanked(items: Item[]) {
  return rankedItems(items, defaults, defaultRanking, undefined, items.length);
}
export async function accountCandidates(accountId: string, publicOnly = false) {
  const account = (
    await pool().query("SELECT preferences,ranking FROM accounts WHERE id=$1", [
      accountId,
    ])
  ).rows[0];
  const items = (
    await pool().query(
      "SELECT i.*,c.summary AS curated_summary,c.excluded FROM items i LEFT JOIN article_curation c ON c.item_id=i.id AND c.account_id=$1 WHERE (i.owner_id IS NULL OR (i.owner_id=$1 AND ($2=false OR EXISTS(SELECT 1 FROM connections x WHERE 'private:'||x.id::text=i.source_id AND x.account_id=$1 AND x.share_public=true)))) AND i.published_at>now()-interval '90 days' ORDER BY i.published_at DESC LIMIT 3000",
      [accountId, publicOnly],
    )
  ).rows
    .filter((i) => !i.excluded)
    .map(({ curated_summary, excluded, ...i }) =>
      curated_summary
        ? { ...i, summary: curated_summary, summary_kind: "extractive" }
        : i,
    ) as Item[];
  return {
    items,
    preferences: preferencesSchema.parse(account.preferences),
    profile: rankingSchema.parse(account.ranking),
    ...(await sourceScores(accountId)),
  };
}
export async function recordHistory(
  owner: string,
  kind: string,
  entries: { id: string; name: string; score: number; samples: number }[],
  config: unknown,
) {
  if (!entries.length) return;
  await pool().query(
    `INSERT INTO ranking_history(owner_key,kind,entity_id,name,bucket,score,position,samples,config) SELECT $1,$2,x.id,x.name,date_trunc('hour',now()),x.score,rank() OVER(ORDER BY x.score DESC),x.samples,$4 FROM jsonb_to_recordset($3::jsonb) AS x(id text,name text,score numeric,samples int) ON CONFLICT(owner_key,kind,entity_id,bucket) DO UPDATE SET score=EXCLUDED.score,position=EXCLUDED.position,samples=EXCLUDED.samples,name=EXCLUDED.name,config=EXCLUDED.config`,
    [owner, kind, JSON.stringify(entries), JSON.stringify(config)],
  );
}
export async function recordPublicSources() {
  const { scores, observations } = await sourceScores();
  await recordHistory(
    "public",
    "source",
    sources
      .filter((s) => scores[s.id] !== undefined)
      .map((s) => ({
        id: s.id,
        name: s.name,
        score: scores[s.id],
        samples: observations.find((r) => r.source_id === s.id)?.samples || 0,
      })),
    {
      version: scoreVersion,
      meaning:
        "Successful collection percentage, last 30 days; not factual accuracy",
    },
  );
}
export async function historyFor(accountId: string) {
  return (
    await pool().query(
      "SELECT * FROM (SELECT DISTINCT ON(owner_key,kind,entity_id,date_trunc('day',bucket)) owner_key,kind,entity_id,name,bucket,score::float,position,samples,config FROM ranking_history WHERE (owner_key=$1 OR owner_key='public') AND bucket>now()-interval '30 days' ORDER BY owner_key,kind,entity_id,date_trunc('day',bucket),bucket DESC) daily ORDER BY bucket DESC LIMIT 20000",
      [accountId],
    )
  ).rows;
}

// Public-source candidates only. Refresh the large input set at most once per
// 15 minutes; still apply the caller's frozen window and current scoring on read.
const publicCandidates=unstable_cache(async()=>{
 return (await pool().query(`SELECT ${rankingColumns},fetched_at FROM items WHERE owner_id IS NULL AND published_at>=now()-interval '24 hours' AND published_at<=now() ORDER BY published_at DESC`)).rows;
},['public-ranking-candidates-v1'],{revalidate:900});
export async function recentPublicRanked(snapshot=new Date().toISOString()){
 const at=Date.parse(snapshot);
 const items=(await publicCandidates()).filter(i=>new Date(i.published_at).getTime()<=at && new Date(i.fetched_at).getTime()<=at && new Date(i.published_at).getTime()>=at-86400000) as Item[];
 return recentUniqueStories(await publicRanked(items),at);
}
