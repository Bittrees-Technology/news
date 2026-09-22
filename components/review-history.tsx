'use client';
import {useState} from 'react';
import {call} from './client';
import {briefingShortId} from '@/lib/briefing-links';
export function ReviewHistory({reference}:{reference:string}){
 const [entries,setEntries]=useState<any[]|null>(null),[next,setNext]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(before?:string){
  if(busy)return;setBusy(true);setError('');
  try{const result=await call('staff/reviews/history?reference='+encodeURIComponent(reference)+(before?'&before='+before:''));setEntries(old=>before?[...(old||[]),...result.entries]:result.entries);setNext(result.next);}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <details className="review-history" onToggle={e=>{if(e.currentTarget.open&&entries===null&&!busy&&!error)void load();}}>
  <summary>Flag and review history</summary>
  {entries?.length===0&&<p>No earlier actions recorded.</p>}
  <ol>{entries?.map(e=><li key={e.id}>
   <strong>{e.status==='flagged'?'Flagged for review':e.status==='approved'?'Approved':'Reviewed'}</strong> · {new Date(e.created_at).toLocaleString('en-GB',{timeZone:'UTC'})} UTC
   <p>Reviewer {e.is_you?'(you)':String(e.actor).slice(0,8)}{e.actor_role?' · '+e.actor_role.replaceAll('_','-'):''} · Briefing {e.briefing_cid?briefingShortId(e.briefing_cid):'version not recorded'}</p>
   <p className="review-note">{e.note||'No note provided.'}</p>
  </li>)}</ol>
  {busy&&<p role="status">Loading history…</p>}
  {error&&<p role="alert">{error}</p>}
  {error?<button disabled={busy} onClick={()=>void load(next||undefined)}>Retry</button>:next&&<button disabled={busy} onClick={()=>void load(next)}>Load older history</button>}
 </details>;
}
