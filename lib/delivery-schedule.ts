import {z} from 'zod';
import {periodFor} from './model';
export const deliveryTimeSchema=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const timeZoneSchema=z.string().max(80).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Choose a valid timezone.');
const formatters=new Map<string,Intl.DateTimeFormat>();
function localParts(at:Date,timeZone:string){
 if(!formatters.has(timeZone))formatters.set(timeZone,new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
 const parts=formatters.get(timeZone)!.formatToParts(at);
 return Object.fromEntries(parts.map(x=>[x.type,x.value]));
}
export function scheduledPeriod(cadence:string,at:Date,time='12:00',zone='UTC'){
 deliveryTimeSchema.parse(time);timeZoneSchema.parse(zone);
 const p=localParts(at,zone),date=`${p.year}-${p.month}-${p.day}`;
 if(`${p.hour}:${p.minute}`<time)return null;
 const day=new Date(date+'T12:00:00Z');
 if(cadence==='weekly'&&day.getUTCDay()!==1)return null;
 if(cadence==='monthly'&&p.day!=='01')return null;
 // Find the actual local wall-clock instant, including fractional-offset timezones.
 // In a spring gap, deliver at the first available minute; in a fall fold the key stays identical.
 const [h,m]=time.split(':').map(Number),target=h*60+m;
 let end:Date|null=null;
 for(let n=0;n<=1800;n++){
  const candidate=new Date(Math.floor(+at/60000)*60000-n*60000),q=localParts(candidate,zone);
  if(`${q.year}-${q.month}-${q.day}`!==date)continue;
  if(Number(q.hour)*60+Number(q.minute)>=target)end=candidate;

 }
 if(!end)return null;
 const legacy=periodFor(cadence,new Date(date+'T12:00:00Z'));
 if(!legacy)return null;
 const start=new Date(+end-(+legacy.end-+legacy.start));
 // Retain legacy key at default schedule; preference changes cannot create a second daily key.
 return {start,end,key:`${cadence}:${date}`};
}
