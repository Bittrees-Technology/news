"use client";
import {useEffect, useState, type ReactNode} from "react";
import Link from "next/link";
import {call} from "@/lib/browser-api";

type Subscription = {target: string; value: string; enabled: boolean; destination_enabled: boolean; cadence: string; delivery_time: string; time_zone: string};
export function DailyEmailSignup({emails, emailReady, addEmail}: {emails: string[]; emailReady: boolean; addEmail: ReactNode}) {
  const [email, setEmail] = useState(emails[0] || "");
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = emails.includes(email) ? email : emails[0] || "";
  const active = subscriptions?.find(s=>s.target==='main' && s.value===selected && s.enabled && s.destination_enabled);
  useEffect(()=>{let current=true;call("subscriptions").then(d=>{if(current)setSubscriptions(d.subscriptions);}).catch(e=>{if(current)setMessage(e.message);});return()=>{current=false;};},[]);
  return <section className="panel daily-email-signup">
    <p className="eyebrow">The Bittrees News</p>
    <h1>Get the daily TBN email</h1>
    <p>The day's leading stories, delivered to your inbox. Free. Unsubscribe at any time.</p>
    {!emails.length ? <>
      <h2>Verify your email</h2>
      <p>Add the email address where you want to receive the daily news.</p>
      {addEmail}
    </> : active ? <div role="status">
      <h2>You're subscribed</h2>
      <p>Your {active.cadence} TBN email goes to <strong>{selected}</strong> at {active.delivery_time || '12:00'} {active.time_zone || 'UTC'}.</p>
      <p><Link href="/account/delivery">Change delivery time, edition or pause emails</Link></p>
    </div> : <form onSubmit={async e=>{
      e.preventDefault(); if(busy || !selected || !subscriptions)return;
      setBusy(true);setMessage("");
      try {
        await call("subscriptions/email",{email:selected,confirm:true});
        const d=await call("subscriptions");setSubscriptions(d.subscriptions);
        setMessage("Subscribed. Your first email will arrive at the next scheduled daily edition.");
      } catch(e) {setMessage((e as Error).message);} finally {setBusy(false);}
    }}>
      <label className="field">Email address
        <select value={selected} onChange={e=>setEmail(e.target.value)} disabled={busy}>
          {emails.map(value=><option key={value}>{value}</option>)}
        </select>
      </label>
      <p>One daily Global edition at <strong>12:00 UTC</strong>. You can change the time and edition afterwards.</p>
      <button className="primary" disabled={busy || !emailReady || !subscriptions || !selected}>{busy ? "Subscribing…" : "Subscribe to the daily email"}</button>
      {!emailReady && <p role="status">Email delivery is currently unavailable. Please try again later.</p>}
      <p className="muted">By subscribing, you ask TBN to send the daily news to this verified email. Every email includes an unsubscribe link.</p>
      <details><summary>Use another email address</summary>{addEmail}</details>
    </form>}
    {message && <p role="status">{message}</p>}
    <p><Link href="/">Back to the news</Link> · <Link href="/account/delivery">All delivery options</Link></p>
  </section>;
}
