'use client';
import {useState} from 'react';
import {call} from './client';
import type {reviewDesk,coverageEdit} from '@/lib/coverage-store';
import type {z} from 'zod';
type Draft=z.infer<typeof coverageEdit>;
type Desk=Awaited<ReturnType<typeof reviewDesk>>;
const blank=():Draft=>({id:crypto.randomUUID(),expectedVersion:0,state:'approved',title:'',reports:[],claims:[]});
export function CoverageDesk({approve}:{approve:boolean}){
  const [desk,setDesk]=useState<Desk>(),[draft,setDraft]=useState<Draft>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [history,setHistory]=useState<{version:number;edit:Draft}[]>([]);
  const [sample,setSample]=useState(false);
  async function refresh(useSample=sample){
    setBusy(true);
    try {setDesk(await call(useSample?'staff/coverage?sample=1':'staff/coverage'));setSample(useSample);setDraft(undefined);setHistory([]);setMessage('');}
    catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }
  function select(ids:string[]){
    if(!desk)return;
    const reports=ids.map(id=>{const r=desk.articles.find(r=>r.id===id)!;return {id,revision:r.revision,origin:r.reportingOrigin};});
    setHistory([]);setDraft({...blank(),reports, title:desk.articles.find(r=>r.id===ids[0])?.title||''});
  }
  function exportEvidence(){
    if(!draft||!desk)return;
    const reports=draft.reports.map(member=>{
      const row=desk.articles.find(r=>r.id===member.id&&r.revision===member.revision);
      if(!row)throw Error('Refresh and review the current reports before exporting.');
      return {id:row.id,revision:row.revision,title:row.title,excerpt:row.excerpt.slice(0,2500)};
    });
    const blob=new Blob([JSON.stringify([{format:'tbn-public-coverage-v1',id:draft.id,reports}])],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='coverage-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function importDraft(file:File){
    if(!draft||!desk)return;
    if(file.size>128000)throw Error('Choose a single bounded Acer draft.');
    const row=JSON.parse((await file.text()).trim()),proposal=row.result;
    if(row.id!==draft.id||row.valid!==true||proposal?.format!=='tbn-coverage-draft-v1'||
       !Array.isArray(proposal.reports)||proposal.reports.length!==draft.reports.length||
       !draft.reports.every(r=>proposal.reports.some((p:{id:string;revision:string})=>p.id===r.id&&p.revision===r.revision)))
        throw Error('This draft belongs to a different event or source revision.');
    if(!Array.isArray(proposal.claims)||proposal.claims.length>6||!proposal.claims.every((c:Draft['claims'][number])=>
      typeof c?.text==='string'&&c.text.length<=500&&Array.isArray(c.evidence)&&c.evidence.length>0&&c.evidence.every(e=>{
        const r=desk.articles.find(r=>r.id===e?.id);
        return draft.reports.some(m=>m.id===e?.id)&&typeof e?.quote==='string'&&e.quote.length>=10&&e.quote.length<=500&&r&&[r.title,r.excerpt].some(t=>t.includes(e.quote));
      })))throw Error('Check the draft passages against the current reports.');
    setDraft({...draft,claims:proposal.claims});setMessage('Draft loaded for editorial review.');
  }
  async function save(state:Draft['state']){
    if(!draft)return;
    setBusy(true);
    try {await call('staff/coverage',{...draft,state});setDraft(undefined);await refresh();setMessage('Event revision saved.');}
    catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="panel"><h2>Multi-source coverage</h2>
    <button disabled={busy} onClick={()=>refresh(false)}>Review recent public reports</button>
    <button disabled={busy} onClick={()=>refresh(true)}>Review tagging sample</button>
    {message&&<p role="status">{message}</p>}
    {desk&&<>
      {sample&&<details open><summary>Tagging sample ({desk.articles.length})</summary>
        {desk.articles.map(report=><details key={report.id}><summary>{report.outlet} · {report.title}</summary>
          <p>{report.excerpt}</p>
          <p>Primary country: {report.primaryCountry||'Unknown'}. Mentioned countries: {report.mentionedCountries.join(', ')||'None identified'}.</p>
          {report.subjects.map(subject=><p key={subject.id}>{subject.label} · {subject.field} · “{report[subject.field].slice(subject.start,subject.end)}”</p>)}
          {!report.subjects.length&&<p>No specific subject identified.</p>}
          <a href={report.url}>Original report</a>
        </details>)}</details>}
      <details><summary>Possible matches ({desk.pairs.length})</summary>{desk.pairs.map(p=>
        <p key={p.first+p.second}><button onClick={()=>select([p.first,p.second])}>{[p.first,p.second].map(id=>desk.articles.find(i=>i.id===id)?.title).join(' / ')}</button></p>)}</details>
      <button onClick={()=>select([])}>Create event</button>
      {desk.events.map(e=><p key={e.id}><button onClick={()=>{setHistory([]);setDraft({...e.edit,expectedVersion:e.version});}}>{e.edit.title} · {e.edit.state} · v{e.version}</button></p>)}
      {draft&&<><label className="field">Event headline<input value={draft.title} maxLength={300} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
        <label className="field">Add a public report<select value="" onChange={e=>{if(e.target.value){const r=desk.articles.find(r=>r.id===e.target.value)!;setDraft({...draft,reports:[...draft.reports,{id:r.id,revision:r.revision,origin:r.reportingOrigin}]});}}}>
          <option value="">Choose report</option>{desk.articles.filter(r=>!draft.reports.some(m=>m.id===r.id)).map(r=><option key={r.id} value={r.id}>{r.outlet} · {r.title}</option>)}</select></label>
        {draft.reports.map(r=>{const i=desk.articles.find(a=>a.id===r.id);return <fieldset key={r.id}><legend>{i?.outlet||'Report'}</legend>
          {i?<><a href={i.url}>{i.title}</a><p>{i.excerpt}</p>{i.revision!==r.revision&&<button onClick={()=>setDraft({...draft,reports:draft.reports.map(m=>m.id===r.id?{...m,revision:i.revision}:m)})}>Use current report revision</button>}</>:<a href={'/story/'+r.id}>Open individual report</a>}
          <label className="field">Original reporting credit<input value={r.origin||''} onChange={e=>setDraft({...draft,reports:draft.reports.map(m=>m.id===r.id?{...m,origin:e.target.value||null}:m)})}/></label>
          <button onClick={()=>setDraft({...draft,reports:draft.reports.filter(m=>m.id!==r.id)})}>Remove report</button></fieldset>;})}
        {draft.reports.length>=2&&<><button onClick={()=>{try{exportEvidence();}catch(e){setMessage((e as Error).message);}}}>Export public evidence for Acer</button>
          <label className="field">Import Acer draft<input type="file" accept=".json,.jsonl" onChange={e=>{const file=e.target.files?.[0];if(file)void importDraft(file).catch(e=>setMessage(e.message));}}/></label></>}
        {draft.claims.map((c,n)=>{
          const change=(value:typeof c)=>setDraft({...draft,claims:draft.claims.map((v,k)=>n===k?value:v)});
          return <fieldset key={n}><legend>Briefing claim {n+1}</legend><label className="field">Supported statement<textarea value={c.text} onChange={e=>change({...c,text:e.target.value})}/></label>
            {draft.reports.map(r=><label className="field" key={r.id}>Supporting passage from {desk.articles.find(a=>a.id===r.id)?.outlet||r.id.slice(0,8)}
              <textarea value={c.evidence.find(v=>v.id===r.id)?.quote||''} onChange={e=>change({...c,evidence:[...c.evidence.filter(v=>v.id!==r.id),...(e.target.value?[{id:r.id,quote:e.target.value}]:[])]})}/></label>)}
            <button onClick={()=>setDraft({...draft,claims:draft.claims.filter((_,k)=>k!==n)})}>Remove claim</button></fieldset>;})}
        <button disabled={draft.claims.length>=6} onClick={()=>setDraft({...draft,claims:[...draft.claims,{text:'',evidence:[]}]})}>Add supported claim</button>
        {draft.expectedVersion>0&&<><button onClick={async()=>{try{setHistory(await call('staff/coverage?event='+draft.id));}catch(e){setMessage((e as Error).message);}}}>Show revision history</button>
          {history.filter(h=>h.edit.id===draft.id && h.version<draft.expectedVersion).map(h=><button key={h.version} onClick={()=>setDraft({...h.edit,expectedVersion:draft.expectedVersion})}>Review version {h.version} for restoration</button>)}</>}
        {approve&&<><button disabled={busy} onClick={()=>save('approved')}>Approve this revision</button>
          {draft.expectedVersion>0&&<button disabled={busy} onClick={()=>save('withdrawn')}>Withdraw event</button>}</>}
      </>}
    </>}
  </section>;
}
