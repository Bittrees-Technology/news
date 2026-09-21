'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {call} from './client';
import {loadReading,writeReading,watchReading,type ReadingState} from '@/lib/reading-sync';
export function BriefingReader({entries,initialId,olderHref}:{entries:{id:string;content:ReactNode}[];initialId:string|null;olderHref:string}){
 const [reading,setReading]=useState<ReadingState>({}),[signed,setSigned]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[skipped,setSkipped]=useState<string[]>([]);
 const [selected,setSelected]=useState(initialId);
 const router=useRouter();
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  let active=true,version=0;
  const load=async()=>{const request=++version;try{const session=await call('session');const value=await loadReading(!!session.account);if(active&&request===version){setSigned(!!session.account);setReading(value);setReady(true);setError('');}}catch{if(active){setError('Could not load read status. Refresh to retry.');setReady(false);}}};
  void load();const stop=watchReading(()=>void load());window.addEventListener('news-auth',load);
  return()=>{active=false;stop();window.removeEventListener('news-auth',load);};
 },[]);
 const start=initialId?Math.max(0,entries.findIndex(e=>e.id===initialId)):0;
 const unread=entries.slice(start).filter(e=>!reading[e.id]?.is_read&&!skipped.includes(e.id));
 const current=unread.find(e=>e.id===selected)||unread[0];
 async function advance(mark:boolean){
  if(!current||busy)return;setBusy(true);setError('');
  try{
   if(mark){await writeReading(signed,current.id,'is_read',true);setReading(r=>({...r,[current.id]:{...(r[current.id]||{saved:false}),is_read:true}}));}
   setSkipped(s=>[...s,current.id]);
   const next=unread.findIndex(e=>e.id===current.id)+1;setSelected(unread[next]?.id||null);
   if(!unread[next])router.push(olderHref);else heading.current?.focus();
  }catch{setError('Could not save read status. This summary has not been dismissed.');}
  finally{setBusy(false);}
 }
 return <section className="briefing-reader">
  <div className="briefing-toolbar"><div><h1 ref={heading} tabIndex={-1}>Summary</h1><p className="muted">Newest first · Source publication time · {signed?'Read status synced to your account':'Read status saved on this browser'}</p></div><button onClick={()=>window.location.reload()}>Refresh</button></div>
  <p><Link href="/">← Back to feed</Link></p>
  {error&&<p role="alert">{error}</p>}
  {!ready?<p role="status">Loading read status…</p>:current?<>
   <div className="briefing-navigation"><button disabled={busy} onClick={()=>void advance(true)}>Mark as read & next</button><button disabled={busy} onClick={()=>void advance(false)} aria-label="Next summary">Next →</button></div>
   <div key={current.id}>{current.content}</div>
   <div className="briefing-navigation"><button disabled={busy} onClick={()=>void advance(true)}>Mark as read & next</button><button disabled={busy} onClick={()=>void advance(false)}>Next →</button></div>
  </>:<div><h2>You’re caught up</h2><p>No unread summaries remain in this selection. Refresh to check for new summaries or revisit skipped ones.</p><Link href={olderHref}>Older summaries →</Link></div>}
 </section>;
}
