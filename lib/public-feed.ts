import {sources} from './catalog';
import {publisherFamily} from './diversity-shadow';
import {pool} from './db';
import type {Item} from './model';
import {translationKey,translationStatus} from './translation';
export type FeedCategory='all'|'news'|'podcasts'|'data';
export type FeedPage={next:string|null;snapshot:string;leadIds:string[];balanced?:boolean};
export async function feedDisplay(items:Item[]){
 const found=new Map((await translationStatus(items.map(translationKey))).map(row=>[row.key,row]));
 // Explicit projection: no source body, model payload or account data in the feed.
 return items.map(i=>{
  const key=translationKey(i),row=found.get(key);
  return {id:i.id,source_id:i.source_id,topic:i.topic,tags:i.tags,kind:i.kind,title:i.title,url:i.url,excerpt:i.excerpt,summary:i.summary,summary_kind:i.summary_kind,published_at:i.published_at,observation_period:i.observation_period,translation_status:row?.status||'pending',translation:row?.status==='done'?row.result:undefined};
 });
}
export async function publicFeedBatch(snapshot:string,before:string|null=null,category:FeedCategory='all',balanced=false){
 const families=Object.fromEntries(sources.map(s=>[s.id,publisherFamily({source_id:s.id})]));
 // Apply publisher selection to the frozen window BEFORE the cursor, so a new
 // page cannot reset a publisher's allowance. This changes presentation, not scores.
 const rows=(await pool().query(`WITH candidates AS (
 SELECT id,published_at,kind,row_number() OVER(PARTITION BY coalesce($5::jsonb->>source_id,source_id),date_trunc('hour',published_at AT TIME ZONE 'UTC'),kind ORDER BY published_at DESC,id DESC) AS publisher_position
 FROM items WHERE owner_id IS NULL AND published_at<=$1 AND fetched_at<=$1
 AND ($3='all' OR ($3='news' AND kind='article') OR ($3='podcasts' AND kind='podcast') OR ($3='data' AND kind NOT IN ('article','podcast')))
 ), selected AS (
 SELECT id,published_at FROM candidates WHERE (NOT $4::boolean OR kind<>'article' OR publisher_position<=2)
 AND ($2::text IS NULL OR (published_at,id)<(SELECT published_at,id FROM items WHERE id=$2 AND owner_id IS NULL))
 ORDER BY published_at DESC,id DESC LIMIT 31
 ) SELECT i.id,i.source_id,i.topic,i.tags,i.kind,i.title,i.url,i.excerpt,i.summary,i.summary_kind,i.published_at,i.observation_period
 FROM selected x JOIN items i ON i.id=x.id ORDER BY x.published_at DESC,x.id DESC`,[snapshot,before,category,balanced,JSON.stringify(families)])).rows;
 const items=rows.slice(0,30);
 return {items:await feedDisplay(items),next:rows.length>30?items.at(-1).id:null,snapshot};
}
