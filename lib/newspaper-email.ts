import { scoreArticle, defaultRanking, type RankingProfile } from "./scoring";
import type { Item, Preferences } from "./model";
import { articleTags } from "./tags";
import { sourceLicense, sourceName } from "./catalog";
export const compactSummary = (value: string) => {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= 180) return text;
  const cut = text.slice(0, 179);
  return cut.slice(0, cut.lastIndexOf(" ") > 120 ? cut.lastIndexOf(" ") : cut.length) + "…";
};
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function creditHtml(id: string | undefined, authors?: string[]) {
  const license = sourceLicense(id);
  if (!license) return '';
  const byline = authors?.length ? escape(authors.join(', ')) + ' · ' : '';
  return `<small>${byline}<a href="${escape(license.url)}">${escape(license.name)}</a> · TBN excerpt or adaptation</small>`;
}
export function creditText(id: string | undefined, authors?: string[]) {
  const license = sourceLicense(id);
  if (!id || !license) return '';
  return '\n' + [authors?.join(', '), sourceName(id), license.name, license.url, 'TBN excerpt or adaptation'].filter(Boolean).join(' · ');
}
function coverageHtml(item:Item) {
  const event=item.coverage!;
  const claims=event.claims.map(c=>`<p>${escape(c.text)} ${c.reports.map(id=>{
    const r=event.reports.find(r=>r.id===id)!;
    return `<a href="${escape(r.url)}">${escape(r.outlet)}</a>`;
  }).join(' · ')}</p>`).join('');
  return `<h2>${escape(event.title)}</h2>${claims}<p>Coverage from ${new Set(event.reports.map(r=>r.outlet)).size} sources</p><ul>${event.reports.map(r=>`<li>${escape(r.outlet)} · <a href="${escape(r.url)}">${escape(r.title)}</a> ${creditHtml(r.sourceId,r.authors)}</li>`).join('')}</ul>`;
}
export function coverageText(item:Item) {
  const event=item.coverage!;
  return [event.title,...event.claims.map(c=>c.text+' '+c.reports.map(id=>'['+(event.reports.findIndex(r=>r.id===id)+1)+']').join(' ')),
    ...event.reports.map((r,n)=>`[${n+1}] ${r.outlet} · ${r.title} · ${r.url}${creditText(r.sourceId,r.authors)}`)].join('\n');
}
export function newspaperEmail(
  name: string,
  items: Item[],
  date: string,
  unsubscribe: string,
  readMore = "https://news.bittrees.org",
  highlightLead = false,
) {
  const stories = items.slice(0, 3)
    .map(
      (i,index) => highlightLead && i.coverage ? `<article>${index===0?'<p>Lead story</p>':''}${coverageHtml(i)}</article>` :
        `<article style="padding:12px 0;border-bottom:1px solid #999">${highlightLead && index===0 ? '<p style="font-weight:bold">Lead story</p>' : ""}<p style="font-size:12px">${escape(articleTags(i)[0])} · ${escape(sourceName(i.source_id))} ${creditHtml(i.source_id,i.authors)}</p><h2 style="font-family:Georgia,serif;font-size:${highlightLead && index===0 ? 26 : 20}px;line-height:1.2;margin:8px 0"><a style="color:#181818" href="${escape(i.url)}">${escape(i.title)}</a></h2><p style="font-size:12px;color:#555">${escape(new Date(i.published_at).toISOString().slice(0, 10))}</p><p style="font-size:14px;line-height:1.45">${escape(compactSummary(i.summary || i.excerpt))}</p>${i.user_edited ? '<p style="font-size:12px">Edited by the newspaper owner. The headline links to the original source.</p>' : ""}</article>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#eeede6;color:#181818"><table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:600px;background:#fffef8;padding:18px;font-family:Georgia,serif"><tr><td><header style="text-align:center;border-bottom:5px double #181818"><p>${escape(date)}</p><h1 style="font-size:28px;line-height:1.1">${escape(name)}</h1><p style="font-size:13px">Published with The Bittrees News</p></header><p style="font-size:13px">Your top stories to review</p>${stories}<p style="margin:20px 0"><a style="color:#181818;font-weight:bold" href="${escape(readMore)}">Read more in ${escape(name)} →</a></p><footer style="padding-top:24px;font-size:12px"><p>Full reporting belongs to the linked publishers.</p><a href="${escape(unsubscribe)}">Pause this subscription</a></footer></td></tr></table></td></tr></table></body></html>`;
}

// Relevance/quality scoring, not a fabricated popularity count. Preserve owner edits.
export function digestArticles(items: Item[], prefs: Preferences, profile: RankingProfile = defaultRanking, now = new Date(), limit = 3) {
  const seen = new Set<string>();
  return items.filter(i => ["article", "podcast", "data"].includes(i.kind))
    .map(i => ({item:i, score:scoreArticle(i, prefs, profile, i.ranking?.sourceScore ?? 50, now).value}))
    .sort((a,b) => b.score-a.score || Date.parse(b.item.published_at)-Date.parse(a.item.published_at) || a.item.id.localeCompare(b.item.id))
    .filter(({item}) => {const key=item.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""); if(seen.has(key))return false; seen.add(key); return true;})
    .slice(0,limit).map(({item}) => item);
}
