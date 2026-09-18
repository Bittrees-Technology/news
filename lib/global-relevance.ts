import type { Item } from "./model";
import { geographyFor } from "./geography";
import { articleTags } from "./tags";

const broadTopics = new Set([
  "World", "Economy", "Politics", "Science", "Tech", "AI", "Quantum",
  "Energy", "Health", "Climate", "Governance", "Space", "Biotech",
  "Bitcoin", "Crypto", "Blockchain", "DAOs", "Nuclear", "Security",
]);

// Bounded, explainable editorial signals; no publisher-country or format bonus.
// Keyword repetition cannot accumulate points. Personal interests can replace this default.
export function globalRelevance(item: Item): number {
  const title = item.translation?.title || item.title;
  const summary = item.translation?.summary || item.summary;
  const text = [title, item.excerpt, summary].filter(Boolean).join(" ");
  if (/\b(global|worldwide|international|cross[- ]border|multinational|world economy|world trade|global markets|supply chains?|climate change|pandemic|united nations|world health organization)\b/i.test(text)) return 95;
  // Ignore topic labels when identifying country mentions in the actual content.
  const geography = geographyFor({title, excerpt: item.excerpt, summary, topic: ""});
  if (geography.countries.length >= 2) return 85;
  if (articleTags(item).some(topic => broadTopics.has(topic))) return 70;
  return 50;
}
