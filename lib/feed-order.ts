import type {Item} from './model';
export function uniqueStories(items:Item[]){
 const ids=new Set<string>(),urls=new Set<string>(),titles=new Set<string>();
 return items.filter(i=>{
  let url=i.url;try{const u=new URL(url);u.hash='';for(const k of [...u.searchParams.keys()])if(k.startsWith('utm_')||['fbclid','gclid'].includes(k))u.searchParams.delete(k);url=u.href;}catch{}
  const title=i.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  if(ids.has(i.id)||urls.has(url)||titles.has(title))return false;
  ids.add(i.id);urls.add(url);titles.add(title);return true;
 });
}
export function newestFirst(a:Item,b:Item){return Date.parse(b.published_at)-Date.parse(a.published_at)||b.id.localeCompare(a.id);}
// Leads are fixed for this reading window. Appending older pages cannot promote them.
export function feedOrder(items:Item[],leadIds:string[]){
 const byId=new Map(items.map(i=>[i.id,i]));
 return uniqueStories([...leadIds.flatMap(id=>byId.has(id)?[byId.get(id)!]:[]),...items.filter(i=>!leadIds.includes(i.id)).sort(newestFirst)]);
}
