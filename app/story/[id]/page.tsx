import {BriefingReader} from '@/components/briefing-reader';
import {briefingBatch} from '@/lib/briefing-feed';
import {notFound} from 'next/navigation';
import {cache} from 'react';
import {briefingMetadata,briefingSchema,schemaJson} from '@/lib/briefing-seo';
export const dynamic='force-dynamic';
const story=cache(async(id:string)=>/^[a-f0-9]{64}$/.test(id)?briefingBatch(null,id):null);
export async function generateMetadata({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const batch=await story(id);const item=batch?.entries.find(i=>i.id===id);
 return item?briefingMetadata(item,`/story/${id}`):{title:'Story unavailable',robots:{index:false}};
}
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const batch=await story(id);const item=batch?.entries.find(i=>i.id===id);
 if(!batch||!item)notFound();const schema=briefingSchema(item,`/story/${id}`);
 return <>{schema&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:schemaJson(schema)}}/>}<BriefingReader key={id} initial={{...batch,selectedId:id}}/></>;
}
