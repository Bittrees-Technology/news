import {pool} from './db';
import {reviewedBriefingItems} from './briefing-semantic-review';
import {failedEvidence} from './feed-safeguards';
import {briefingLooksPortuguese} from './language-guard';
import {sourceEvidence} from './source-evidence';
import {briefingSchema} from './story-documents';
import {prostStoryId} from './briefing-search-review';
import type {Item} from './model';

// Only the exact current public source and its completed, eligible briefing may
// become a reader-facing post. This never starts processing or changes records.
export async function completedBriefings<T extends Item>(items:T[]):Promise<T[]> {
 const ids=items.filter(i=>!i.owner_id&&i.id!==prostStoryId).map(i=>i.id);
 if(!ids.length)return [];
 const rows=(await pool().query(`SELECT i.id,i.title,i.kind,i.source_id,i.source_context,i.excerpt,i.fetched_at,s.document FROM items i JOIN story_documents s ON s.item_id=i.id WHERE i.owner_id IS NULL AND i.id=ANY($1::text[]) AND s.document IS NOT NULL`,[ids])).rows;
 const reviewed=await reviewedBriefingItems(rows);
 const ready=new Map(reviewed.filter(r=>r.briefing_semantic_approved && !failedEvidence(r) && r.document?.evidence?.revision===sourceEvidence(r).revision && briefingSchema.safeParse(r.document?.briefing).success && !briefingLooksPortuguese(r.document.briefing)).map(r=>[r.id,r.document.briefing.overview as string]));
 return items.flatMap(item=>ready.has(item.id)?[{...item,briefing_preview:ready.get(item.id)}]:[]);
}

export async function publishedReaderItems<T extends Item>(items:T[]):Promise<T[]> {
 const {englishReaderItems}=await import('./english-reader');
 return englishReaderItems(await completedBriefings(items)).filter(i=>i.publication_ready);
}
