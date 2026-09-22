import {pool} from './db';
import {evidenceLabel,sourceEvidence} from './source-evidence';
// Snapshot content is immutable; current public ownership is still checked on every read.
export async function briefingVersion(shortId:string){
 if(!/^(?:[a-z2-7]{12}|[a-z2-7]{20})$/.test(shortId))return null;
 const row=(await pool().query(`SELECT i.*,v.document,v.cid FROM briefing_versions v JOIN items i ON i.id=v.item_id WHERE (v.short_id=$1 OR right(v.cid,12)=$1) AND i.owner_id IS NULL`,[shortId])).rows[0];
 if(!row)return null;
 const item=archivedBriefingDisplay(row);
 // Match the frozen title, never a newer item title. Read cached output only.
 const translated=(await pool().query(`SELECT result FROM translations WHERE status='done' AND payload->>'title'=$1 ORDER BY completed_at DESC NULLS LAST,key LIMIT 1`,[item.title])).rows[0];
 if(translated?.result?.title)item.translation={title:translated.result.title,language:translated.result.language};
 return item;
}
export function archivedBriefingDisplay(row:any){
 const d=row.document;
 const {source_context,...item}=row;
 const evidence=d.evidence||sourceEvidence(row);
 return JSON.parse(JSON.stringify({...item,title:d.title,kind:d.kind,url:d.source.url,authors:d.source.authors||[],publication:d.source.publication,published_at:d.source.publishedAt,evidence,evidence_label:evidenceLabel(evidence.kind)}));
}
