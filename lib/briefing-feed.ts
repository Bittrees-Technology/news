import {reviewedBriefingItems} from './briefing-semantic-review';
import {failedEvidence,cleanFailureText} from './feed-safeguards';
import {prostStoryId,prostBriefingCid,correctProstDisplay} from './briefing-search-review';
import {archivedBriefingDisplay} from './briefing-versions';
import {pool} from './db';
import {sourceIsEnglish,translationNumbersSupported,translationKey,translationStatus} from './translation';
import {sourceEvidence,evidenceLabel} from './source-evidence';
async function displayEntries(items:any[]){
 const checked=await reviewedBriefingItems(items);
 const prepared=checked.map(raw=>{
  const failed=failedEvidence(raw);
  const evidence=raw.document?.evidence||sourceEvidence(raw);
  const {source_context,...display}=raw;
  const item=cleanFailureText(correctProstDisplay({
   ...display,...(raw.cid&&raw.document?archivedBriefingDisplay(raw):{}),
   ...(raw.cid===prostBriefingCid||failed||!raw.briefing_semantic_approved?{document:undefined}:{}),
   ...(!raw.briefing_semantic_approved?{quality_issue:'This generated briefing is awaiting editorial review of the source and meaning.'}:{}),
   ...(failed?{quality_issue:'The source feed returned an error message. This briefing is withheld pending review.'}:{}),
   evidence,evidence_label:evidenceLabel(evidence.kind),
  }));
  return item;
 });
 const translations=new Map((await translationStatus(prepared.map(translationKey))).map(row=>[row.key,row]));
 return prepared.map(i=>{
  const row=translations.get(translationKey(i));
  const translation=row?.status==='done' && row.result && i.id!==prostStoryId &&
   !sourceIsEnglish(i) && translationNumbersSupported({title:i.title,summary:i.summary||i.excerpt},row.result)
   ? row.result : undefined;
  return {...i,translation,translation_status:row?.status};
 });
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
