import { call } from './browser-api';
export type ReadingState = Record<string,{is_read:boolean;saved:boolean}>;
export function guestReading(): ReadingState {
  const parsed=JSON.parse(localStorage.getItem('bittrees-news-reading')||'{}');
  return parsed && typeof parsed==='object' && !Array.isArray(parsed) ? parsed : {};
}
export async function loadReading(signed:boolean):Promise<ReadingState> {
  if(!signed)return guestReading();
  return Object.fromEntries((await call('reading')).map((r:{item_id:string;is_read:boolean;saved:boolean})=>[r.item_id,r]));
}
export async function writeReading(signed:boolean,id:string,field:'saved'|'is_read',value:boolean){
  if(signed)await call('reading',{id,field,value});
  else {
    const current=guestReading();
    current[id]={...(current[id]||{is_read:false,saved:false}),[field]:value};
    localStorage.setItem('bittrees-news-reading',JSON.stringify(current));
  }
  // Cross-tab signal contains no account identifiers or article history.
  try{localStorage.setItem('tbn-reading-change',String(Date.now())+Math.random());}catch{}
  window.dispatchEvent(new Event('news-reading'));
}
export function watchReading(refresh:()=>void){
  const storage=(event:StorageEvent)=>{if(event.key==='bittrees-news-reading'||event.key==='tbn-reading-change')refresh();};
  window.addEventListener('news-reading',refresh);window.addEventListener('storage',storage);window.addEventListener('focus',refresh);window.addEventListener('pageshow',refresh);
  return()=>{window.removeEventListener('news-reading',refresh);window.removeEventListener('storage',storage);window.removeEventListener('focus',refresh);window.removeEventListener('pageshow',refresh);};
}
