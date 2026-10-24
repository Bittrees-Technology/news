import {editionPreferenceSchema} from '@/lib/top-three';
import {publicTopThree} from '@/lib/top-three-public';
export async function GET(request:Request){
 const p=new URL(request.url).searchParams;
 const parsed=editionPreferenceSchema.safeParse({scope:p.get('scope')||'global',country:p.get('country')||'',region:p.get('region')||'',city:p.get('city')||undefined});
 if(!parsed.success)return Response.json({error:'Choose a valid edition and place.'},{status:400});
 try{return Response.json(await publicTopThree(parsed.data),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return Response.json({error:'Top stories are temporarily unavailable.'},{status:503});}
}
