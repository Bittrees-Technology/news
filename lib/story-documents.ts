import {recordClaim,recordOutcome} from "./job-ledger";
import {sourceEvidence} from "./source-evidence";
import {publicJob} from "./job-contract";
import {z} from 'zod';
import {pool,tx} from './db';
import {HttpError} from './model';
import {sourceName} from './catalog';
export const briefingSchema=z.object({overview:z.string().min(40).max(2200),points:z.array(z.string().min(10).max(500)).min(1).max(4),limitations:z.string().min(10).max(600)});
export async function claimStory(){return tx(async d=>{
 const turn=(await d.query("INSERT INTO worker_state(id,data) VALUES('scheduler-briefing','{\"claims\":1}') ON CONFLICT(id) DO UPDATE SET data=jsonb_build_object('claims',coalesce((worker_state.data->>'claims')::bigint,0)+1),updated_at=now() RETURNING (data->>'claims')::bigint AS n")).rows[0].n;
 const row=(await d.query("SELECT s.*,i.title,i.url,i.kind,i.source_id,i.published_at,i.authors,i.publication,i.source_context,i.excerpt FROM story_documents s JOIN items i ON i.id=s.item_id WHERE i.owner_id IS NULL AND s.cid IS NULL AND s.attempts<3 AND s.available_at<=now() AND (s.claimed_at IS NULL OR s.claimed_at<now()-interval '30 minutes') ORDER BY (s.document IS NOT NULL) DESC,CASE WHEN $1 THEN coalesce(s.enqueued_at,i.fetched_at) END ASC NULLS LAST,(i.published_at>=now()-interval '24 hours') DESC,s.priority DESC,i.published_at DESC FOR UPDATE OF s SKIP LOCKED LIMIT 1",[Number(turn)%10===0])).rows[0];
 if(!row)return null;
 const claim=(await d.query('UPDATE story_documents SET claimed_at=now(),lease=gen_random_uuid(),attempts=attempts+1 WHERE item_id=$1 RETURNING lease',[row.item_id])).rows[0];
 const job=await recordClaim(d,publicJob('briefing',row.item_id,[row.title,row.source_context||row.excerpt],claim.lease,row.priority),row.document?'archive':'generation');
 return {...row,queue_wait_ms:row.enqueued_at?Math.max(0,Date.now()-new Date(row.enqueued_at).getTime()):null,lease:claim.lease,job};
 });}
export async function retryStory(input:unknown){return tx(async d=>{
 const b=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),lease:z.uuid(),busy:z.boolean().default(false),error:z.string().max(100)}).parse(input);
 const r=await d.query("UPDATE story_documents SET claimed_at=NULL,lease=NULL,attempts=greatest(0,attempts-CASE WHEN $3 THEN 1 ELSE 0 END),available_at=now()+CASE WHEN $3 THEN interval '30 seconds' ELSE interval '5 minutes'*attempts END,error=$4 WHERE item_id=$1 AND lease=$2 AND cid IS NULL AND claimed_at>now()-interval '30 minutes' RETURNING item_id,attempts",[b.id,b.lease,b.busy,b.error]);
 if(!r.rowCount)throw new HttpError(409,'Briefing lease is no longer active');await recordOutcome(d,b.lease,b.busy?'deferred':r.rows[0].attempts>=3?'review':'retry');return {ok:true};
 });}
export async function saveStory(input:unknown){return tx(async d=>{
 const b=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),lease:z.uuid(),briefing:briefingSchema,model:z.string().max(100)}).parse(input);
 const i=(await d.query('SELECT * FROM items WHERE id=$1 AND owner_id IS NULL',[b.id])).rows[0];
 if(!i)throw new HttpError(404,'Public story not found');
 const payload={version:1,evidence:sourceEvidence(i),id:i.id,title:i.title,kind:i.kind,source:{url:i.url,authors:i.authors,publication:i.publication||sourceName(i.source_id),publishedAt:i.published_at},briefing:b.briefing,model:b.model,generatedAt:new Date().toISOString(),url:`https://news.bittrees.org/story/${i.id}`,notice:'Bittrees briefing generated from publisher-provided feed evidence. Not the original full article; consult the linked source.'};
 const r=await d.query('UPDATE story_documents SET document=coalesce(document,$2),generated_at=coalesce(generated_at,now()),error=NULL WHERE item_id=$1 AND cid IS NULL AND lease=$3 AND claimed_at>now()-interval \'30 minutes\' RETURNING item_id,document',[b.id,JSON.stringify(payload),b.lease]);if(!r.rowCount)throw new HttpError(409,'Briefing lease is no longer active');await recordOutcome(d,b.lease,'generated');return r.rows[0].document;
 });}
export async function saveStoryCid(input:unknown){return tx(async d=>{const b=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),lease:z.uuid(),cid:z.string().regex(/^b[a-z2-7]{30,120}$/)}).parse(input);const r=await d.query('UPDATE story_documents s SET cid=$2,pinned_at=now(),error=NULL FROM items i WHERE s.item_id=$1 AND i.id=s.item_id AND i.owner_id IS NULL AND s.document IS NOT NULL AND (s.cid IS NULL OR s.cid=$2) AND s.lease=$3 AND s.claimed_at>now()-interval \'30 minutes\' RETURNING s.item_id',[b.id,b.cid,b.lease]);if(!r.rowCount)throw new HttpError(404,'Public briefing not found');await recordOutcome(d,b.lease,'archived');return {ok:true};});}

export async function withBriefings<T extends {id:string;owner_id?:string|null}>(items:T[]){
 const rows=(await pool().query("SELECT s.item_id,s.document FROM story_documents s JOIN items i ON i.id=s.item_id WHERE s.item_id=ANY($1::text[]) AND i.owner_id IS NULL AND s.document IS NOT NULL",[items.map(i=>i.id)])).rows;
 const summaries=new Map(rows.map(r=>[r.item_id,r.document.briefing.overview]));
 return items.map(i=>({...i,...(!i.owner_id&&summaries.has(i.id)?{briefing_preview:summaries.get(i.id).slice(0,600)}:{})}));
}
