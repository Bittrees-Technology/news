"use client";
import {useEffect,useState} from 'react';
import {call} from './client';
export function ArticleFeedback({id}:{id:string}){
 const [signed,setSigned]=useState(false),[vote,setVote]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;async function load(){setVote(0);setSigned(false);try{const s=await call('session');if(!active)return;setSigned(!!s.account);if(s.account){const votes=await call('feedback');if(active)setVote(votes[id]||0);}else if(active){setVote(JSON.parse(localStorage.getItem('tbn-guest-votes')||'{}')[id]||0);}}catch{}}
 void load();window.addEventListener('news-auth',load);return()=>{active=false;window.removeEventListener('news-auth',load);};},[id]);
 async function rate(value:number){if(busy)return;setBusy(true);setError('');try{const next=vote===value?0:value;if(signed)await call('feedback',{id,value:next});else {const votes=JSON.parse(localStorage.getItem('tbn-guest-votes')||'{}');if(next)votes[id]=next;else delete votes[id];localStorage.setItem('tbn-guest-votes',JSON.stringify(votes));}setVote(next);window.dispatchEvent(new CustomEvent('news-vote',{detail:{id,value:next}}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <span className="article-feedback" data-insights-ignore="true">
 {[1,-1].map(v=><button key={v} disabled={busy} aria-pressed={vote===v} aria-label={v===1?'Thumbs up: useful article':'Thumbs down: not useful'} title={signed?'Click again to remove your vote':'Guest vote: saved on this device only'} onClick={()=>void rate(v)}>{v===1?'👍':'👎'}</button>)}
 {!signed&&<small>Guest · on this device</small>}{error&&<small role="status">{error}</small>}
 </span>;
}
