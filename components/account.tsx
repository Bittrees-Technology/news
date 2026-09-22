"use client";
import {RoleSwitcher} from "./role-switcher";
import { TopicSettings } from "./topic-settings";
import { Subscriptions } from "./subscriptions";
import { canAccountSection } from "@/lib/permissions";
import { StaffPanel } from "./staff-panel";
import { Analytics } from "./analytics";
import { AiConnection } from "./ai-connection";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NewspaperSettings } from "./newspaper-settings";
import { call } from "./client";
import { cachedData, prefetchAccountSection } from "@/lib/browser-api";
import { sources, topics } from "@/lib/catalog";
import { defaults, type Preferences } from "@/lib/model";
type Identity = { kind: string; value: string };
type Destination = {
  id: string;
  kind: string;
  value: string;
  enabled: boolean;
  cadence: string;
  reachable: boolean;
  nextDelivery: string | null;
};
type Connection = {
  id: string;
  name: string;
  url: string;
  status: string;
  error?: string;
  share_public?: boolean;
};
type Delivery = {
  id: string;
  period: string;
  status: string;
  value: string;
  error?: string;
};
type AccountData = {
  account: { id: string; role?: string } | null;
  preferences?: Preferences;
  identities?: Identity[];
  destinations?: Destination[];
  connections?: Connection[];
  deliveries?: Delivery[];
  emailReady: boolean;
  walletReady?: boolean;
};
async function walletProof(purpose: string) {
  const ethereum = (
    window as unknown as {
      ethereum?: {
        request: (args: {
          method: string;
          params?: unknown[];
        }) => Promise<unknown>;
      };
    }
  ).ethereum;
  if (!ethereum)
    throw Error(
      "Open this site in your Ethereum wallet browser, or enable your browser wallet extension.",
    );
  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  const chain = (await ethereum.request({ method: "eth_chainId" })) as string;
  const c = await call("auth/start", {
    kind: "wallet",
    value: accounts[0],
    purpose,
    chainId: parseInt(chain, 16),
  });
  const bytes = new TextEncoder().encode(c.message);
  const hex =
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  const proof = await ethereum.request({
    method: "personal_sign",
    params: [hex, accounts[0]],
  });
  await call("auth/verify", { id: c.id, proof });
}
export type AccountSection =
  | "newspaper"
  | "topics"
  | "sources"
  | "delivery"
  | "access"
  | "editorial"
  | "settings"
  | "analytics"
  | "ai";
