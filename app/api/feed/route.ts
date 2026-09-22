import {publicFeedBatch,type FeedCategory} from '@/lib/public-feed';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,before=p.get('before'),snapshot=p.get('snapshot'),category=p.get('category')||'all',balance=p.get('balanced')||'0';
 if(!['0','1'].includes(balance)||(before!==null&&!/^[a-f0-9]{64}$/.test(before))||!['all','news','podcasts','data'].includes(category)||!snapshot||!Number.isFinite(Date.parse(snapshot))||Date.parse(snapshot)>Date.now())return Response.json({error:'Invalid feed cursor'},{status:400});
 try{return Response.json(await publicFeedBatch(new Date(snapshot).toISOString(),before,category as FeedCategory,balance==='1'),{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'Could not load older stories'},{status:503});}
}
