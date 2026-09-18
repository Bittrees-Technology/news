import {z} from 'zod';
import {pool,tx} from './db';
import {HttpError} from './model';
import {sourceName} from './catalog';
export const briefingSchema=z.object({overview:z.string().min(40).max(2200),points:z.array(z.string().min(10).max(500)).min(1).max(4),limitations:z.string().min(10).max(600)});
export async function claimStory(){return tx(async d=>{
 const row=(await d.query("SELECT s.*,i.title,i.url,i.kind,i.source_id,i.published_at,i.authors,i.publication,i.source_context,i.excerpt FROM story_documents s JOIN items i ON i.id=s.item_id WHERE i.owner_id IS NULL AND s.cid IS NULL AND (s.claimed_at IS NULL OR s.claimed_at<now()-interval '15 minutes') ORDER BY i.published_at DESC FOR UPDATE OF s SKIP LOCKED LIMIT 1")).rows[0];
 if(!row)return null;await d.query('UPDATE story_documents SET claimed_at=now() WHERE item_id=$1',[row.item_id]);return row;
 });}
export async function saveStory(input:unknown){
 const b=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),briefing:briefingSchema,model:z.string().max(100)}).parse(input);
 const i=(await pool().query('SELECT * FROM items WHERE id=$1 AND owner_id IS NULL',[b.id])).rows[0];
 if(!i)throw new HttpError(404,'Public story not found');
 const payload={version:1,id:i.id,title:i.title,kind:i.kind,source:{url:i.url,authors:i.authors,publication:i.publication||sourceName(i.source_id),publishedAt:i.published_at},briefing:b.briefing,model:b.model,generatedAt:new Date().toISOString(),url:`https://news.bittrees.org/story/${i.id}`,notice:'Bittrees briefing generated from publisher-provided feed evidence. Not the original full article; consult the linked source.'};
 await pool().query('UPDATE story_documents SET document=$2,generated_at=now(),error=NULL WHERE item_id=$1',[b.id,JSON.stringify(payload)]);return payload;
}
export async function saveStoryCid(input:unknown){const b=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),cid:z.string().regex(/^b[a-z2-7]{30,120}$/)}).parse(input);const r=await pool().query('UPDATE story_documents s SET cid=$2,pinned_at=now(),error=NULL FROM items i WHERE s.item_id=$1 AND i.id=s.item_id AND i.owner_id IS NULL AND s.document IS NOT NULL RETURNING s.item_id',[b.id,b.cid]);if(!r.rowCount)throw new HttpError(404,'Public briefing not found');return {ok:true};}

export async function withBriefings<T extends {id:string;owner_id?:string|null}>(items:T[]){
 const rows=(await pool().query("SELECT s.item_id,s.document FROM story_documents s JOIN items i ON i.id=s.item_id WHERE s.item_id=ANY($1::text[]) AND i.owner_id IS NULL AND s.document IS NOT NULL",[items.map(i=>i.id)])).rows;
 const summaries=new Map(rows.map(r=>[r.item_id,r.document.briefing.overview]));
 return items.map(i=>({...i,...(!i.owner_id&&summaries.has(i.id)?{briefing_preview:summaries.get(i.id).slice(0,600)}:{})}));
}
