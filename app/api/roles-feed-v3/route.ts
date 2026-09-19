import {pool} from '@/lib/db';
import {feedAuthorized,createRoleFeed} from '@/lib/role-feed-core.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 if(!feedAuthorized(request.headers.get('authorization'),process.env.ROLES_FEED_READ_TOKEN))return Response.json({error:'Feed authentication required'},{status:401,headers});
 try{
 const result=await pool().query("SELECT kind,value,role FROM news_role_grants ORDER BY kind,value LIMIT 1001");
 const rows=result.rows.map(r=>({identity:r.value,kind:r.kind,label:r.role,scope:'staff-registry'}));
 return Response.json(createRoleFeed('news.bittrees.org',rows,{coverageNote:'All explicit wallet and email staff grants. Email identities are opaque source records. Default membership and highest-role resolution across linked identities are not exported; verified source sign-in is required.',roledefs:['member','moderator','editor','admin','super_admin']}),{headers});
 }catch{return Response.json({error:'Role feed unavailable'},{status:503,headers});}
}
