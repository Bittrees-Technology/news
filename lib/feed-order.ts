import type {Item} from './model';
export function uniqueStories(items:Item[]){
 const ids=new Set<string>(),urls=new Set<string>(),titles=new Set<string>();
 return items.filter(i=>{
  let url=i.url;try{const u=new URL(url);u.hash='';for(const k of [...u.searchParams.keys()])if(k.startsWith('utm_')||['fbclid','gclid'].includes(k))u.searchParams.delete(k);url=u.href;}catch{}
  const title=i.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  if(ids.has(i.id)||urls.has(url)||(titles.has(title)&&!i.coverage))return false;
  ids.add(i.id);urls.add(url);titles.add(title);return true;
 });
}
export function newestFirst(a:Item,b:Item){return Date.parse(b.published_at)-Date.parse(a.published_at)||b.id.localeCompare(a.id);}
// Leads are fixed for this reading window. Appending older pages cannot promote them.
export function feedOrder(items:Item[],leadIds:string[]){
 const byId=new Map(items.map(i=>[i.id,i]));
 return uniqueStories([...leadIds.flatMap(id=>byId.has(id)?[byId.get(id)!]:[]),...items.filter(i=>!leadIds.includes(i.id)).sort(newestFirst)]);
}

// Reorder only within each frozen page. Deferred articles stay in the same page,
// and appending a page cannot displace an article the reader already saw.
export function variedPages(items: Item[], leads: string[], batches: string[][], family: (i: Item) => string, limit = 2) {
  const pageById = new Map<string, number>();
  batches.forEach((ids, index) => ids.forEach(id => {
    if (!pageById.has(id)) pageById.set(id, index);
  }));
  const fixed = new Set(leads);
  const result = items.filter(i => fixed.has(i.id));
  const pages = new Map<number, Item[]>();
  for (const item of items) {
    if (fixed.has(item.id)) continue;
    const index = pageById.get(item.id) ?? batches.length;
    if (!pages.has(index)) pages.set(index, []);
    pages.get(index)!.push(item);
  }
  for (const page of pages.values()) {
    while (page.length) {
      const first = page[0];
      let slot = 0;
      if (first.kind === 'article') {
        const recent = result.slice(-9).filter(i => i.kind === 'article').map(family);
        const enough = (item: Item) => recent.filter(id => id === family(item)).length >= limit;
        if (enough(first)) {
          const earliest = Date.parse(first.published_at) - 2 * 3600_000;
          for (let n = 1; n < Math.min(13, page.length); n++) {
            if (Date.parse(page[n].published_at) < earliest || page[n].kind !== 'article') break;
            if (!enough(page[n])) { slot = n; break; }
          }
        }
      }
      result.push(page.splice(slot, 1)[0]);
    }
  }
  return result;
}
