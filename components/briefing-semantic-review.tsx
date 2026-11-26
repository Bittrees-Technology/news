'use client';
import {useEffect,useState} from 'react';
import {call} from './client';
type Row={id:string;title:string;source:string;url:string;fingerprint:string;approved:boolean;failed:boolean;briefing:{overview:string;points:string[];context:string;limitations:string}};
export function BriefingSemanticReview(){
 const [rows,setRows]=useState<Row[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const refresh=async()=>setRows(await call('staff/briefing-semantic-reviews'));
 useEffect(()=>{void refresh().catch(e=>setMessage(e.message));},[]);
 return <section className="panel"><h2>Cross-language briefing review</h2>
 <p>Compare the original source with every claim in the English briefing. Check who did what, names, numbers, uncertainty and unsupported claims. Approve only when you understand the source language and the available evidence supports the briefing. Otherwise hold it.</p>
 {message&&<p role="status">{message}</p>}{!rows.length&&<p>No briefings in this review batch.</p>}
 {rows.map(row=><details key={row.id}><summary>{row.approved?'Approved':'Needs review'} · {row.title}</summary>
 <h3>Source</h3><p>{row.title}</p><p>{row.source}</p><p><a href={row.url} target="_blank" rel="noreferrer">Read original source</a></p>
 <h3>Generated briefing</h3><p>{row.briefing.overview}</p><ul>{row.briefing.points.map((point,i)=><li key={i}>{point}</li>)}</ul><p>{row.briefing.context}</p><p>{row.briefing.limitations}</p>
 {row.failed&&<p>Source evidence is an error message; approval is disabled.</p>}
 <form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const data=new FormData(form);const decision=((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null)?.value;if(decision!=='approve'&&decision!=='reject')return;setBusy(true);try{await call('staff/briefing-semantic-reviews',{id:row.id,fingerprint:row.fingerprint,decision,note:data.get('note')});await refresh();setMessage(decision==='approve'?'Briefing approved.':'Briefing held.');}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}}>
 <label className="field">Review findings<textarea name="note" required minLength={15} maxLength={1500}/></label>
 {!row.approved&&<button disabled={busy||row.failed} name="decision" value="approve">Approve briefing</button>}{' '}
 <button disabled={busy} name="decision" value="reject">{row.approved?'Withdraw approval':'Hold briefing'}</button>
 </form></details>)}
 </section>;
}
