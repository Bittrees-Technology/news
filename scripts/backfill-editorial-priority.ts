// Run after the new collection path is active. Each invocation reconciles at most 250 public items.
import {pool,tx} from '../lib/db';
import {editorialBase} from '../lib/editorial-priority';
import {rankingColumns} from '../lib/ranking-projection';
import {translationKey} from '../lib/translation';
import type {Item} from '../lib/model';

const checkpoint='editorial-priority-v4-backfill';
try {
 const result=await tx(async db=>{
  await db.query('INSERT INTO worker_state(id) VALUES($1) ON CONFLICT DO NOTHING',[checkpoint]);
  const state=(await db.query('SELECT data FROM worker_state WHERE id=$1 FOR UPDATE',[checkpoint])).rows[0].data;
  if(state.done) return {processed:0,done:true};
  const rows=(await db.query<Item>(`SELECT ${rankingColumns} FROM items WHERE owner_id IS NULL AND id>$1 ORDER BY id LIMIT 250 FOR SHARE`,[state.cursor||''])).rows;
  const translations=new Map<string,number>();
  const stories=rows.map(item=>{
   const priority=editorialBase(item);
   translations.set(translationKey(item),priority);
   translations.set(translationKey({...item,summary:undefined}),priority);
   return {id:item.id,priority};
  });
  await db.query(`UPDATE story_documents s SET priority=p.priority FROM jsonb_to_recordset($1::jsonb) AS p(id text,priority numeric)
   WHERE s.item_id=p.id AND s.cid IS NULL AND s.priority IS DISTINCT FROM p.priority`,[JSON.stringify(stories)]);
  await db.query(`UPDATE translations t SET priority=p.priority FROM unnest($1::text[],$2::numeric[]) AS p(key,priority)
   WHERE t.key=p.key AND t.status IN ('pending','working') AND t.priority IS DISTINCT FROM p.priority`,[[...translations.keys()],[...translations.values()]]);
  const done=rows.length<250;
  await db.query('UPDATE worker_state SET data=$2,updated_at=now() WHERE id=$1',[checkpoint,JSON.stringify({cursor:rows.at(-1)?.id||state.cursor||'',done})]);
  return {processed:rows.length,done};
 });
 console.log(JSON.stringify(result));
} finally {
 await pool().end();
}
