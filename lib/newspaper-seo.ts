import {pool} from './db';
import {pageMetadata,privateMetadata} from './seo';
export async function newspaperMetadata(slug:string,feed?:string){
 const row=(await pool().query("SELECT name,description,snapshot FROM newspapers WHERE slug=$1 AND published=true AND snapshot IS NOT NULL",[slug])).rows[0];
 if(!row)return privateMetadata;
 const section=feed ? row.snapshot.feeds?.find((f:{slug:string})=>f.slug===feed) : null;
 if(feed&&!section)return privateMetadata;
 const title=row.name+(section ? ' / '+section.name : '');
 return pageMetadata(title,row.description||`Read ${title}, a source-linked newspaper published with The Bittrees News.`, '/'+encodeURIComponent(slug)+(feed?'/'+encodeURIComponent(feed):''));
}
