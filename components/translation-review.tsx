'use client';
import {useEffect,useState} from 'react';
import {call} from './client';

type Row = {
  key:string;
  fingerprint:string;
  approved:boolean;
  rejected:boolean;
  original:{title:string;summary:string};
  translation:{language:string;title?:string;summary?:string};
};
export function TranslationReview() {
  const [rows,setRows]=useState<Row[]>([]);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const refresh=async()=>setRows(await call('staff/translation-reviews'));
  useEffect(()=>{void refresh().catch(e=>setMessage(e.message));},[]);
  return <section className="panel">
    <h2>Translation review</h2>
    <p>Check that the displayed copy is English and compare it with the source for meaning, who did what, names, numbers, uncertainty and unsupported claims. Approve only what you can verify. Until approval, News shows an English holding message.</p>
    {message&&<p role="status">{message}</p>}
    {!rows.length&&<p>No translations are awaiting review in this batch.</p>}
    {rows.map(row=><details key={row.key}>
      <summary>{row.approved ? "Approved · " : row.rejected ? "Held · " : "Needs review · "}{row.original.title}</summary>
      <h3>Source</h3><p>{row.original.title}</p><p>{row.original.summary}</p>
      <h3>English copy</h3>{row.translation.language==='en'?<p>The worker identified the source as English. Verify that the source above is English before approving.</p>:<><p>{row.translation.title}</p><p>{row.translation.summary}</p></>}
      <p>Reported source language: {row.translation.language}</p>
      <form onSubmit={async e=>{
        e.preventDefault();
        const form=e.currentTarget;
        const data=new FormData(form);
        const submitter=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
        const decision=submitter?.value;
        if(decision!=='approve'&&decision!=='reject')return;
        setBusy(true);
        try {
          await call('staff/translation-reviews',{key:row.key,fingerprint:row.fingerprint,decision,note:data.get('note')});
          await refresh();
          setMessage(decision==='approve'?'Translation approved.':'Translation held.');
        } catch(error) {setMessage((error as Error).message);}
        finally {setBusy(false);}
      }}>
        <label className="field">Review findings<textarea name="note" required minLength={15} maxLength={1500}/></label>
        {!row.approved && <button disabled={busy} name="decision" value="approve">Approve translation</button>}{' '}
        {!row.rejected && <button disabled={busy} name="decision" value="reject">{row.approved?"Withdraw approval":"Hold translation"}</button>}
      </form>
    </details>)}
  </section>;
}
