import {browserApi,call} from './browser-api';
export type FeedbackChange={id:string;value:number;signed:boolean};
export function guestFeedback():Record<string,number>{
 const value=JSON.parse(localStorage.getItem('tbn-guest-votes')||'{}');
 return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}
export async function writeFeedback(signed:boolean,id:string,value:number){
 if(signed)await call('feedback',{id,value});
 else {
  const votes=guestFeedback();if(value)votes[id]=value;else delete votes[id];
  localStorage.setItem('tbn-guest-votes',JSON.stringify(votes));
 }
 // Cross-tab notification contains no account or article history.
 try{localStorage.setItem('tbn-feedback-change',String(Date.now())+Math.random());}catch{}
 window.dispatchEvent(new CustomEvent('news-vote',{detail:{id,value,signed}}));
}
const listeners=new Set<(change?:FeedbackChange)=>void>();
const notify=(event:Event)=>{
 const change=(event as CustomEvent<FeedbackChange>).detail;
 listeners.forEach(fn=>fn(change));
};
const storage=(event:StorageEvent)=>{
 if(event.key!=='tbn-feedback-change'&&event.key!=='tbn-guest-votes')return;
 // Invalidate once before subscribers reload through the shared request cache.
 browserApi.invalidate(['feedback','ranking','sources']);
 listeners.forEach(fn=>fn());
};
export function watchFeedback(listener:(change?:FeedbackChange)=>void){
 if(!listeners.size){window.addEventListener('news-vote',notify);window.addEventListener('storage',storage);}
 listeners.add(listener);
 return()=>{listeners.delete(listener);if(!listeners.size){window.removeEventListener('news-vote',notify);window.removeEventListener('storage',storage);}};
}
