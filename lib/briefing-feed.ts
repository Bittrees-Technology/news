import {archivedBriefingDisplay} from './briefing-versions';
import {pool} from './db';
import {translationKey,translationStatus} from './translation';
import {sourceEvidence,evidenceLabel} from './source-evidence';
export async function briefingBatch(before:string|null=null,selected:string|null=null,snapshot=new Date().toISOString()){
 // Completion time, not the source's earlier publication date. A stable ID breaks ties.
 const rows=(await pool().query(`SELECT i.*,s.document,s.cid FROM story_documents s JOIN items i ON i.id=s.item_id
 WHERE s.document IS NOT NULL AND i.owner_id IS NULL AND COALESCE(s.generated_at,i.published_at)<=$3 AND i.fetched_at<=$3
 AND ($1::text IS NULL OR (COALESCE(s.generated_at,i.published_at),i.id)<(SELECT COALESCE(d.generated_at,x.published_at),x.id FROM items x JOIN story_documents d ON d.item_id=x.id WHERE x.id=$1 AND x.owner_id IS NULL))
 AND ($2::text IS NULL OR (COALESCE(s.generated_at,i.published_at),i.id)<=(SELECT COALESCE(d.generated_at,x.published_at),x.id FROM items x JOIN story_documents d ON d.item_id=x.id WHERE x.id=$2 AND x.owner_id IS NULL))
 ORDER BY COALESCE(s.generated_at,i.published_at) DESC,i.id DESC LIMIT 9`,[before,selected,snapshot])).rows;
 const hasMore=rows.length>8,items=rows.slice(0,8);
 const translations=new Map((await translationStatus(items.map(translationKey))).map(r=>[r.key,r]));
 const entries=items.map(i=>{const t=translations.get(translationKey(i)),evidence=i.document?.evidence||sourceEvidence(i);const {source_context,...display}=i;return {...display,...(i.cid?archivedBriefingDisplay(i):{}),translation:t?.status==='done'?t.result:undefined,evidence,evidence_label:evidenceLabel(evidence.kind)};});
 return JSON.parse(JSON.stringify({entries,next:hasMore?items.at(-1)?.id:null,snapshot}));
}
