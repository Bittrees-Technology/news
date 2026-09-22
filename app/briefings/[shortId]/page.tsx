import {notFound} from 'next/navigation';
import {BriefingReader} from '@/components/briefing-reader';
import {briefingBatch} from '@/lib/briefing-feed';
import {briefingVersion} from '@/lib/briefing-versions';
import {pageMetadata} from '@/lib/seo';
import {cache} from 'react';
export const dynamic='force-dynamic';
const version=cache(briefingVersion);
export async function generateMetadata({params}:{params:Promise<{shortId:string}>}){
 const {shortId}=await params;const item=await version(shortId);
 return item?pageMetadata(item.title,item.document.briefing.overview.slice(0,160),`/briefings/${shortId}`):{title:'Briefing unavailable',robots:{index:false}};
}
export default async function Page({params}:{params:Promise<{shortId:string}>}){
 const {shortId}=await params;const item=await version(shortId);if(!item)notFound();
 const older=await briefingBatch(item.id);
 return <BriefingReader key={shortId} initial={{...older,entries:[item,...older.entries],selectedId:item.id}}/>;
}
