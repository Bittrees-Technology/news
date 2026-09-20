import {recordDiversityShadow} from "./shadow-record";
import {pool} from './db';
export async function processingSnapshot(){
 const [translations,stories,editions,collection,workers]=await Promise.all([
  pool().query("SELECT status,count(*)::int count,round(extract(epoch FROM now()-min(created_at))/60)::int oldest_minutes FROM translations GROUP BY status"),
  pool().query("SELECT CASE WHEN cid IS NOT NULL THEN 'archived' WHEN attempts>=3 THEN 'review' WHEN document IS NOT NULL THEN 'awaiting archive' WHEN claimed_at>now()-interval '30 minutes' THEN 'working' ELSE 'pending' END status,count(*)::int count FROM story_documents GROUP BY 1"),
  pool().query("SELECT id,publish_at,published_at,round(extract(epoch FROM published_at-publish_at))::int delay_seconds FROM editions WHERE published_at IS NOT NULL ORDER BY publish_at DESC LIMIT 12"),
  pool().query("SELECT updated_at,data FROM worker_state WHERE id='collection'"),
  pool().query("SELECT id,updated_at,data FROM worker_state WHERE id='news-models'")
 ]);
 return {at:new Date().toISOString(),translations:translations.rows,stories:stories.rows,editions:editions.rows,collection:collection.rows[0]||null,workers:workers.rows};
}
export async function recordProcessingSample(){
 await recordDiversityShadow();
 const snapshot=await processingSnapshot();
 await pool().query("INSERT INTO processing_samples(bucket,data) VALUES(to_timestamp(floor(extract(epoch FROM now())/300)*300),$1) ON CONFLICT(bucket) DO UPDATE SET data=EXCLUDED.data",[JSON.stringify(snapshot)]);
 await pool().query("DELETE FROM processing_samples WHERE bucket<now()-interval '30 days'");
 return snapshot;
}
