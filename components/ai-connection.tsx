"use client";
import { useEffect, useState } from "react";
import { call, cachedData } from "@/lib/browser-api";
type Key = {
  id: string;
  name: string;
  scopes: string[];
  expires_at: string;
  last_used_at: string | null;
};
export function AiConnection() {
  const [keys, setKeys] = useState<Key[]>(
      () => cachedData("mcp/tokens")?.tokens ?? [],
    ),
    [name, setName] = useState("My AI curator"),
    [curate, setCurate] = useState(true),
    [publish, setPublish] = useState(false),
    [days, setDays] = useState(30),
    [secret, setSecret] = useState(""),
    [endpoint, setEndpoint] = useState("https://news.bittrees.org/api/mcp"),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [audit, setAudit] = useState<
      { action: string; status: string; created_at: string }[]
    >(() => cachedData("mcp/tokens")?.audit ?? []);
  async function load() {
    const d = await call("mcp/tokens");
    setKeys(d.tokens);
    setAudit(d.audit);
  }
  useEffect(() => {
    load().catch((e) => setStatus(e.message));
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setStatus("");
    try {
      await fn();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <h2>Connect your AI curator</h2>
        <p>
          Your AI can read rankings, add private RSS/Atom sources, refresh them
          immediately, adjust interests and feeds, and select source-grounded
          summaries. Its work runs independently of the Bittrees news desk.
        </p>
        <p>
          This connection works with MCP clients supporting an HTTP endpoint and
          a custom bearer header. OAuth-only connection screens are not
          supported yet.
        </p>
        {status && (
          <p role="status" className="notice">
            {status}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const d = await call("mcp/tokens", {
                name,
                days,
                scopes: [
                  "read",
                  ...(curate ? ["curate"] : []),
                  ...(publish ? ["publish"] : []),
                ],
              });
              setSecret(d.token);
              setEndpoint(d.endpoint);
              await load();
            });
          }}
        >
          <label className="field">
            Connection name
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="check-line">
            <input type="checkbox" checked disabled />
            Read my newspaper, sources and scores
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              checked={curate}
              onChange={(e) => setCurate(e.target.checked)}
            />
            Allow changes to my curation, sources and feeds
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
            />
            Allow my AI to publish my newspaper publicly
          </label>
          <label className="field">
            Connection expires
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>In 7 days</option>
              <option value={30}>In 30 days</option>
              <option value={90}>In 90 days</option>
            </select>
          </label>
          <button className="primary" disabled={busy}>
            Create connection key
          </button>
        </form>
        {secret && (
          <div className="notice">
            <p>
              Copy this key now. It is shown once; keep it in your AI client’s
              secret settings.
            </p>
            <label className="field">
              MCP endpoint
              <input readOnly value={endpoint} />
            </label>
            <label className="field">
              Authorization header
              <textarea readOnly value={"Bearer " + secret} />
            </label>
            <button
              onClick={() => {
                setSecret("");
                setStatus("Key hidden. You can revoke it below.");
              }}
            >
              Hide key
            </button>
          </div>
        )}
        <p>
          Tell your AI: “Use my TBN connection to add my chosen sources, create
          a Science desk feed, and adjust its ranking to my interests. Keep it
          private unless I explicitly ask you to publish.”
        </p>
      </section>
      <section className="panel">
        <h2>Your connections</h2>
        {!keys.length && <p>No AI connections yet.</p>}
        {keys.map((k) => (
          <div className="connection" key={k.id}>
            <strong>{k.name}</strong>
            <p>
              {k.scopes.join(", ")} · Expires{" "}
              {new Date(k.expires_at).toLocaleDateString()}
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await call("mcp/tokens", { id: k.id }, "DELETE");
                  setSecret("");
                  await load();
                  setStatus("Connection revoked.");
                })
              }
            >
              Revoke connection
            </button>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Recent AI activity</h2>
        {!audit.length && <p>No tool calls yet.</p>}
        {audit.map((a, n) => (
          <p key={n}>
            {a.action.replaceAll("_", " ")} · {a.status} ·{" "}
            {new Date(a.created_at).toLocaleString()}
          </p>
        ))}
      </section>
    </>
  );
}
