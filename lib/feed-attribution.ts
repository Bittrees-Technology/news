import Parser from 'rss-parser';
// Keep repeated RSS/Atom bylines; the parser's defaults retain only the first.
type AttributionEntry={tbnAuthors?:unknown;tbnCreators?:unknown;author?:unknown;creator?:unknown;'dc:creator'?:unknown;'content:encodedSnippet'?:string};
export const feedParser=new Parser<Record<string,unknown>,AttributionEntry>({customFields:{item:[
 ['author','tbnAuthors',{keepArray:true}],
 ['dc:creator','tbnCreators',{keepArray:true}],
]}});
export function authorNames(value:unknown):string[]{
 const values=Array.isArray(value)?value:[value];
 const names=values.flatMap(v=>{
  if(typeof v==='string')return [v];
  if(v&&typeof v==='object'){
   const o=v as Record<string,unknown>;
   return authorNames(o.name??o._);
  }
  return [];
 }).map(s=>s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,200)).filter(Boolean);
 return [...new Set(names)].slice(0,100);
}
export function feedAuthors(entry:AttributionEntry):string[]{
 const explicit=authorNames([entry.tbnAuthors,entry.tbnCreators].flat());
 return explicit.length?explicit:authorNames([entry.author,entry.creator,entry['dc:creator']].flat());
}
