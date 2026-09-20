import {pool} from './db';
// Queue age is measured from known enqueue timestamps, never publisher age.
// Legacy briefing enqueue times were not recorded and remain explicitly unknown.
export async function queueHealth(){
 const [briefings,translations]=await Promise.all([
  pool().query(`SELECT 'briefing' task,count(*)::int eligible,count(*) FILTER(WHERE s.enqueued_at IS NULL)::int unknown_enqueue,round(extract(epoch FROM now()-min(s.enqueued_at))/60)::int oldest_known_minutes,count(*) FILTER(WHERE i.published_at>=now()-interval '24 hours')::int current_day FROM story_documents s JOIN items i ON i.id=s.item_id WHERE i.owner_id IS NULL AND s.cid IS NULL AND s.attempts<3 AND s.available_at<=now() AND (s.claimed_at IS NULL OR s.claimed_at<now()-interval '30 minutes')`),
  pool().query(`SELECT 'translation' task,count(*)::int eligible,0::int unknown_enqueue,round(extract(epoch FROM now()-min(created_at))/60)::int oldest_known_minutes,count(*) FILTER(WHERE coalesce(item_published_at,created_at)>=now()-interval '24 hours')::int current_day FROM translations WHERE (status='pending' OR status='working' AND claimed_at<now()-interval '40 minutes') AND attempts<3 AND available_at<=now()`)
 ]);return [...briefings.rows,...translations.rows];
}
