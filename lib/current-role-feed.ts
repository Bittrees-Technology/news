import {ecosystemAccess} from './ecosystem-client.mjs';
const root='0x1b6c450fadb7c77191f152473fc2f79dc515fa77';
// This probe checks enrollment only; it never asserts authenticated wallet proof.
export async function currentLocalRoleRows<T>(load:()=>Promise<T[]>,decide=()=>ecosystemAccess('news',[root])):Promise<T[]>{
 const authority=await decide();
 if(typeof authority?.enrolled!=='boolean')throw Error('Roles enrollment unavailable');
 // Central assignments are already available to Roles. Local records remain history.
 if(authority.enrolled)return [];
 const rows=await load();
 if(rows.length>1000)throw Error('Roster exceeds limit');
 return rows;
}
