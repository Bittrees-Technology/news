import type {Item} from './model';
import {sourceName} from './catalog';
import {articleTags} from './tags';
import {siteUrl} from './seo';
export const xml=(s:string)=>s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
export function rssDocument({title,description,url,self,items}:{title:string;description:string;url:string;self:string;items:Item[]}){
 const stories=items.filter(i=>Number.isFinite(new Date(i.published_at).getTime()));
 const latest=Math.max(0,...stories.map(i=>new Date(i.published_at).getTime()));
 return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>${xml(title)}</title><link>${xml(url)}</link><description>${xml(description)}</description><language>en</language><atom:link href="${xml(self)}" rel="self" type="application/rss+xml"/>${latest?`<lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>`:''}${stories.map(i=>{
 const text=i.briefing_preview||i.translation?.summary||i.summary||i.excerpt;
 const attribution=`\n\nSource: ${i.publication||sourceName(i.source_id)}${i.authors?.length?' — '+i.authors.join(', '):''}\nOriginal: ${i.url}`;
 return `<item><title>${xml(i.translation?.title||i.title)}</title><link>${xml(i.owner_id?i.url:siteUrl+'/story/'+i.id)}</link><guid isPermaLink="false">${xml('tbn:'+i.id)}</guid><pubDate>${new Date(i.published_at).toUTCString()}</pubDate><description>${xml(`<p>${xml(text)}</p><p>${xml(attribution)}</p><p><a href="${xml(i.url)}">Original source</a></p>`)}</description>${(i.authors||[]).map(a=>`<dc:creator>${xml(a)}</dc:creator>`).join('')}${articleTags(i).map(t=>`<category>${xml(t)}</category>`).join('')}<category>${xml(i.kind)}</category></item>`;
 }).join('')}</channel></rss>`;
}
