import { pool } from './db';
import { sources } from './catalog';
export async function analyticsAudit() {
 const [coverage, recent, feedback, deliveries] = await Promise.all([
  pool().query(`SELECT count(*)::int total,count(*) FILTER(WHERE i.kind='article')::int articles,count(*) FILTER(WHERE i.kind='podcast')::int podcasts,count(*) FILTER(WHERE i.kind='data')::int data,count(*) FILTER(WHERE s.document IS NOT NULL)::int briefings,count(*) FILTER(WHERE s.cid IS NOT NULL)::int archived FROM items i LEFT JOIN story_documents s ON s.item_id=i.id WHERE i.owner_id IS NULL`),
  pool().query(`SELECT source_id,count(*)::int items FROM items WHERE owner_id IS NULL AND published_at>now()-interval '24 hours' AND published_at<=now() GROUP BY source_id ORDER BY items DESC,source_id`),
  pool().query(`SELECT count(*)::int votes,count(DISTINCT f.account_id)::int voters FROM article_feedback f JOIN items i ON i.id=f.item_id WHERE i.owner_id IS NULL AND f.updated_at>now()-interval '30 days'`),
  pool().query(`SELECT status,count(*)::int count FROM deliveries WHERE created_at>now()-interval '7 days' GROUP BY status`)
 ]);
 const total=recent.rows.reduce((n,r)=>n+r.items,0);
 return {at:new Date().toISOString(),catalogSize:sources.length,coverage:coverage.rows[0],recent:{hours:24,total,activeSources:recent.rows.length,topSourceShare:total?recent.rows[0].items/total:null,sources:recent.rows.slice(0,10)},feedback:{days:30,...feedback.rows[0]},deliveries:{days:7,statuses:deliveries.rows}};
}
