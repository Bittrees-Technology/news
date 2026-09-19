import {createHash,sign,timingSafeEqual} from 'node:crypto';
export function feedAuthorized(header:string|null,secret:string|undefined) {
 if(!secret || secret.length<32 || !header) return false;
 const a=Buffer.from(header),b=Buffer.from('Bearer '+secret);
 return a.length===b.length && timingSafeEqual(a,b);
}
export function signRoleFeed(rows:{value:string;role:string}[],privateKey:string,now=Date.now()) {
 const labels=['member','moderator','editor','admin','super_admin'];
 const roles:Record<string,{label:string}[]>={};
 for(const r of rows) {
  if(!/^0x[0-9a-f]{40}$/i.test(r.value)||!labels.includes(r.role))throw Error('Invalid wallet role');
  const wallet=r.value.toLowerCase();if(roles[wallet])throw Error('Duplicate wallet');
  roles[wallet]=[{label:r.role}];
 }
 const content={roles,roledefs:labels.map(label=>({label})),tags:null,tagdefs:null};
 const data={schemaVersion:2,source:'news.bittrees.org',audience:'https://roles.bittrees.org',generatedAt:new Date(now).toISOString(),revision:createHash('sha256').update(JSON.stringify(content)).digest('hex'),...content,coverageNote:'Explicit wallet staff grants only. Email-only grants, default members and linked-identity effective access are not imported.'};
 return {data,signature:sign(null,Buffer.from(JSON.stringify(data)),privateKey).toString('base64')};
}
