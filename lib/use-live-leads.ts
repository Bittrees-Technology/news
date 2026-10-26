'use client';
import {useEffect,useMemo,useState} from 'react';
import type {Item} from './model';
// Refresh only the three lead positions. Older-page cursors and reader filters stay intact.
export function useLiveLeads(enabled:boolean,seed:Item[]){
 const [leads,setLeads]=useState(seed),[at,setAt]=useState(()=>Date.now());
 useEffect(()=>{setLeads(seed);},[seed]);
 useEffect(()=>{
  if(!enabled)return;
  let active=true,busy=false;const controller=new AbortController();
  async function refresh(){
   if(document.hidden||busy)return;
   busy=true;setAt(Date.now());
   try{
    const response=await fetch('/api/top-three',{signal:controller.signal});
    if(!response.ok)throw Error();
    const result=await response.json();
    if(active&&Array.isArray(result.items))setLeads(result.items);
   }catch{/* Keep the last available leads; expired stories still leave the lead positions. */}
   finally{busy=false;}
  }
  const timer=setInterval(refresh,60000);
  document.addEventListener('visibilitychange',refresh);
  return()=>{active=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[enabled]);
 return useMemo(()=>leads.filter(i=>Date.parse(i.published_at)<=at&&Date.parse(i.published_at)>at-86400000),[leads,at]);
}
