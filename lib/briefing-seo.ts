import {pageMetadata,siteUrl} from './seo';

type Briefing = {
 title:string; translation?:{title?:string}; url:string; authors?:string[];
 publication?:string; published_at?:string;
 document?:{generatedAt?:string;briefing:{overview:string}};
};
export function briefingMetadata(item:Briefing,path:string){
 const metadata=pageMetadata(item.translation?.title||item.title,item.document?.briefing.overview.slice(0,160)||'A source-linked TBN briefing.',path);
 return {...metadata,...(!item.document?{robots:{index:false,follow:true}}:{}),openGraph:{...metadata.openGraph,type:'article' as const,...(item.document?.generatedAt?{publishedTime:item.document.generatedAt}:{})}};
}
// TBN authors the briefing; original reporting and its authors remain attributed separately.
export function briefingSchema(item:Briefing,path:string){
 if(!item.document)return null;
 const url=new URL(path,siteUrl).href;
 return {'@context':'https://schema.org','@type':'Article','@id':url+'#briefing',url,
 headline:item.translation?.title||item.title,description:item.document.briefing.overview,
 datePublished:item.document.generatedAt,
 author:{'@type':'Organization',name:'TBN',url:siteUrl},
 publisher:{'@type':'Organization',name:'TBN',url:siteUrl,logo:{'@type':'ImageObject',url:siteUrl+'/brand/tbn-512.png'}},
 mainEntityOfPage:url,isBasedOn:{'@type':'CreativeWork',url:item.url,
 ...(item.published_at?{datePublished:item.published_at}:{}),
 ...(item.publication?{publisher:{'@type':'Organization',name:item.publication}}:{}),
 ...(item.authors?.length?{author:item.authors.map(name=>({'@type':'Person',name}))}:{})}};
}
export function schemaJson(value:unknown){return JSON.stringify(value).replace(/</g,'\\u003c');}