const accountTabs: [AccountSection, string, string][] = [
  ["newspaper", "Your newspaper", "/account"],
  ["topics", "Topics & interests", "/account/topics"],
  ["sources", "Sources & feeds", "/account/sources"],
  ["delivery", "Delivery", "/account/delivery"],
  ["analytics", "Analytics", "/account/analytics"],
  ["ai", "AI connection", "/account/ai"],
  ["access", "Access", "/account/access"],
  ["editorial", "Editorial review", "/account/editorial"],
  ["settings", "Sign-in methods", "/account/settings"],
];
export function Account({
  section = "newspaper",
}: {
  section?: AccountSection;
}) {
  const router = useRouter();
  const [data, setData] = useState<AccountData | null>(
      () => cachedData("account") || null,
    ),
    [prefs, setPrefs] = useState<Preferences>(
      () => cachedData("account")?.preferences || defaults,
    ),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [challenge, setChallenge] = useState<{
      id: string;
      purpose: string;
    } | null>(null),
    [search, setSearch] = useState(""),
    [feedName, setFeedName] = useState(""),
    [feedUrl, setFeedUrl] = useState(""),
    [feedTopic, setFeedTopic] = useState("Tech"),
    [sourceStatuses, setSourceStatuses] = useState<Record<string, string>>({}),
    [deleteConfirm, setDeleteConfirm] = useState(false),
    [deletePhrase,setDeletePhrase]=useState(''),
    [deleteAcknowledged,setDeleteAcknowledged]=useState(false);
  function cancelDeletion(){setDeleteConfirm(false);setDeletePhrase('');setDeleteAcknowledged(false);}
  useEffect(()=>{cancelDeletion();},[section,data?.account?.id]);
  async function load() {
    const d = await call("account");
    setData(d);
    if (d.preferences) setPrefs(d.preferences);
  }
  useEffect(() => {
    load().catch((e) => setStatus(e.message));
  }, []);
  useEffect(() => {
    if (section !== "sources" || !data?.account) return;
    call("sources")
      .then((d) =>
        setSourceStatuses(
          Object.fromEntries(
            d.sources.map(
              (s: {
                id: string;
                status: string;
                source_score?: number | null;
              }) => [
                s.id,
                (s.status || "unchecked") +
                  (s.source_score != null
                    ? ` · Consistency ${s.source_score}/100`
                    : ""),
              ],
            ),
          ),
        ),
      )
      .catch(() => {});
  }, [section, data?.account?.id]);
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
  async function startEmail(purpose: string) {
    await run(async () => {
      const d = await call("auth/start", {
        kind: "email",
        value: email,
        purpose,
      });
      setChallenge({ id: d.id, purpose });
      setStatus("Check your inbox for an eight-digit code.");
    });
  }
  async function verifyEmail() {
    await run(async () => {
      await call("auth/verify", { id: challenge!.id, proof: code });
      setChallenge(null);
      setCode("");
      setEmail("");
      await load();
      setStatus("Email verified.");
    });
  }
  async function wallet(purpose: string) {
    await run(async () => {
      await walletProof(purpose);
      await load();
      setStatus(
        purpose === "destination"
          ? "Wallet verified. Choose a schedule once its messaging inbox is ready."
          : "Wallet verified.",
      );
    });
  }
  const statusBox = status ? (
    <p className="notice" role="status">
      {status}
    </p>
  ) : null;
  if (!data)
    return <div className="empty">{status || "Loading your account…"}</div>;
  const emailForm = (purpose: string) => (
    <>
      <label className="field">
        Email address
        <input
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </label>
      {challenge ? (
        <>
          <label className="field">
            Verification code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
            />
          </label>
          <div className="button-row">
            <button
              className="primary"
              disabled={busy || code.length !== 8}
              onClick={verifyEmail}
            >
              Verify email
            </button>
            <button onClick={() => setChallenge(null)}>Start again</button>
          </div>
        </>
      ) : (
        <button
          className="primary"
          disabled={busy || !email || !data.emailReady}
          onClick={() => startEmail(purpose)}
        >
          Send verification code
        </button>
      )}
      {!data.emailReady && (
        <p>
          Email verification is being activated. You can sign in with a wallet.
        </p>
      )}
    </>
  );
  if (!data.account)
    return (
      <>
        <div className="edition-head">
          <div>
            <h1>Your newspaper, your way.</h1>
            <p className="account-intro muted">
              Reading is free and needs no account. Sign up to choose your
              sources, save stories across devices, and receive your own digest.
            </p>
          </div>
        </div>
        <section className="panel auth-box">
          <h2>Sign in or create an account</h2>
          {emailForm("login")}
          <div className="button-row">
            <button disabled={busy} onClick={() => wallet("login")}>
              Continue with a wallet
            </button>
          </div>
          <p>
            Ethereum-compatible wallets. Signing in never authorizes a
            transaction.
          </p>
          {statusBox}
          <p>
            By continuing, you agree to the <a href="/terms">terms</a> and
            acknowledge the <a href="/privacy">privacy notice</a>.
          </p>
        </section>
      </>
    );
  const filtered = sources.filter((s) =>
    (s.name + " " + s.topic + " " + s.type)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  function toggle(key: "topics" | "sources", value: string) {
    setPrefs((p) => ({
      ...p,
      [key]: p[key].includes(value)
        ? p[key].filter((x) => x !== value)
        : [...p[key], value],
    }));
  }
  return (
    <>
      <div className="edition-head">
        <div>
          <h1>{accountTabs.find((t) => t[0] === section)?.[1]}</h1>
          <p className="muted">
            Your selections shape your edition and deliveries. The public
            newspaper stays open to everyone.
          </p>
        </div>
      </div>
      <label className="account-section-picker">
        Account section
        <select value={section} onChange={e=>{
          const tab=accountTabs.find(([key])=>key===e.target.value&&canAccountSection(key,data.account?.role));
          if(tab){prefetchAccountSection(tab[0]);router.push(tab[2]);}
        }}>
          {accountTabs.filter(([key])=>canAccountSection(key,data.account?.role)).map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <nav className="account-tabs account-workspace-tabs" aria-label="Your newspaper settings">
        {accountTabs.filter(([key]) => canAccountSection(key, data.account?.role)).map(([key, label, href]) => (
          <Link
            key={key}
            href={href}
            prefetch={true}
            onMouseEnter={() => prefetchAccountSection(key)}
            onFocus={() => prefetchAccountSection(key)}
            aria-current={section === key ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {statusBox}
      {(section === "access" || section === "editorial") && (
        <StaffPanel section={section} role={data.account?.role || "member"} />
      )}
      {section === "newspaper" && (
        <NewspaperSettings connections={data.connections} />
      )}
      {section === "analytics" && (
        <Analytics role={data.account?.role || "member"} />
      )}
      {section === "ai" && <AiConnection />}
      {section === "topics" && <TopicSettings initial={prefs} onSaved={setPrefs} />}
      {section === "sources" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await call("preferences", prefs);
              setStatus(
                "Preferences saved. Your front cover and deliveries will use them.",
              );
            });
          }}
        >
          {section === "sources" && (
            <section className="panel">
              <h2>Sources & public data connections</h2>
              <p>
                {sources.length} curated endpoints. Leave sources unselected to
                include all. These public connections do not require sharing an
                account or API key.
              </p>
              <label className="field">
                Find a source
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Publisher, topic, podcast or data…"
                />
              </label>
              <div className="button-row">
                <button
                  type="button"
                  onClick={() => setPrefs({ ...prefs, sources: [] })}
                >
                  Include all sources
                </button>
                <span className="muted">
                  {prefs.sources.length
                    ? `${prefs.sources.length} selected`
                    : "All sources included"}
                </span>
              </div>
              <div className="source-picker">
                {filtered.map((s) => (
                  <label className="source-option" key={s.id}>
                    <input
                      type="checkbox"
                      checked={prefs.sources.includes(s.id)}
                      onChange={() => toggle("sources", s.id)}
                    />
                    <div>
                      <span>{s.name}</span>
                      <small>
                        {s.topic} ·{" "}
                        {s.type === "data"
                          ? "Data connection"
                          : s.type === "podcast"
                            ? "Podcast"
                            : "News / research"}{" "}
                        · {sourceStatuses[s.id] || "Not checked yet"}
                      </small>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          )}
          <div className="sticky-save">
            <button className="primary" disabled={busy}>
              {busy ? "Working…" : "Save preferences"}
            </button>
            <a href="/">Read the newspaper</a>
          </div>
        </form>
      )}
      {section === "sources" && (
        <section className="panel">
          <h2>Your own feeds</h2>
          <p>
            Add up to ten public RSS or Atom feeds. They are visible only in
            your account and personal deliveries unless you explicitly enable
            public sharing below.
          </p>
          {data.connections?.map((c) => (
            <div className="connection" key={c.id}>
              <strong>{c.name}</strong>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={!!c.share_public}
                  disabled={busy}
                  onChange={(e) => {
                    const share = e.target.checked;
                    void run(async () => {
                      await call("connections/share", { id: c.id, share });
                      await load();
                    });
                  }}
                />
                Allow stories from this source in my published newspaper
              </label>
              <p>
                {c.status}
                {c.error ? ": " + c.error : ""}
              </p>
              <button
                onClick={() =>
                  run(async () => {
                    await call("connections", { id: c.id }, "DELETE");
                    await load();
                  })
                }
              >
                Remove feed
              </button>
            </div>
          ))}
          <div className="form-grid">
            <label className="field">
              Feed name
              <input
                value={feedName}
                onChange={(e) => setFeedName(e.target.value)}
              />
            </label>
            <label className="field">
              Topic
              <select
                value={feedTopic}
                onChange={(e) => setFeedTopic(e.target.value)}
              >
                {topics.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            HTTPS feed URL
            <input
              type="url"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="https://example.org/feed.xml"
            />
          </label>
          <button
            disabled={busy || !feedName || !feedUrl}
            onClick={() =>
              run(async () => {
                await call("connections", {
                  name: feedName,
                  url: feedUrl,
                  topic: feedTopic,
                });
                setFeedName("");
                setFeedUrl("");
                await load();
                setStatus("Feed checked and connected.");
              })
            }
          >
            Check & add feed
          </button>
        </section>
      )}
      {section === "delivery" && (
        <>
          <Subscriptions
            destinationVersion={JSON.stringify(
              (data.destinations || []).map((d) => [d.id, d.enabled]),
            )}
            onChange={load}
          />
          <section className="panel">
            <h2>Verified delivery destinations</h2>
            <p>
              Email comes from main@bittrees.org. Wallet delivery uses Chirpy /
              XMTP when the Bittrees sender is active. Each destination is
              verified separately and starts paused.
            </p>
            <p>
              Daily at 12:00 UTC. Weekly on Monday. Monthly on the first.
              Delivery follows the main 11:57 edition.
            </p>
            {!data.walletReady && (
              <p className="notice">
                Chirpy delivery is awaiting sender authorization. You can verify
                your destination now; sending stays paused.
              </p>
            )}
            {data.destinations?.map((d) => (
              <div className="destination" key={d.id}>
                <strong>{d.value}</strong>
                <p>
                  {d.kind === "email"
                    ? "Verified email"
                    : d.reachable
                      ? "Verified wallet · XMTP available"
                      : "Verified wallet · awaiting XMTP availability"}
                </p>
                <div className="button-row">
                  <select
                    aria-label={"Delivery frequency for " + d.value}
                    value={d.cadence}
                    onChange={(e) =>
                      run(async () => {
                        await call("destinations", {
                          id: d.id,
                          enabled: false,
                          cadence: e.target.value,
                        });
                        await load();
                      })
                    }
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <button
                    className={d.enabled ? "" : "primary"}
                    disabled={
                      busy ||
                      (d.kind === "wallet" &&
                        (!data.walletReady || !d.reachable))
                    }
                    onClick={() =>
                      run(async () => {
                        await call("destinations", {
                          id: d.id,
                          enabled: !d.enabled,
                          cadence: d.cadence,
                        });
                        await load();
                      })
                    }
                  >
                    {d.enabled ? "Pause delivery" : "Enable delivery"}
                  </button>
                  <button
                    onClick={() =>
                      run(async () => {
                        await call("destinations", { id: d.id }, "DELETE");
                        await load();
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
                <p>
                  {d.enabled
                    ? "Next delivery: " +
                      new Date(d.nextDelivery!).toLocaleString("en-GB", {
                        timeZone: "UTC",
                      }) +
                      " UTC"
                    : "Paused. No scheduled messages will be sent."}
                </p>
              </div>
            ))}
            <h3>Add a forwarding destination</h3>
            {emailForm("destination")}
            <div className="button-row">
              <button disabled={busy} onClick={() => wallet("destination")}>
                Verify a wallet destination
              </button>
            </div>
          </section>
          <section className="panel">
            <h2>Delivery history</h2>
            {!data.deliveries?.length ? (
              <p>
                No deliveries yet. Verified destinations begin paused until you
                enable them.
              </p>
            ) : (
              data.deliveries.map((d) => (
                <div className="connection" key={d.id}>
                  <strong>{d.period}</strong>
                  <p>
                    {d.value} · {d.status}
                  </p>
                  {d.error && <p>{d.error}</p>}
                </div>
              ))
            )}
          </section>
        </>
      )}
      {section === "settings" && (
        <section className="panel">
          <h2>Sign-in methods</h2>
          <RoleSwitcher/>
          {data.identities?.map((i) => (
            <p key={i.kind + i.value}>
              {i.kind === "wallet" ? "Wallet" : "Email"}: {i.value}
            </p>
          ))}
          <p>
            Link another sign-in method only if you control it. Forwarding
            destinations are separate from sign-in methods.
          </p>
          <div className="button-row">
            <button disabled={busy} onClick={() => wallet("link")}>
              Link a wallet
            </button>
            <button
              onClick={() => {
                setChallenge(null);
                setStatus(
                  "Enter the email below, then verify it to link a sign-in method.",
                );
              }}
            >
              Link an email
            </button>
          </div>
          {emailForm("link")}
          <section className="account-danger-zone" aria-labelledby="account-deletion-heading">
            <h3 id="account-deletion-heading">Delete account</h3>
            <p>To leave this session, use <strong>My account → Log out</strong> in the top navigation. Deleting your account permanently removes your preferences, sign-in methods, saved items, personal feeds and delivery subscriptions.</p>
            {!deleteConfirm?<button className="danger" disabled={busy} onClick={()=>{setDeletePhrase('');setDeleteAcknowledged(false);setDeleteConfirm(true);}}>Review account deletion</button>:<div className="notice">
              <p>This cannot be undone. Already published or IPFS-archived material may remain available.</p>
              <label htmlFor="delete-account-phrase">Type <strong>DELETE MY ACCOUNT</strong> to confirm</label>
              <input id="delete-account-phrase" value={deletePhrase} autoComplete="off" spellCheck={false} disabled={busy} onChange={e=>setDeletePhrase(e.target.value)}/>
              <label className="delete-acknowledgment"><input type="checkbox" checked={deleteAcknowledged} disabled={busy} onChange={e=>setDeleteAcknowledged(e.target.checked)}/> I understand this permanently deletes my account and saved preferences.</label>
              <div className="button-row">
                <button disabled={busy} onClick={cancelDeletion}>Cancel — keep my account</button>
                <button className="danger" disabled={busy||deletePhrase!=='DELETE MY ACCOUNT'||!deleteAcknowledged} onClick={()=>{
                  if(deletePhrase!=='DELETE MY ACCOUNT'||!deleteAcknowledged||busy)return;
                  if(!window.confirm('Permanently delete your TBN account? This cannot be undone.'))return;
                  void run(async()=>{await call('account',{confirmation:deletePhrase,acknowledge:deleteAcknowledged},'DELETE');window.location.assign('/');});
                }}>Permanently delete my account</button>
              </div>
            </div>}
          </section>
        </section>
      )}
    </>
  );
}
