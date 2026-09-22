"use client";
import { useEffect, useState } from "react";
import { canManageAccess, canReview, canApprove, canAccountSection } from "@/lib/permissions";
import {briefingPath,briefingShortId} from "@/lib/briefing-links";
import { call } from "./client";
export function StaffPanel({ role, section }: { role: string; section: "access" | "editorial" }) {
  const [grants, setGrants] = useState<any[]>([]),
    [reviews, setReviews] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [reference,setReference]=useState(''),[target,setTarget]=useState<any>(null);
  const staff = canReview(role);
  async function resolve(reference:string){
    setBusy(true);setMessage('');setTarget(null);
    try{setTarget(await call('staff/reviews?reference='+encodeURIComponent(reference)));}
    catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }
  useEffect(()=>{if(section==='editorial'){const ref=new URLSearchParams(window.location.search).get('reference');if(ref){setReference(ref);void resolve(ref);}}},[section]);
  async function refresh() {
    if (section === "access" && canManageAccess(role)) setGrants(await call("staff/roles"));
    if (section === "editorial" && staff) setReviews(await call("staff/reviews"));
  }
  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, [role, section]);
  async function save(path: string, data: unknown) {
    setBusy(true);
    setMessage("");
    try {
      await call(path, data);
      await refresh();
      if(path==='staff/reviews'&&target)setTarget(await call('staff/reviews?reference='+encodeURIComponent(target.briefing_cid||target.item_id)));
      setMessage("Saved.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!canAccountSection(section, role)) return <section className="panel"><h2>Access restricted</h2><p>Your account role does not have access to this section.</p></section>;
  return (
    <section className="panel">
      <h2>{section === "access" ? "Access" : "Editorial review"}</h2>
      <p>
        Your role: <strong>{role.replaceAll("_", "-")}</strong>
      </p>
      {message && <p role="status">{message}</p>}
      {section === "access" && canManageAccess(role) && (
        <>
          <h3>Account roles</h3>
          <p>Members manage their own newspaper and sign-in methods. Moderators flag and review articles. Editors also approve articles. Admins also see scores and processing diagnostics. Super-admins also assign roles. Staff roles do not grant access to another user’s private newspaper or sign-in methods.</p>
          <p>
            Assign access to a verified email or wallet. Protected super-admin
            identities cannot be changed here.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save("staff/roles", Object.fromEntries(f));
            }}
          >
            <label>
              Identity type
              <select name="kind">
                <option value="email">Email</option>
                <option value="wallet">Wallet address</option>
              </select>
            </label>
            <label>
              Verified identity
              <input name="value" required maxLength={254} />
            </label>
            <label>
              Role
              <select name="role">
                {["member", "moderator", "editor", "admin", "super_admin"].map(
                  (r) => (
                    <option key={r} value={r}>
                      {r.replaceAll("_", "-")}
                    </option>
                  ),
                )}
              </select>
            </label>
            <button disabled={busy}>Save role</button>
          </form>
          <ul>
            {grants.map((g) => (
              <li key={g.kind + g.value}>
                {g.value} — {g.role.replaceAll("_", "-")}
                {g.protected ? " (protected)" : ""}
              </li>
            ))}
          </ul>
        </>
      )}
      {section === "editorial" && staff && (
        <>
          <h3>Article review</h3>
          <p>
            Look up an article ID, briefing ID, full CID or TBN briefing link.
            Reviews retain the selected briefing version; they do not remove or republish a story.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if(!target)return;
              const form=Object.fromEntries(new FormData(e.currentTarget));
              save("staff/reviews",{...form,item_id:target.briefing_cid||target.item_id,expected_cid:target.briefing_cid});
            }}
          >
            <label>
              Article or briefing reference
              <input value={reference} onChange={e=>{setReference(e.target.value);setTarget(null);}} required maxLength={300}/>
              <button type="button" disabled={busy||!reference.trim()} onClick={()=>void resolve(reference)}>Find article / briefing</button>
            </label>
            {target&&<div className="notice"><strong>{target.title}</strong><p className="editorial-id">Article ID: {target.item_id}</p><p>Briefing ID: {target.briefing_cid?(target.review_status==='flagged'?<a href={briefingPath({id:target.item_id,cid:target.briefing_cid})}>{briefingShortId(target.briefing_cid)}</a>:briefingShortId(target.briefing_cid)):'Not archived yet'}</p><a href={target.url} target="_blank" rel="noopener noreferrer">Original source ↗</a></div>}
            <label>
              Status
              <select name="status">
                <option value="flagged">Flag for review</option>
                <option value="reviewed">Reviewed</option>
                {canApprove(role) && (
                  <option value="approved">Approved</option>
                )}
              </select>
            </label>
            <label>
              Review note
              <textarea name="note" required minLength={3} maxLength={2000} />
            </label>
            <button disabled={busy||!target}>Save review</button>
          </form>
          <ul>
            {reviews.map((r) => (
              <li key={r.item_id}>
                <strong>{r.title}</strong> — {r.status}
                <p className="editorial-id">Article ID: {r.item_id}</p>
                <p>Reviewed briefing: {r.briefing_cid?<>{r.status==='flagged'?<a href={briefingPath({id:r.item_id,cid:r.briefing_cid})}>{briefingShortId(r.briefing_cid)}</a>:briefingShortId(r.briefing_cid)} · <a href={`https://ipfs.io/ipfs/${r.briefing_cid}`} target="_blank" rel="noopener noreferrer">IPFS ↗</a></>:'Version not recorded'}</p>
                {r.current_cid&&r.current_cid!==r.briefing_cid&&<p>Current briefing: {briefingShortId(r.current_cid)} — not the recorded reviewed version.</p>}
                <button disabled={busy} onClick={()=>{const ref=r.briefing_cid||r.item_id;setReference(ref);void resolve(ref);}}>Review this version</button>
                <p>{r.note}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
