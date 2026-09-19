"use client";
import { useEffect, useState } from "react";
import { canManageAccess, canReview, canApprove, canAccountSection } from "@/lib/permissions";
import { call } from "./client";
export function StaffPanel({ role, section }: { role: string; section: "access" | "editorial" }) {
  const [grants, setGrants] = useState<any[]>([]),
    [reviews, setReviews] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const staff = canReview(role);
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
            Review public articles using their article ID. Review status records
            an editorial decision; it does not remove or republish a story.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save(
                "staff/reviews",
                Object.fromEntries(new FormData(e.currentTarget)),
              );
            }}
          >
            <label>
              Article ID
              <input name="item_id" required />
            </label>
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
            <button disabled={busy}>Save review</button>
          </form>
          <ul>
            {reviews.map((r) => (
              <li key={r.item_id}>
                <strong>{r.title}</strong> — {r.status}
                <p>{r.note}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
