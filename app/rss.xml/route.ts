import {createHash} from 'node:crypto';
import {pool} from '@/lib/db';
import {recentPublicRanked} from '@/lib/ranking';
import {withBriefings} from '@/lib/story-documents';
import {withTranslations} from '@/lib/translation';
import {rssDocument} from '@/lib/rss';
import {siteUrl,siteName,siteDescription} from '@/lib/seo';
import type {Item} from '@/lib/model';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const query=new URL(request.url).searchParams,paper=query.get('newspaper'),feed=query.get('feed');
 let title=siteName,description=siteDescription,url=siteUrl,items:Item[];
 const self=new URL('/rss.xml',siteUrl);
 if(feed&&!paper)return new Response('A newspaper is required for a named feed.',{status:400});
 if(paper){
  if(!/^[a-z0-9-]{1,80}$/.test(paper)||(feed&&!/^[a-z0-9-]{1,80}$/.test(feed)))return new Response('Feed not found',{status:404});
  // Only the explicitly published snapshot is public, never a private draft or live account data.
  const p=(await pool().query('SELECT name,description,snapshot FROM newspapers WHERE slug=$1 AND published=true AND snapshot IS NOT NULL',[paper])).rows[0];
  if(!p)return new Response('Feed not found',{status:404,headers:{'Cache-Control':'no-store'}});
  const section=feed?p.snapshot.feeds?.find((f:{slug:string})=>f.slug===feed):null;
  if(feed&&!section)return new Response('Feed not found',{status:404});
  items=feed?section.items:p.snapshot.front;title=p.name+(feed?' / '+(section.name||feed):'');description=p.description||`Published stories from ${title}`;url+=`/${paper}`+(feed?`/${feed}`:'');self.searchParams.set('newspaper',paper);if(feed)self.searchParams.set('feed',feed);
 }else items=await recentPublicRanked();
 // Preserve owner edits in published newspapers; enrich only the main newsroom feed.
 items=await withTranslations(paper?items:await withBriefings(items.slice(0,100)));
 const body=rssDocument({title,description,url,self:self.href,items:items.slice(0,100)});
 const etag='"'+createHash('sha256').update(body).digest('hex')+'"';
 const headers={'Content-Type':'application/rss+xml; charset=utf-8','Cache-Control':paper?'no-store':'public, max-age=300','ETag':etag,'X-Content-Type-Options':'nosniff'};
 if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers});
 return new Response(body,{headers});
}
