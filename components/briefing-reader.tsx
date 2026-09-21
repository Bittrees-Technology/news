'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {call} from './client';
import {StoryContent} from './story-content';
import {loadReading,writeReading,watchReading,type ReadingState} from '@/lib/reading-sync';
type Batch={entries:any[];next:string|null;snapshot:string};
export function BriefingReader({initial}:{initial:Batch}){
 const [items,setItems]=useState(initial.entries),[next,setNext]=useState(initial.next);
 const [reading,setReading]=useState<ReadingState>({}),[signed,setSigned]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[skipped,setSkipped]=useState<string[]>([]),[loading,setLoading]=useState(false),[loadError,setLoadError]=useState('');
 const fetching=useRef(false),sentinel=useRef<HTMLDivElement>(null),refs=useRef(new Map<string,HTMLDivElement>());
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
 useEffect(()=>{
  if(!ready||loadError||!next||!sentinel.current)return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))void loadMore();},{rootMargin:'600px'});
  observer.observe(sentinel.current);return()=>observer.disconnect();
 },[ready,loadError,next,loadMore]);
 const visible=items.filter(i=>!reading[i.id]?.is_read&&!skipped.includes(i.id));
 async function advance(id:string,mark:boolean){
  if(busy)return;setBusy(id);setError('');const following=visible[visible.findIndex(i=>i.id===id)+1]?.id;
  try{
   if(mark){await writeReading(signed,id,'is_read',true);setReading(r=>({...r,[id]:{...(r[id]||{saved:false}),is_read:true}}));}
   setSkipped(s=>[...s,id]);
   if(!following&&next)await loadMore();
   requestAnimationFrame(()=>{if(following)refs.current.get(following)?.scrollIntoView({behavior:'smooth',block:'start'});});
  }catch{setError('Could not save read status. This briefing has not been dismissed.');}
  finally{setBusy(null);}
 }
 return <section className="briefing-reader">
  <div className="briefing-toolbar"><h1>Briefings</h1><button onClick={()=>window.location.reload()}>Refresh</button></div>
  {error&&<p role="alert">{error}</p>}
  {!ready?<p role="status">Loading read status…</p>:<>
   {visible.map(i=><div className="briefing-entry" key={i.id} ref={node=>{if(node)refs.current.set(i.id,node);else refs.current.delete(i.id);}}>
    <StoryContent item={i}/>
    <div className="briefing-navigation"><button disabled={!!busy} onClick={()=>void advance(i.id,true)}>Mark as read</button><button disabled={!!busy} onClick={()=>void advance(i.id,false)} aria-label="Next briefing">Next →</button></div>
   </div>)}
   {!visible.length&&!next&&!loading&&<p>You’re caught up. Refresh to check for new briefings or revisit skipped ones.</p>}
   <div ref={sentinel} aria-live="polite">{loading?'Loading older briefings…':null}</div>
   {loadError&&<p role="alert">{loadError}</p>}
   {next&&<button disabled={loading} onClick={()=>void loadMore()}>{loadError?'Retry':'Load more briefings'}</button>}
  </>}
 </section>;
}
