import type {Source} from './catalog';
export function collectionMinutes(source:Pick<Source,'type'|'kind'|'pollMinutes'>){
 if(source.pollMinutes)return Math.max(15,Math.min(1440,source.pollMinutes));
 if(source.kind==='worldbank')return 1440;
 if(source.type==='podcast'||['github','hfpapers','reddit'].includes(source.kind))return 60;
 return 15;
}
export function retryMinutes(base:number,failures:number,status?:number,retryAfterSeconds=0){
 const delay=status===401||status===403?1440:Math.min(360,base*2**Math.min(failures,8));
 return Math.max(base,delay,Math.min(10080,Math.ceil(retryAfterSeconds/60)));
}

export function isOverdue(nextPoll:string|Date|null,minutes:number,now=Date.now()){return !!nextPoll && now>new Date(nextPoll).getTime()+minutes*60000;}
