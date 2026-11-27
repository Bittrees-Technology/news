import {briefingSchema} from './story-documents';
import {englishReaderItem} from './english-reader';
import {reviewedBriefingItems} from './briefing-semantic-review';
import {failedEvidence,cleanFailureText} from './feed-safeguards';
import {sourceIsEnglish,translationKey,translationNumbersSupported,translationStatus} from './translation';
import {prostStoryId,prostBriefingCid,correctProstDisplay} from './briefing-search-review';
import {pool} from './db';
import {evidenceLabel,sourceEvidence} from './source-evidence';
// Snapshot content is immutable; current public ownership is still checked on every read.
export async function briefingVersion(shortId:string){
 if(!/^(?:[a-z2-7]{12}|[a-z2-7]{20})$/.test(shortId))return null;
 const row=(await pool().query(`SELECT i.*,v.document,v.cid FROM briefing_versions v JOIN items i ON i.id=v.item_id WHERE (v.short_id=$1 OR right(v.cid,12)=$1) AND i.owner_id IS NULL`,[shortId])).rows[0];
 if(!row)return null;
 const [checked]=await reviewedBriefingItems([row]);
 const failed=failedEvidence(row);
 const item=cleanFailureText(correctProstDisplay(archivedBriefingDisplay(row)));
 // Match the frozen title, never a newer item title. Read cached output only.
 const translated=(await translationStatus([translationKey(item)])).find(row=>row.status==='done');
 if(item.id!==prostStoryId && !sourceIsEnglish(item) && translated?.result && translationNumbersSupported({title:item.title,summary:item.summary||item.excerpt},translated.result)){item.translation=translated.result;item.translation_status='done';item.translation_reviewed=true;item.translation_key=translationKey(item);}
 if(failed) item.quality_issue="The source feed returned an error message. This briefing is withheld pending review.";
 if(!checked.briefing_semantic_approved) item.quality_issue="This generated briefing is awaiting editorial review of the source and meaning.";
 if(failed || item.cid===prostBriefingCid || !checked.briefing_semantic_approved || row.document?.evidence?.revision!==sourceEvidence(row).revision || !briefingSchema.safeParse(row.document?.briefing).success) return null;
 const display=englishReaderItem(item);
 return display.publication_ready&&display.document&&!display.quality_issue ? display : null;
}
export function archivedBriefingDisplay(row:any){
 const d=row.document;
 const {source_context,...item}=row;
 const evidence=d.evidence||sourceEvidence(row);
 return JSON.parse(JSON.stringify({...item,title:d.title,kind:d.kind,url:d.source.url,authors:d.source.authors||[],publication:d.source.publication,published_at:d.source.publishedAt,evidence,evidence_label:evidenceLabel(evidence.kind)}));
}
