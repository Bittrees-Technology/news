import {publicFeedBatch} from '@/lib/public-feed';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,before=p.get('before'),snapshot=p.get('snapshot');
 if(!before||!/^[a-f0-9]{64}$/.test(before)||!snapshot||!Number.isFinite(Date.parse(snapshot))||Date.parse(snapshot)>Date.now())return Response.json({error:'Invalid feed cursor'},{status:400});
 try{return Response.json(await publicFeedBatch(new Date(snapshot).toISOString(),before),{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'Could not load older stories'},{status:503});}
}
