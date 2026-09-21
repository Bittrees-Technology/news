import {briefingBatch} from '@/lib/briefing-feed';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,before=p.get('before'),snapshot=p.get('snapshot');
 if(!before||!/^[a-f0-9]{64}$/.test(before)||!snapshot||!Number.isFinite(Date.parse(snapshot))||Date.parse(snapshot)>Date.now())return Response.json({error:'Invalid briefing cursor'},{status:400});
 try{return Response.json(await briefingBatch(before,null,new Date(snapshot).toISOString()),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Could not load briefings'},{status:503});}
}
