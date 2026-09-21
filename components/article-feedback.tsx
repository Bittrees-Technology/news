"use client";
import {useEffect,useState} from 'react';
import {call} from './client';
import {guestFeedback,writeFeedback,watchFeedback} from '@/lib/feedback-sync';
export function ArticleFeedback({id}:{id:string}){
 const [signed,setSigned]=useState(false),[vote,setVote]=useState(0),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let active=true,version=0;
  async function load(){const request=++version;setReady(false);try{
   const s=await call('session');
   const votes=s.account?await call('feedback'):guestFeedback();
   if(active&&request===version){setSigned(!!s.account);setVote(votes[id]||0);setReady(true);setError('');}
  }catch{if(active&&request===version)setError('Could not load your interests. Refresh to retry.');}}
  void load();
  const stop=watchFeedback(change=>{
   if(!change){void load();return;}
   if(change.id===id){++version;setSigned(change.signed);setVote(change.value);setReady(true);setError('');}
  });
  window.addEventListener('news-auth',load);
  return()=>{active=false;stop();window.removeEventListener('news-auth',load);};
 },[id]);
 async function rate(value:number){if(busy||!ready)return;setBusy(true);setError('');try{await writeFeedback(signed,id,vote===value?0:value);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <span className="article-feedback" data-insights-ignore="true">
 {[1,-1].map(v=><button key={v} disabled={busy||!ready} aria-pressed={vote===v} title={signed?'Click again to remove your preference':'Saved on this device only'} onClick={()=>void rate(v)}>{v===1?'Interested':'Not interested'}</button>)}
 {ready&&!signed&&<small>Guest · on this device</small>}{error&&<small role="status">{error}</small>}
 </span>;
}
