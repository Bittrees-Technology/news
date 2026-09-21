'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {call} from './client';
import {StoryContent} from './story-content';
import {loadReading,writeReading,watchReading,type ReadingState} from '@/lib/reading-sync';
type Batch={entries:any[];next:string|null;snapshot:string};
export function BriefingReader({initial}:{initial:Batch}){
 const [items,setItems]=useState(initial.entries),[next,setNext]=useState(initial.next);
 const [reading,setReading]=useState<ReadingState>({}),[signed,setSigned]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[skipped,setSkipped]=useState<string[]>([]),[loading,setLoading]=useState(false),[loadError,setLoadError]=useState('');
 const fetching=useRef(false),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  let active=true,version=0;
  const load=async()=>{const request=++version;try{const session=await call('session');const value=await loadReading(!!session.account);if(active&&request===version){setSigned(!!session.account);setReading(value);setReady(true);setError('');}}catch{if(active){setError('Could not load read status. Refresh to retry.');setReady(false);}}};
  void load();const stop=watchReading(()=>void load());window.addEventListener('news-auth',load);
  return()=>{active=false;stop();window.removeEventListener('news-auth',load);};
 },[]);
 const loadMore=useCallback(async()=>{
  if(!next||fetching.current)return;fetching.current=true;setLoading(true);setLoadError('');
  try{const response=await fetch(`/api/briefings?before=${next}&snapshot=${encodeURIComponent(initial.snapshot)}`,{cache:'no-store'});if(!response.ok)throw Error();const batch:Batch=await response.json();setItems(old=>[...new Map([...old,...batch.entries].map(i=>[i.id,i])).values()]);setNext(batch.next);}
  catch{setLoadError('Could not load older briefings. Try again.');}
  finally{fetching.current=false;setLoading(false);}
 },[next,initial.snapshot]);
 const visible=items.filter(i=>!reading[i.id]?.is_read&&!skipped.includes(i.id));
 const current=visible[0];
 // Fetch older batches only as the reader approaches the end; never poll for new posts.
 useEffect(()=>{
  if(ready&&!loadError&&next&&visible.length<3)void loadMore();
 },[ready,loadError,next,visible.length,loadMore]);
 async function advance(id:string,mark:boolean){
  if(busy)return;setBusy(id);setError('');
  try{
   if(mark){await writeReading(signed,id,'is_read',true);setReading(r=>({...r,[id]:{...(r[id]||{saved:false}),is_read:true}}));}
   setSkipped(s=>[...s,id]);
   requestAnimationFrame(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start'});});
  }catch{setError('Could not save read status. This briefing has not been dismissed.');}
  finally{setBusy(null);}
 }
 return <section className="briefing-reader">
  <div className="briefing-toolbar">
   <h1 ref={heading} tabIndex={-1}>Briefings</h1>
   <div className="briefing-controls">
    <button onClick={()=>window.location.reload()}>Refresh</button>
    <button disabled={!ready||!current||!!busy} onClick={()=>current&&void advance(current.id,true)} aria-label="Mark as read and go to next briefing">Mark as read <span aria-hidden="true">→</span></button>
   </div>
  </div>
  {error&&<p role="alert">{error}</p>}
  {!ready?<p role="status">Loading read status…</p>:<>
   {current&&<div className="briefing-entry" key={current.id}>
    <StoryContent item={current}/>
    <div className="briefing-navigation"><button disabled={!!busy} onClick={()=>void advance(current.id,false)} aria-label="Next briefing without marking as read">Next →</button></div>
   </div>}
   {!current&&!next&&!loading&&<p>You’re caught up. Refresh to check for new briefings or revisit skipped ones.</p>}
   {!current&&loading&&<p role="status">Loading older briefings…</p>}
   {loadError&&<p role="alert">{loadError}</p>}
   {loadError&&next&&<button disabled={loading} onClick={()=>void loadMore()}>Retry loading older briefings</button>}
  </>}
 </section>;
}
