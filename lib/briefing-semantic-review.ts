import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {allSources} from './catalog';
import {pool,tx} from './db';
import {isFeedFailure} from './feed-safeguards';
import {HttpError} from './model';

// Only explicitly catalogued English sources are exempt. Unknown is not English.
export const englishSourceIds=allSources.filter(s=>s.language==='en').map(s=>s.id);
// PostgreSQL hashes the exact stored document and the evidence currently available to the reviewer.
export const briefingFingerprintSql=(item:string,doc:string)=>`encode(sha256(convert_to(jsonb_build_array(${item}.id,${doc},${item}.title,coalesce(nullif(${item}.source_context,''),${item}.excerpt,''))::text,'UTF8')),'hex')`;
export const briefingApprovedSql=(item:string,doc:string,englishParameter:string)=>`(${item}.source_id=ANY(${englishParameter}::text[]) OR EXISTS (SELECT 1 FROM quality_reviews qr WHERE qr.task='briefing_semantics' AND qr.artifact_id=${item}.id AND qr.category='briefing_approved' AND left(qr.note,64)=${briefingFingerprintSql(item,doc)}))`;

export async function reviewedBriefingItems<T extends {id:string;document?:any;source_id?:string}>(items:T[]) {
 const inputs=items.filter(i=>i.document&&!englishSourceIds.includes(i.source_id||''));
 if(!inputs.length)return items.map(i=>({...i,briefing_semantic_approved:true}));
 const results=(await pool().query(`SELECT x.id, q.category='briefing_approved' AND left(q.note,64)=encode(sha256(convert_to(jsonb_build_array(x.id,x.document,x.title,coalesce(nullif(x.source_context,''),x.excerpt,''))::text,'UTF8')),'hex') AS approved FROM jsonb_to_recordset($1::jsonb) AS x(id text,document jsonb,title text,source_context text,excerpt text) LEFT JOIN quality_reviews q ON q.task='briefing_semantics' AND q.artifact_id=x.id`,[JSON.stringify(inputs)])).rows;
 const approvals=new Map(results.map(r=>[r.id,r.approved===true]));
 return items.map(i=>({...i,briefing_semantic_approved:!i.document||englishSourceIds.includes(i.source_id||'')||approvals.get(i.id)===true}));
}
export async function briefingSemanticReviewQueue() {
 const rows=(await pool().query(`SELECT i.id,i.title,i.source_context,i.excerpt,i.url,s.document,s.generated_at,${briefingFingerprintSql('i','s.document')} AS fingerprint,q.category,q.note FROM story_documents s JOIN items i ON i.id=s.item_id LEFT JOIN quality_reviews q ON q.task='briefing_semantics' AND q.artifact_id=i.id WHERE i.owner_id IS NULL AND s.document IS NOT NULL AND NOT (coalesce(i.source_id,'')=ANY($1::text[])) AND (q.artifact_id IS NULL OR left(q.note,64)<>${briefingFingerprintSql('i','s.document')} OR q.category IN ('briefing_approved','briefing_rejected')) ORDER BY CASE WHEN q.artifact_id IS NULL OR left(q.note,64)<>${briefingFingerprintSql('i','s.document')} THEN 0 ELSE 1 END,s.generated_at ASC LIMIT 20`,[englishSourceIds])).rows;
 return rows.map(r=>({id:r.id,title:r.title,source:r.source_context?.trim()||r.excerpt,url:r.url,briefing:r.document.briefing,fingerprint:r.fingerprint,approved:r.category==='briefing_approved'&&r.note?.slice(0,64)===r.fingerprint,failed:isFeedFailure(r.source_context?.trim()||r.excerpt)}));
}
export async function reviewBriefingSemantics(actor:string,input:unknown) {
 const b=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),decision:z.enum(['approve','reject']),note:z.string().trim().min(15).max(1500)}).strict().parse(input);
 return tx(async d=>{
  const row=(await d.query(`SELECT i.title,i.source_context,i.excerpt,s.document,${briefingFingerprintSql('i','s.document')} AS fingerprint FROM story_documents s JOIN items i ON i.id=s.item_id WHERE i.id=$1 AND i.owner_id IS NULL AND s.document IS NOT NULL FOR UPDATE OF i,s`,[b.id])).rows[0];
  if(!row)throw new HttpError(404,'Briefing is unavailable for review');
  if(row.fingerprint!==b.fingerprint)throw new HttpError(409,'The source or briefing changed. Reload before reviewing.');
  if(b.decision==='approve'&&isFeedFailure(row.source_context?.trim()||row.excerpt))throw new HttpError(422,'The source is an error message and cannot support this briefing.');
  await d.query(`INSERT INTO quality_reviews(task,artifact_id,actor,category,note) VALUES('briefing_semantics',$1,$2,$3,$4) ON CONFLICT(task,artifact_id) DO UPDATE SET actor=$2,category=$3,note=$4,reviewed_at=now()`,[b.id,actor,b.decision==='approve'?'briefing_approved':'briefing_rejected',b.fingerprint+':'+b.note]);
  await d.query("INSERT INTO news_staff_audit(id,actor,action,detail) VALUES($1,$2,'review_briefing_semantics',$3)",[randomUUID(),actor,JSON.stringify({item_id:b.id,fingerprint:b.fingerprint,decision:b.decision,note:b.note})]);
  return {ok:true};
 });
}
