"use client";
import {useState} from 'react';
import Link from 'next/link';
import {call} from '@/lib/browser-api';
export function EmailSubscription() {
  const [email,setEmail]=useState(''),[code,setCode]=useState(''),[id,setId]=useState(''),[busy,setBusy]=useState(false),[subscribed,setSubscribed]=useState(false),[message,setMessage]=useState('');
  return <section className="panel daily-email-signup" data-insights-ignore="true">
    <p className="eyebrow">The Bittrees News</p>
    <h1>Get the daily TBN email</h1>
    {subscribed ? <div role="status"><h2>You're subscribed</h2><p>Your daily Global news email will go to <strong>{email}</strong> at 12:00 UTC, starting with the next scheduled edition.</p><p>Every email includes a link to unsubscribe.</p></div> : <>
      <p>The day's leading stories in your inbox. Free. No sign-in needed.</p>
      <form onSubmit={async e=>{
        e.preventDefault();if(busy)return;setBusy(true);setMessage('');
        try {
          if(id){await call('subscribe/verify',{id,code});setSubscribed(true);}
          else {const result=await call('subscribe/start',{email,confirm:true});setId(result.id);setMessage('Check your inbox for an eight-digit code.');}
        }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
      }}>
        <label className="field">Email address<input name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} readOnly={!!id} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label>
        {id&&<label className="field">Verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} required value={code} disabled={busy} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label>}
        <p>One daily Global edition at <strong>12:00 UTC</strong>. Unsubscribe at any time.</p>
        <button className="primary" disabled={busy}>{busy?'Please wait…':id?'Verify & subscribe':'Send verification code'}</button>
        {id&&<p><button type="button" className="text-button" disabled={busy} onClick={()=>{setId('');setCode('');setMessage('');}}>Change email or request a new code</button></p>}
        <p className="muted">By verifying your email, you ask TBN to send you the daily news. See our <Link href="/privacy">privacy notice</Link>.</p>
      </form>
    </>}
    {message&&<p role="status">{message}</p>}
    <p><Link href="/">Back to the news</Link>{subscribed&&<> · <Link href="/account/delivery">Manage delivery options</Link></>}</p>
  </section>;
}
