import type { Item } from "./model";
import { translationKey } from "./translation";

// Email is an immutable snapshot: never fall back to unverified source-language
// copy. Exact-content keys also prevent old translations replacing owner edits.
export function englishDigestItems(items: Item[]): Item[] {
  return items.flatMap(item => {
    const translated = item.translation;
    if (item.translation_status !== "done" ||
        item.translation_key !== translationKey(item) || !translated) return [];
    if (translated.language === "en") return [item];
    if (!translated.title?.trim() || !translated.summary?.trim()) return [];
    return [{ ...item, title: translated.title, summary: translated.summary,
      excerpt: translated.summary }];
  });
}
