'use client';
import {canApprove} from '@/lib/permissions';
import {briefingPath} from '@/lib/briefing-links';
import {useCallback,useEffect,useRef,useState} from 'react';
import {call} from './client';
import {ArticleFeedback} from './article-feedback';
import {StoryContent} from './story-content';
import {loadReading,writeReading,watchReading,type ReadingState} from '@/lib/reading-sync';
type Batch={entries:any[];next:string|null;snapshot:string;selectedId?:string};
export function BriefingReader({initial}:{initial:Batch}){
 const [reviewAllowed,setReviewAllowed]=useState(false);
 const [flagNote,setFlagNote]=useState('');const flagDialog=useRef<HTMLDialogElement>(null);
 const [flagged,setFlagged]=useState(false),[flagReady,setFlagReady]=useState(false),[flagBusy,setFlagBusy]=useState(false);
 const [items,setItems]=useState(initial.entries),[next,setNext]=useState(initial.next);
 const [reading,setReading]=useState<ReadingState>({}),[signed,setSigned]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[skipped,setSkipped]=useState<string[]>([]),[loading,setLoading]=useState(false),[loadError,setLoadError]=useState('');
 const fetching=useRef(false),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  let active=true,version=0;
  const load=async()=>{const request=++version;try{const session=await call('session');const value=await loadReading(!!session.account);if(active&&request===version){setSigned(!!session.account);setReviewAllowed(canApprove(session.account?.role));setReading(value);setReady(true);setError('');}}catch{if(active){setError('Could not load read status. Refresh to retry.');setReady(false);}}};
  void load();const stop=watchReading(()=>void load());window.addEventListener('news-auth',load);
  return()=>{active=false;stop();window.removeEventListener('news-auth',load);};
 },[]);
 const loadMore=useCallback(async()=>{
  if(!next||fetching.current)return;fetching.current=true;setLoading(true);setLoadError('');
  try{const response=await fetch(`/api/briefings?before=${next}&snapshot=${encodeURIComponent(initial.snapshot)}`,{cache:'no-store'});if(!response.ok)throw Error();const batch:Batch=await response.json();setItems(old=>[...new Map([...old,...batch.entries].map(i=>[i.id,i])).values()]);setNext(batch.next);}
  catch{setLoadError('Could not load older briefings. Try again.');}
  finally{fetching.current=false;setLoading(false);}
 },[next,initial.snapshot]);
 const visible=items.filter(i=>(!reading[i.id]?.is_read||i.id===initial.selectedId)&&!skipped.includes(i.id));
 const current=visible[0];
 const flagTarget=useRef<string|undefined>(undefined);flagTarget.current=current?.cid||current?.id;
 useEffect(()=>{
  let active=true;setFlagged(false);setFlagReady(false);setFlagNote('');flagDialog.current?.close();
  if(reviewAllowed&&current)void call('staff/flags?reference='+encodeURIComponent(current.cid||current.id)).then(d=>{if(active){setFlagged(d.flagged);setFlagReady(true);}}).catch(()=>{if(active)setError('Could not load the editorial flag. Reload to retry.');});
  return()=>{active=false;};
 },[reviewAllowed,current?.id,current?.cid]);
 async function flag(){
  if(!current||!reviewAllowed||!flagReady||flagBusy)return;
  setFlagBusy(true);setError('');const reference=current.cid||current.id;
  try{await call('staff/flags',{reference,note:flagNote});if(flagTarget.current===reference){setFlagged(true);setFlagNote('');flagDialog.current?.close();}}
  catch(e){setError((e as Error).message);}finally{setFlagBusy(false);}
 }
 useEffect(()=>{
  if(ready&&current)window.history.replaceState(window.history.state,'',briefingPath(current));
 },[ready,current?.id,current?.cid]);
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
 async function save(id:string){
  if(busy||!signed)return;setBusy(id);setError('');
  const value=!reading[id]?.saved;
  try{await writeReading(signed,id,'saved',value);setReading(r=>({...r,[id]:{...(r[id]||{is_read:false}),saved:value}}));}
  catch{setError('Could not save this briefing. Please try again.');}
  finally{setBusy(null);}
 }
 const preferences=current&&ready?<>
  {reviewAllowed&&<button disabled={!flagReady||flagBusy} aria-pressed={flagged} aria-label={flagged?"Add a note to this flagged briefing":"Flag for editorial review"} onClick={()=>{setFlagNote('');flagDialog.current?.showModal();}}><span aria-hidden="true">⚑</span> {flagged?"Flagged":"Flag"}</button>}
  <ArticleFeedback key={current.id} id={current.id}/>
  {signed&&<button disabled={!!busy} aria-pressed={!!reading[current.id]?.saved} onClick={()=>void save(current.id)}>{reading[current.id]?.saved?'★ Saved':'☆ Save'}</button>}
 </>:null;
 return <section className="briefing-reader">
  {reviewAllowed&&<dialog ref={flagDialog} className="flag-dialog" aria-labelledby="flag-dialog-title" onCancel={e=>{if(flagBusy)e.preventDefault();}}>
   <form onSubmit={e=>{e.preventDefault();void flag();}}>
    <h2 id="flag-dialog-title">{flagged?'Add a flag note':'Flag for editorial review'}</h2>
    <p>{current?.translation?.title||current?.title}</p>
    <label htmlFor="flag-note">Note (optional)</label>
    <textarea id="flag-note" value={flagNote} maxLength={2000} rows={4} disabled={flagBusy} placeholder="What should the editorial team check?" onChange={e=>setFlagNote(e.target.value)}/>
    <small>{flagNote.length}/2000 · Visible to editorial staff</small>
    <div className="button-row"><button type="button" disabled={flagBusy} onClick={()=>{flagDialog.current?.close();setFlagNote('');}}>Cancel</button><button disabled={flagBusy||(flagged&&!flagNote.trim())}>{flagBusy?'Saving…':flagged?'Save note':'Submit flag'}</button></div>
    {error&&<p role="alert">{error}</p>}
   </form>
  </dialog>}
  <div className="briefing-toolbar">
   <h1 ref={heading} tabIndex={-1}>Briefings</h1>
   <div className="briefing-controls">
    {preferences}
    <button disabled={!ready||!current||!!busy||flagBusy} onClick={()=>current&&void advance(current.id,true)} aria-label="Mark as read and go to next briefing">Mark as read <span aria-hidden="true">→</span></button>
   </div>
  </div>
  {error&&<p role="alert">{error}</p>}
  {!ready?<p role="status">Loading read status…</p>:<>
   {current&&<div className="briefing-entry" key={current.id}>
    <StoryContent item={current}/>
    <div className="briefing-navigation briefing-controls">
     {preferences}
     <button disabled={!!busy||flagBusy} onClick={()=>void advance(current.id,true)} aria-label="Mark as read and go to next briefing">Mark as read <span aria-hidden="true">→</span></button>
    </div>
   </div>}
   {!current&&!next&&!loading&&<p>You’re caught up. Reload the page to check for new briefings.</p>}
   {!current&&loading&&<p role="status">Loading older briefings…</p>}
   {loadError&&<p role="alert">{loadError}</p>}
   {loadError&&next&&<button disabled={loading} onClick={()=>void loadMore()}>Retry loading older briefings</button>}
  </>}
 </section>;
}
