import {pool} from '@/lib/db';
import {feedAuthorized,signRoleFeed} from '@/lib/roles-feed';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 const headers={'Cache-Control':'private, no-store'};
 if(!feedAuthorized(request.headers.get('authorization'),process.env.ROLES_FEED_READ_TOKEN))return Response.json({error:'Feed authentication required'},{status:401,headers});
 try {
  if(!process.env.ROLES_FEED_PRIVATE_KEY)throw Error('Feed unavailable');
  const result=await pool().query("SELECT value,role FROM news_role_grants WHERE kind='wallet' ORDER BY value LIMIT 1001");
  if(result.rows.length>1000)throw Error('Roster exceeds limit');
  return Response.json(signRoleFeed(result.rows,process.env.ROLES_FEED_PRIVATE_KEY),{headers});
 } catch {return Response.json({error:'Role feed unavailable'},{status:503,headers});}
}
