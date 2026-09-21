import {briefingBatch} from '@/lib/briefing-feed';
import {BriefingReader} from '@/components/briefing-reader';
import {pageMetadata} from '@/lib/seo';
export const dynamic='force-dynamic';
export const metadata=pageMetadata('Briefings','Read TBN briefings from all public sources in publication order.','/briefings');
export default async function Page({searchParams}:{searchParams:Promise<{story?:string;before?:string}>}){
 const {story,before}=await searchParams;
 const valid=(v?:string)=>v&&/^[a-f0-9]{64}$/.test(v)?v:null;
 return <BriefingReader key={story||before||'latest'} initial={await briefingBatch(valid(before),valid(story))}/>;
}
