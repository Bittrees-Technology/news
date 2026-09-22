import {HttpError} from './model';
export function parseEditorialReference(input:string){
 let value=input.trim();
 if(value.startsWith('https://')){
  const url=new URL(value);
  if(url.origin!=='https://news.bittrees.org')throw new HttpError(400,'Use a TBN article or briefing link.');
  const match=url.pathname.match(/^\/(?:briefings|story)\/([^/]+)\/?$/);
  value=match?.[1]||(url.pathname==='/briefings'?url.searchParams.get('story')||'':'');
 }
 if(/^[a-f0-9]{64}$/.test(value))return {kind:'article' as const,value};
 if(/^(?:[a-z2-7]{12}|[a-z2-7]{20}|b[a-z2-7]{30,120})$/.test(value))return {kind:'briefing' as const,value};
 throw new HttpError(400,'Enter an article ID, briefing ID, full CID or TBN briefing link.');
}
export async function resolveEditorialReference(db:{query:Function},input:string){
 const ref=parseEditorialReference(input);
 const result=ref.kind==='article'
 ?await db.query('SELECT i.id item_id,i.title,i.url,s.cid briefing_cid FROM items i LEFT JOIN story_documents s ON s.item_id=i.id WHERE i.id=$1 AND i.owner_id IS NULL',[ref.value])
 :await db.query('SELECT i.id item_id,v.document->>\'title\' title,i.url,v.cid briefing_cid FROM briefing_versions v JOIN items i ON i.id=v.item_id WHERE (v.cid=$1 OR v.short_id=$1 OR right(v.cid,12)=$1) AND i.owner_id IS NULL',[ref.value]);
 if(!result.rows.length)throw new HttpError(404,'Public article or archived briefing not found.');
 return result.rows[0];
}
