import {notFound} from 'next/navigation';
import {BriefingReader} from '@/components/briefing-reader';
import {briefingBatch} from '@/lib/briefing-feed';
import {briefingVersion} from '@/lib/briefing-versions';
import {briefingPath} from '@/lib/briefing-links';
import {briefingMetadata,briefingSchema,schemaJson} from '@/lib/briefing-seo';
import {cache} from 'react';
export const dynamic='force-dynamic';
const version=cache(briefingVersion);
export async function generateMetadata({params}:{params:Promise<{shortId:string}>}){
 const {shortId}=await params;const item=await version(shortId);
 return item?briefingMetadata(item,briefingPath(item)):{title:'Briefing unavailable',robots:{index:false}};
}
export default async function Page({params}:{params:Promise<{shortId:string}>}){
 const {shortId}=await params;const item=await version(shortId);if(!item)notFound();
 const older=await briefingBatch(item.id);
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:schemaJson(briefingSchema(item,briefingPath(item)))}}/><BriefingReader key={shortId} initial={{...older,entries:[item,...older.entries],selectedId:item.id}}/></>;
}
