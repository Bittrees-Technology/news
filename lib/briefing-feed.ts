import {archivedBriefingDisplay} from './briefing-versions';
import {pool} from './db';
import {translationKey,translationStatus} from './translation';
import {sourceEvidence,evidenceLabel} from './source-evidence';
async function displayEntries(items:any[]){
 const translations=new Map((await translationStatus(items.map(translationKey))).map(r=>[r.key,r]));
 return items.map(i=>{const t=translations.get(translationKey(i)),evidence=i.document?.evidence||sourceEvidence(i);const {source_context,...display}=i;return {...display,...(i.cid&&i.document?archivedBriefingDisplay(i):{}),translation:t?.status==='done'?t.result:undefined,evidence,evidence_label:evidenceLabel(evidence.kind)};});
}
export async function briefingBatch(before:string|null=null,selected:string|null=null,snapshot=new Date().toISOString()):Promise<{entries:any[];next:string|null;snapshot:string;selectedId?:string}>{
 // Direct links select an identity, never just a position in the completed queue.
 if(selected){
  const item=(await pool().query(`SELECT i.*,s.document,s.cid FROM items i LEFT JOIN story_documents s ON s.item_id=i.id WHERE i.id=$1 AND i.owner_id IS NULL`,[selected])).rows[0];
  if(!item)return {entries:[],next:null,snapshot};
  const older=await briefingBatch(item.document?selected:null,null,snapshot);
  const entries=await displayEntries([item]);
  return JSON.parse(JSON.stringify({...older,entries:[...entries,...older.entries.filter(i=>i.id!==selected)],selectedId:selected}));
 }

 // Completion time, not the source's earlier publication date. A stable ID breaks ties.
 const rows=(await pool().query(`SELECT i.*,s.document,s.cid FROM story_documents s JOIN items i ON i.id=s.item_id
 WHERE s.document IS NOT NULL AND i.owner_id IS NULL AND COALESCE(s.generated_at,i.published_at)<=$3 AND i.fetched_at<=$3
 AND ($1::text IS NULL OR (COALESCE(s.generated_at,i.published_at),i.id)<(SELECT COALESCE(d.generated_at,x.published_at),x.id FROM items x JOIN story_documents d ON d.item_id=x.id WHERE x.id=$1 AND x.owner_id IS NULL))
 AND ($2::text IS NULL OR (COALESCE(s.generated_at,i.published_at),i.id)<=(SELECT COALESCE(d.generated_at,x.published_at),x.id FROM items x JOIN story_documents d ON d.item_id=x.id WHERE x.id=$2 AND x.owner_id IS NULL))
 ORDER BY COALESCE(s.generated_at,i.published_at) DESC,i.id DESC LIMIT 9`,[before,selected,snapshot])).rows;
 const hasMore=rows.length>8,items=rows.slice(0,8);
 const entries=await displayEntries(items);
 return JSON.parse(JSON.stringify({entries,next:hasMore?items.at(-1)?.id:null,snapshot}));
}
