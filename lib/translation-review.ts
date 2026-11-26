import {translationNumbersSupported} from './translation-integrity';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {pool,tx} from './db';
import {HttpError} from './model';

// Bind approval to both the exact source text and the exact translated output.
function canonical(value:unknown):unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]),
  );
  return value;
}
export function translationFingerprint(key:string,payload:unknown,result:unknown) {
  return createHash('sha256').update(JSON.stringify(canonical({key,payload,result}))).digest('hex');
}
export function isTranslationApproved(row:{key:string;payload:unknown;result:any;review_category?:string|null;review_note?:string|null}) {
  if (row.result?.language === 'en') return true;
  if (row.review_category !== 'translation_approved' || !row.review_note) return false;
  try {
    const approval=JSON.parse(row.review_note);
    return approval.fingerprint===translationFingerprint(row.key,row.payload,row.result);
  } catch {return false;}
}
export const translationDecisionSchema=z.object({
  key:z.string().regex(/^[a-f0-9]{64}$/),
  fingerprint:z.string().regex(/^[a-f0-9]{64}$/),
  decision:z.enum(['approve','reject']),
  note:z.string().trim().min(15).max(1500),
}).strict();

export async function translationReviewQueue() {
  const pending=(await pool().query(`SELECT t.key,t.payload,t.result,t.completed_at,q.category AS review_category,q.note AS review_note
    FROM translations t LEFT JOIN quality_reviews q ON q.task='translation' AND q.artifact_id=t.key
    WHERE t.status='done' AND t.result->>'language' IS NOT NULL AND t.result->>'language'<>'en'
      AND (q.artifact_id IS NULL OR t.completed_at>q.reviewed_at)
    ORDER BY t.completed_at ASC,t.key LIMIT 20`)).rows;
  const approved=(await pool().query(`SELECT t.key,t.payload,t.result,t.completed_at,q.category AS review_category,q.note AS review_note
    FROM translations t JOIN quality_reviews q ON q.task='translation' AND q.artifact_id=t.key
    WHERE t.status='done' AND q.category IN ('translation_approved','translation_rejected') ORDER BY q.reviewed_at DESC LIMIT 10`)).rows;
  return [...pending.filter(r=>!isTranslationApproved(r)),...approved.filter(r=>r.review_category==='translation_rejected' || isTranslationApproved(r))].map(r=>({
    key:r.key,original:r.payload,translation:r.result,
    fingerprint:translationFingerprint(r.key,r.payload,r.result),completed_at:r.completed_at,
    approved:isTranslationApproved(r),rejected:r.review_category==='translation_rejected',
  }));
}

export async function reviewTranslation(actor:string,input:unknown) {
  const b=translationDecisionSchema.parse(input);
  return tx(async db=>{
    const row=(await db.query("SELECT key,payload,result FROM translations WHERE key=$1 AND status='done' FOR UPDATE",[b.key])).rows[0];
    if(!row || !row.result || row.result.language==='en') throw new HttpError(404,'Translation is unavailable for review');
    if(translationFingerprint(row.key,row.payload,row.result)!==b.fingerprint)
      throw new HttpError(409,'The translation changed. Reload it before reviewing.');
    if(b.decision==='approve' && !translationNumbersSupported(row.payload,row.result))
      throw new HttpError(422,'The translation contains a number not present in the source.');
    const category=b.decision==='approve'?'translation_approved':'translation_rejected';
    await db.query(`INSERT INTO quality_reviews(task,artifact_id,actor,category,note)
      VALUES('translation',$1,$2,$3,$4)
      ON CONFLICT(task,artifact_id) DO UPDATE SET actor=$2,category=$3,note=$4,reviewed_at=now()`,
      [b.key,actor,category,JSON.stringify({fingerprint:b.fingerprint,note:b.note})]);
    await db.query("INSERT INTO news_staff_audit(id,actor,action,detail) VALUES($1,$2,'review_translation',$3)",
      [randomUUID(),actor,JSON.stringify({key:b.key,fingerprint:b.fingerprint,decision:b.decision,note:b.note})]);
    return {ok:true};
  });
}
