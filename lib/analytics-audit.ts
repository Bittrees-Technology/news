import {engagementMetrics} from "./engagement";
import { pool } from './db';
import { sources } from './catalog';
export async function analyticsAudit() {
 const [coverage, recent, feedback, deliveries, availability, shadow, engagement, transport, deliveryEvents, smtp] = await Promise.all([
  pool().query(`SELECT count(*)::int total,count(*) FILTER(WHERE i.kind='article')::int articles,count(*) FILTER(WHERE i.kind='podcast')::int podcasts,count(*) FILTER(WHERE i.kind='data')::int data,count(*) FILTER(WHERE s.document IS NOT NULL)::int briefings,count(*) FILTER(WHERE s.cid IS NOT NULL)::int archived FROM items i LEFT JOIN story_documents s ON s.item_id=i.id WHERE i.owner_id IS NULL`),
  pool().query(`SELECT source_id,count(*)::int items FROM items WHERE owner_id IS NULL AND published_at>now()-interval '24 hours' AND published_at<=now() GROUP BY source_id ORDER BY items DESC,source_id`),
  pool().query(`SELECT count(*)::int votes,count(DISTINCT f.account_id)::int voters FROM article_feedback f JOIN items i ON i.id=f.item_id WHERE i.owner_id IS NULL AND f.updated_at>now()-interval '30 days'`),
  pool().query(`SELECT status,count(*)::int count FROM deliveries WHERE created_at>now()-interval '7 days' GROUP BY status`),
  pool().query(`SELECT source_id,count(*)::int samples,round(100.0*count(*) FILTER(WHERE status='healthy')/count(*),1)::float availability FROM source_observations WHERE observed_at>now()-interval '30 days' GROUP BY source_id ORDER BY samples DESC LIMIT 150`),
  pool().query("SELECT count(*)::int editions,min(recorded_at) started_at,max(recorded_at) latest_at FROM diversity_shadows"),
  engagementMetrics(),
  pool().query("SELECT sum(transferred_bytes)::float bytes,sum(conditional_hits)::int not_modified,sum(completed_checks)::int checks,sum(collected_items)::int parsed_items FROM sources"),
  pool().query("SELECT status,count(*)::int count FROM (SELECT DISTINCT ON (provider_id) status FROM delivery_events WHERE provider_id IN (SELECT provider_id FROM deliveries WHERE provider_id IS NOT NULL) AND occurred_at>now()-interval '7 days' ORDER BY provider_id,occurred_at DESC,received_at DESC) last_events GROUP BY status"),
  pool().query("SELECT updated_at,data->'smtp_local' local,data->'smtp_public_route' public_route FROM worker_state WHERE id='news-models'")
 ]);
 const total=recent.rows.reduce((n,r)=>n+r.items,0);
 return {at:new Date().toISOString(),catalogSize:sources.length,shadow:shadow.rows[0],engagement,deliveryEvents:deliveryEvents.rows,smtp:smtp.rows[0]||null,webhookConfigured:!!process.env.RESEND_WEBHOOK_SECRET,transport:transport.rows[0],availability:availability.rows.filter(r=>sources.some(s=>s.id===r.source_id)),coverage:coverage.rows[0],recent:{hours:24,total,activeSources:recent.rows.length,topSourceShare:total?recent.rows[0].items/total:null,sources:recent.rows.slice(0,10)},feedback:{days:30,...feedback.rows[0]},deliveries:{days:7,statuses:deliveries.rows}};
}
