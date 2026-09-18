import type {Item} from './model';
export function recentUniqueStories(items:Item[],now=Date.now()){
 const ids=new Set<string>(),urls=new Set<string>(),titles=new Set<string>();
 return items.filter(i=>{
  const time=new Date(i.published_at).getTime();
  if(!Number.isFinite(time)||time>now||time<now-86400000)return false;
  let url=i.url;try{const u=new URL(url);u.hash='';for(const k of [...u.searchParams.keys()])if(k.startsWith('utm_')||['fbclid','gclid'].includes(k))u.searchParams.delete(k);url=u.href;}catch{}
  const title=i.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  if(ids.has(i.id)||urls.has(url)||titles.has(title))return false;
  ids.add(i.id);urls.add(url);titles.add(title);return true;
 });
}
