"use client";
import { useEffect, useState } from "react";
import { call } from "./client";
export function StaffPanel({ role }: { role: string }) {
  const [grants, setGrants] = useState<any[]>([]),
    [reviews, setReviews] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const staff = ["moderator", "editor", "admin", "super_admin"].includes(role);
  async function refresh() {
    if (role === "super_admin") setGrants(await call("staff/roles"));
    if (staff) setReviews(await call("staff/reviews"));
  }
  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, [role]);
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
  return (
    <section>
      <h2>Access and editorial review</h2>
      <p>
        Your role: <strong>{role.replaceAll("_", "-")}</strong>
      </p>
      {message && <p role="status">{message}</p>}
      {role === "super_admin" && (
        <>
          <h3>Team roles</h3>
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
      {staff && (
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
                {role !== "moderator" && (
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
