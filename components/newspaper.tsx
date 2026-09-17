"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { call } from "./client";
import { sourceName } from "@/lib/catalog";
import {
  countries,
  regions,
  geographyFor,
  matchesGeography,
} from "@/lib/geography";
import type { SourceHealth } from "@/lib/source-health";
import type { Edition, Item } from "@/lib/model";
type State = Record<string, { is_read: boolean; saved: boolean }>;
export function Newspaper({
  edition,
  initialItems,
  mode = "public",
  title,
  description,
  health,
}: {
  edition?: Edition | null;
  initialItems?: Item[];
  mode?: "public" | "saved" | "named";
  title?: string;
  description?: string;
  health?: SourceHealth | null;
}) {
  const [items, setItems] = useState<Item[]>(
      initialItems || edition?.data.items || [],
    ),
    [tab, setTab] = useState("news"),
    [topic, setTopic] = useState("All"),
    [country, setCountry] = useState(""),
    [region, setRegion] = useState(""),
    [hideRead, setHideRead] = useState(false),
    [state, setState] = useState<State>({}),
    [signed, setSigned] = useState(false),
    [message, setMessage] = useState(""),
    [cursor, setCursor] = useState(-1),
    [personal, setPersonal] = useState(false),
    [help, setHelp] = useState(false);
  const refs = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    try {
      setState(
        JSON.parse(localStorage.getItem("bittrees-news-reading") || "{}"),
      );
    } catch {}
    call("session")
      .then(async (a) => {
        setSigned(!!a.account);
        if (a.account) {
          const rows = await call("reading");
          setState(
            Object.fromEntries(
              rows.map(
                (r: { item_id: string; is_read: boolean; saved: boolean }) => [
                  r.item_id,
                  r,
                ],
              ),
            ),
          );
          if (mode === "saved") setItems(await call("saved"));
        } else if (mode === "saved")
          setMessage(
            "Sign in to keep a saved library across editions and devices.",
          );
      })
      .catch(() => {});
  }, [mode]);
  const translationKeys = items
    .filter(
      (i) =>
        i.translation_key &&
        ["pending", "working"].includes(i.translation_status || ""),
    )
    .map((i) => i.translation_key!)
    .join(",");
  useEffect(() => {
    if (!translationKeys) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>,
      polls = 0;
    async function refresh() {
      try {
        const rows = await call("translations/status", {
          keys: translationKeys.split(",").slice(0, 100),
        });
        if (!stopped)
          setItems((current) =>
            current.map((i) => {
              const row = rows.find(
                (r: { key: string }) => r.key === i.translation_key,
              );
              return row
                ? {
                    ...i,
                    translation_status: row.status,
                    translation: row.status === "done" ? row.result : undefined,
                  }
                : i;
            }),
          );
      } catch {}
      if (!stopped && ++polls < 60) timer = setTimeout(refresh, 15000);
    }
    timer = setTimeout(refresh, 3000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [translationKeys]);
  const geography = useMemo(
    () =>
      new Map(
        items.map((i) => [
          i.id,
          geographyFor({
            ...i,
            title: i.translation?.title || i.title,
            summary: i.translation?.summary || i.summary,
          }),
        ]),
      ),
    [items],
  );
  const visible = useMemo(
    () =>
      items.filter(
        (i) =>
          (mode === "saved" ||
            (tab === "podcasts"
              ? i.kind === "podcast"
              : i.kind !== "podcast")) &&
          (topic === "All" || i.topic === topic) &&
          matchesGeography(geography.get(i.id)!, country, region) &&
          (!hideRead || !state[i.id]?.is_read),
      ),
    [items, tab, topic, hideRead, state, mode, geography, country, region],
  );
  const topics = [...new Set(items.map((i) => i.topic))]
    .filter((t) => t !== "Portugal" && t !== "Europe")
    .sort();
  async function mutate(
    id: string,
    field: "saved" | "is_read",
    value?: boolean,
  ) {
    const v = value ?? !state[id]?.[field];
    const next = {
      ...state,
      [id]: { ...(state[id] || { is_read: false, saved: false }), [field]: v },
    };
    setState(next);
    try {
      localStorage.setItem("bittrees-news-reading", JSON.stringify(next));
      if (signed) await call("reading", { id, field, value: v });
      else if (field === "saved")
        setMessage(
          "Saved on this device. Sign in to build your library across editions.",
        );
    } catch (e) {
      setState(state);
      setMessage((e as Error).message);
    }
  }
  async function chooseFeed() {
    try {
      if (!personal) {
        setItems(await call("feed"));
        setPersonal(true);
      } else {
        setItems(edition?.data.items || []);
        setPersonal(false);
      }
      setCursor(-1);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)
      )
        return;
      const item = visible[cursor];
      if (["j", "k", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        const next = Math.max(
          0,
          Math.min(
            visible.length - 1,
            cursor + (["j", "ArrowDown"].includes(e.key) ? 1 : -1),
          ),
        );
        setCursor(next);
        refs.current.get(visible[next]?.id)?.focus();
      }
      if ((e.key === "o" || e.key === "Enter") && item) {
        window.open(item.url, "_blank", "noopener");
        void mutate(item.id, "is_read", true);
      }
      if (e.key === "s" && item) void mutate(item.id, "saved");
      if (e.key === "m" && item) void mutate(item.id, "is_read");
      if (e.key === "?") setHelp(!help);
      if (e.key === "Escape") {
        setHelp(false);
        setCursor(-1);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const date = edition ? new Date(edition.publish_at) : new Date();
  return (
    <>
      <div className="edition-head">
        <div>
          <p className="edition-date">
            {mode === "saved"
              ? "Your reading library"
              : date.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
          </p>
          <h1>
            {mode === "saved"
              ? "Saved for later"
              : title || "The Bittrees News"}
          </h1>
          <p className="edition-note">
            {mode === "saved"
              ? "The stories you want to return to."
              : description || "TBN · World, economy, technology & science."}
          </p>
        </div>
        {mode === "public" && (
          <div className="edition-time">
            07:57 · 11:57 · 19:57<span>New editions, every day. UTC.</span>
          </div>
        )}
      </div>
      <div className="controls">
        <div className="tabs" aria-label="Content type">
          {mode !== "saved" && (
            <>
              <button
                className={tab === "news" ? "active" : ""}
                onClick={() => {
                  setTab("news");
                  setCursor(-1);
                }}
              >
                News
              </button>
              <button
                className={tab === "podcasts" ? "active" : ""}
                onClick={() => {
                  setTab("podcasts");
                  setCursor(-1);
                }}
              >
                Podcasts
              </button>
            </>
          )}
        </div>
        <div className="actions">
          {signed && mode === "public" && (
            <button onClick={chooseFeed}>
              {personal ? "Public newspaper" : "My edition"}
            </button>
          )}
          <button onClick={() => setHideRead(!hideRead)}>
            {hideRead ? "Show read" : "Hide read"}
          </button>
          <button
            aria-label="Keyboard shortcuts"
            onClick={() => setHelp(!help)}
          >
            ?
          </button>
        </div>
      </div>
      <div className="topic-filters">
        {["All", ...topics].map((t) => (
          <button
            aria-pressed={topic === t}
            className={topic === t ? "selected" : ""}
            key={t}
            onClick={() => {
              setTopic(t);
              if (t === "All") {
                setCountry("");
                setRegion("");
              }
              setCursor(-1);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="geography-filters">
        <select
          aria-label="Select a country"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setRegion("");
            setCursor(-1);
          }}
        >
          <option value="">Select a country</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Select a region"
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setCountry("");
            setCursor(-1);
          }}
        >
          <option value="">Select a region</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {(country || region) && (
          <button
            onClick={() => {
              setCountry("");
              setRegion("");
              setCursor(-1);
            }}
          >
            Clear location
          </button>
        )}
        <span className="geography-note">
          Filters this edition by places mentioned in the headlines and
          summaries.
        </span>
      </div>
      {help && (
        <p className="notice">
          j / k to move · o to open · m to mark read · s to save · Escape to
          clear selection
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message} <Link href="/account">Your account</Link>
        </p>
      )}
      {!visible.length ? (
        <div className="empty">
          <h2>
            {mode === "saved"
              ? "Your next good read belongs here."
              : edition
                ? "Nothing in this view."
                : "The first edition is being prepared."}
          </h2>
          <p>
            {mode === "saved"
              ? "Use Save beside any story."
              : edition
                ? "No stories match these filters in this edition. Try another topic or location, clear the filters with All, or show read stories."
                : "The newspaper will appear here when the first collection completes. Reading never requires an account."}
          </p>
        </div>
      ) : (
        <section className="story-list" aria-label="Stories">
          {visible.map((i, n) => (
            <article
              key={i.id}
              tabIndex={-1}
              ref={(el) => {
                if (el) refs.current.set(i.id, el);
                else refs.current.delete(i.id);
              }}
              className={`story ${n < 3 && tab === "news" ? "lead" : ""} ${state[i.id]?.is_read ? "read" : ""} ${cursor === n ? "cursor" : ""}`}
            >
              <div className="story-meta">
                <span className="topic">{i.topic}</span>
                <span>{sourceName(i.source_id)}</span>
                <span>
                  {new Date(i.published_at).toLocaleDateString("en-GB", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
              </div>
              <h2>
                <a
                  href={i.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void mutate(i.id, "is_read", true)}
                >
                  {i.translation?.title || i.title}
                </a>
              </h2>
              <p>{i.translation?.summary ?? i.summary ?? i.excerpt}</p>
              {i.translation?.language && i.translation.language !== "en" && (
                <details className="translation-original">
                  <summary>Translated to English · View original</summary>
                  <h3>{i.title}</h3>
                  <p>{i.summary || i.excerpt}</p>
                  <small>
                    Automatic translation by Bittrees-hosted AI. The source link
                    opens the original publication.
                  </small>
                </details>
              )}
              {i.translation_status === "failed" && (
                <small className="muted">
                  Original text · English translation unavailable
                </small>
              )}

              <div className="story-bottom">
                <div>
                  <button
                    onClick={() => void mutate(i.id, "is_read")}
                    aria-pressed={!!state[i.id]?.is_read}
                  >
                    {state[i.id]?.is_read ? "Read ✓" : "Mark read"}
                  </button>
                  <button
                    onClick={() => void mutate(i.id, "saved")}
                    aria-pressed={!!state[i.id]?.saved}
                  >
                    {state[i.id]?.saved ? "★ Saved" : "☆ Save"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

    </>
  );
}
