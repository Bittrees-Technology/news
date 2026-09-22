// The full CID remains authoritative. The short suffix is a database-checked alias.
export function briefingShortId(cid:string){
 if(!/^b[a-z2-7]{30,120}$/.test(cid))throw Error('Invalid briefing CID');
 return cid.slice(-12);
}
export function briefingPath(item:{id:string;cid?:string|null}){
 return item.cid?`/briefings/${briefingShortId(item.cid)}`:`/story/${item.id}`;
}
