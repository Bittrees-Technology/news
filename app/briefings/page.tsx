import {BriefingLinks} from '@/components/briefing-links';
import {briefingPath} from '@/lib/briefing-links';
import {briefingMetadata} from '@/lib/briefing-seo';
import {cache} from 'react';
import {notFound} from 'next/navigation';
import {briefingBatch} from '@/lib/briefing-feed';
import {BriefingReader} from '@/components/briefing-reader';
import {pageMetadata} from '@/lib/seo';
export const dynamic='force-dynamic';
const valid=(v?:string)=>v&&/^[a-f0-9]{64}$/.test(v)?v:null;
const batchFor=cache((before:string|null,story:string|null)=>briefingBatch(before,story));
export async function generateMetadata({searchParams}:{searchParams:Promise<{story?:string;before?:string}>}){
 const {story,before}=await searchParams;
 if(before&&!valid(before))return {title:"Briefing unavailable",robots:{index:false}};
 if(story){
  const id=valid(story);if(!id)return {title:'Briefing unavailable',robots:{index:false}};
  const batch=await batchFor(null,id);const item=batch.entries.find(item=>item.id===id);
  return item?briefingMetadata(item,briefingPath(item)):{title:'Briefing unavailable',robots:{index:false}};
 }
 return pageMetadata('Briefings','Read TBN briefings from all public sources in publication order.',before?'/briefings?before='+before:'/briefings');
}
export default async function Page({searchParams}:{searchParams:Promise<{story?:string;before?:string}>}){
 const {story,before}=await searchParams;
 if((story&&!valid(story))||(before&&!valid(before)))notFound();
 const batch=await batchFor(valid(before),valid(story));
 if(story&&batch.entries[0]?.id!==story)notFound();
 return <><BriefingReader key={story||before||'latest'} initial={batch}/><BriefingLinks entries={batch.entries} next={batch.next} currentId={story}/></>;
}
