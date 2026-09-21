import {pool} from './db';
import {translationKey,translationStatus} from './translation';
import {sourceEvidence,evidenceLabel} from './source-evidence';
export async function briefingBatch(before:string|null=null,selected:string|null=null,snapshot=new Date().toISOString()){
 const rows=(await pool().query(`SELECT i.*,s.document,s.cid FROM items i LEFT JOIN story_documents s ON s.item_id=i.id WHERE i.owner_id IS NULL AND i.published_at<=$3 AND i.fetched_at<=$3
 AND ($1::text IS NULL OR (i.published_at,i.id)<(SELECT published_at,id FROM items WHERE id=$1 AND owner_id IS NULL))
 AND ($2::text IS NULL OR (i.published_at,i.id)<=(SELECT published_at,id FROM items WHERE id=$2 AND owner_id IS NULL))
 ORDER BY i.published_at DESC,i.id DESC LIMIT 31`,[before,selected,snapshot])).rows;
 const hasMore=rows.length>30,items=rows.slice(0,30);
 const translations=new Map((await translationStatus(items.map(translationKey))).map(r=>[r.key,r]));
 const entries=items.map(i=>{const t=translations.get(translationKey(i)),evidence=i.document?.evidence||sourceEvidence(i);return {...i,translation:t?.status==='done'?t.result:undefined,evidence,evidence_label:evidenceLabel(evidence.kind)};});
 return JSON.parse(JSON.stringify({entries,next:hasMore?items.at(-1)?.id:null,snapshot}));
}
