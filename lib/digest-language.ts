import {looksPortuguese} from './language-guard';
import {isFeedFailure} from './feed-safeguards';
import type { Item } from "./model";
import { sourceIsEnglish, translationKey, translationNumbersSupported } from "./translation";

// Email is an immutable snapshot: never fall back to unverified source-language
// copy. Exact-content keys also prevent old translations replacing owner edits.
export function englishDigestItems(items: Item[]): Item[] {
  return items.flatMap(item => {
    if (isFeedFailure(item.source_context || item.summary || item.excerpt)) return [];
    if (sourceIsEnglish(item)) return looksPortuguese([item.title,item.summary||item.excerpt].join(' ')) ? [] : [{...item,translation:undefined}];
    const translated = item.translation;
    if (item.translation_status !== "done" ||
        item.translation_key !== translationKey(item) || !translated) return [];
    if (translated.language === 'en') return item.translation_reviewed&&!looksPortuguese([item.title,item.summary||item.excerpt].join(' ')) ? [item] : [];
    if (!item.translation_reviewed || looksPortuguese([translated.title,translated.summary].join(' ')) || !translated.title?.trim() || !translated.summary?.trim() ||
        !translationNumbersSupported({title:item.title,summary:item.summary||item.excerpt},translated)) return [];
    return [{ ...item, title: translated.title, summary: translated.summary,
      excerpt: translated.summary }];
  });
}
