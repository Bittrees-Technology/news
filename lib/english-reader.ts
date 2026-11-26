import {briefingLooksPortuguese,looksPortuguese} from './language-guard';
import type {Item} from './model';
import {sourceIsEnglish,translationKey,translationNumbersSupported} from './translation';

// Never let an unreviewed foreign-language fallback become reader-facing copy.
// Keep the record and link so pagination, saved state and attribution remain stable.
export function englishReaderItem<T extends Item>(item:T):T {
 const translated=item.translation;
 const verified=item.translation_status==='done' && item.translation_reviewed===true &&
  item.translation_key===translationKey(item) && !!translated;
 const originalEnglish=(sourceIsEnglish(item)||(verified&&translated?.language==='en'))&&!looksPortuguese([item.title,item.summary||item.excerpt].join(' '));
 const translatedEnglish=verified && translated?.language!=='en' && !!translated?.title?.trim() &&
  !!translated?.summary?.trim() && !looksPortuguese([translated.title,translated.summary].join(' ')) && translationNumbersSupported({title:item.title,summary:item.summary||item.excerpt},translated);
 const safeCoverage=item.coverage && !looksPortuguese([item.coverage.title,...item.coverage.claims.map(c=>c.text)].join(' ')) ? {...item.coverage,reports:item.coverage.reports.map(r=>({...r,title:'Read the original report'}))} : undefined;
 const {source_context,original_title,...copy}=item;
 const output=copy as typeof copy & {document?:{title?:string;briefing?:Parameters<typeof briefingLooksPortuguese>[0]};quality_issue?:string};
 const title=originalEnglish?item.title:translatedEnglish?translated!.title!:'English translation awaiting review';
 const document=briefingLooksPortuguese(output.document?.briefing)?undefined:output.document?{...output.document,title}:undefined;
 const safe={...copy,...(output.document?{document}:{}),...(output.document&&!document?{quality_issue:'This briefing is awaiting an English-language review.'}:{}),...(looksPortuguese(copy.briefing_preview||'')?{briefing_preview:undefined}:{})};
 if(originalEnglish) return {...safe,coverage:safeCoverage,translation:undefined} as T;
 if(translatedEnglish) return {...safe,coverage:safeCoverage,title,summary:translated!.summary!,excerpt:translated!.summary!,translation:undefined} as T;
 return {...safe,coverage:undefined,title,summary:'This story will appear in English after editorial review.',excerpt:'This story will appear in English after editorial review.',briefing_preview:undefined,translation:undefined,translation_status:'review'} as T;
}
export const englishReaderItems=<T extends Item>(items:T[])=>items.map(englishReaderItem);
