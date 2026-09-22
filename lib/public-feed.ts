import {pool} from './db';
import type {Item} from './model';
import {translationKey,translationStatus} from './translation';
export type FeedPage={next:string|null;snapshot:string;leadIds:string[]};
export async function feedDisplay(items:Item[]){
 const found=new Map((await translationStatus(items.map(translationKey))).map(row=>[row.key,row]));
 // Explicit projection: no source body, model payload or account data in the feed.
 return items.map(i=>{
  const key=translationKey(i),row=found.get(key);
  return {id:i.id,source_id:i.source_id,topic:i.topic,tags:i.tags,kind:i.kind,title:i.title,url:i.url,excerpt:i.excerpt,summary:i.summary,summary_kind:i.summary_kind,published_at:i.published_at,observation_period:i.observation_period,translation_status:row?.status||'pending',translation:row?.status==='done'?row.result:undefined};
 });
}
export async function publicFeedBatch(snapshot:string,before:string|null=null){
 const rows=(await pool().query(`SELECT id,source_id,topic,tags,kind,title,url,excerpt,summary,summary_kind,published_at,observation_period FROM items
 WHERE owner_id IS NULL AND published_at<=$1 AND fetched_at<=$1
 AND ($2::text IS NULL OR (published_at,id)<(SELECT published_at,id FROM items WHERE id=$2 AND owner_id IS NULL))
 ORDER BY published_at DESC,id DESC LIMIT 31`,[snapshot,before])).rows;
 const items=rows.slice(0,30);
 return {items:await feedDisplay(items),next:rows.length>30?items.at(-1).id:null,snapshot};
}
