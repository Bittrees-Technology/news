"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import {ArticleFeedback} from "./article-feedback";
import {articleTags,addedTopics,tagStyle} from "@/lib/tags";
import {defaultReaderFilters,readerFiltersSchema,matchesReaderFilters,guestReaderFilters,selectReaderFilter,type ReaderFilters} from "@/lib/reader-filters";
import {recentUniqueStories} from "@/lib/recent-stories";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { call } from "./client";
import { sourceName, topics as catalogTopics } from "@/lib/catalog";
import {
  countries,
  regions,
  geographyFor,
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
  live = false,
}: {
  edition?: Edition | null;
  initialItems?: Item[];
  mode?: "public" | "saved" | "named";
  title?: string;
  description?: string;
  health?: SourceHealth | null;
  live?: boolean;
}) {
  const router = useRouter();
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
  const [items, setItems] = useState<Item[]>(
      initialItems || edition?.data.items || [],
    ),
    [tab, setTab] = useState("all"),
    [countrySearch,setCountrySearch]=useState(""),
    [rankOrder,setRankOrder]=useState<string[]|null>(null),
    [rankRevision,setRankRevision]=useState(0),
    [filters, setFilters] = useState<ReaderFilters>(defaultReaderFilters),
    [votes,setVotes] = useState<Record<string,number>>({}),
    [state, setState] = useState<State>({}),
    [signed, setSigned] = useState(false),
    [message, setMessage] = useState(""),
    [cursor, setCursor] = useState(-1),
    [personal, setPersonal] = useState(false),
    [help, setHelp] = useState(false);
  const hideRead=filters.hideRead;
  const saveQueue=useRef(Promise.resolve());
  function updateFilters(next:ReaderFilters){
    setFilters(next);setCursor(-1);
    if(signed){saveQueue.current=saveQueue.current.catch(()=>{}).then(async()=>{await call('reader-filters',next);setMessage('Filters saved to your account.');}).catch(e=>setMessage('Could not save filters: '+e.message));}
    else {try{localStorage.setItem('tbn-guest-filters',JSON.stringify(next));}catch{}}
  }
  function selectFilter(key:'topics'|'countries'|'regions',value:string){
    updateFilters(selectReaderFilter(filters,key,value));
  }
  const itemIds=items.map(i=>i.id).join(',');
  useEffect(()=>{
    let active=true;setRankOrder(null);
    if(!signed||!itemIds)return;
    void call('reader-order',{ids:itemIds.split(',')}).then(ids=>{if(active)setRankOrder(ids);}).catch(()=>{if(active)setMessage('Could not apply your ranking preferences. Showing the edition order.');});
    return()=>{active=false;};
  },[signed,itemIds,rankRevision]);
  const refs = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    if (mode === "public" && !personal) {
      setItems(edition?.data.items || []);
      setCursor(-1);
    }
  }, [edition, mode, personal]);
  useEffect(() => {
    if (!live || personal) return;
    let stopped = false, pending = false;
    let revision: string | undefined;
    const controller = new AbortController();
    async function check() {
      if (document.visibilityState !== "visible" || pending) return;
      pending = true;
      try {
        const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const latest = await response.json();
        if (!stopped) {
          const changed=revision !== undefined && revision !== latest.contentRevision;
          revision=latest.contentRevision;
          if(changed || (latest.publishedAt && latest.publishedAt !== edition?.published_at)) router.refresh();
        }
      } catch { /* Keep the current edition readable during network outages. */ }
      finally { pending = false; }
    }
    void check();
    const timer = window.setInterval(check, 60_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [live, personal, edition?.published_at, router]);
  useEffect(() => {
    let active=true;
    async function load(){
      try{
        const a=await call('session');if(!active)return;
        setSigned(!!a.account);
        if(a.account){
          const [rows,f,v]=await Promise.all([call('reading'),call('reader-filters'),call('feedback')]);if(!active)return;
          setState(Object.fromEntries(rows.map((r:{item_id:string;is_read:boolean;saved:boolean})=>[r.item_id,r])));
          setFilters(readerFiltersSchema.parse(f));setVotes(v);
          if(mode==='saved'){const saved=await call('saved');if(active)setItems(saved);}
        }else{
          setState(JSON.parse(localStorage.getItem('bittrees-news-reading')||'{}'));
          setFilters(guestReaderFilters(readerFiltersSchema.parse(JSON.parse(localStorage.getItem('tbn-guest-filters')||'{}'))));
          setVotes(JSON.parse(localStorage.getItem('tbn-guest-votes')||'{}'));
        }
      }catch(e){if(active)setMessage('Could not load your preferences. Please refresh to retry.');}
    }
    function vote(e:Event){const d=(e as CustomEvent).detail;setVotes(v=>({...v,[d.id]:d.value}));setRankRevision(v=>v+1);}
    void load();window.addEventListener('news-auth',load);window.addEventListener('news-vote',vote);
    return()=>{active=false;window.removeEventListener('news-auth',load);window.removeEventListener('news-vote',vote);};
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
      (live?recentUniqueStories(items,now):items).filter(
        (i) =>
          (mode === "saved" || tab === "all" || (tab === "podcasts" ? i.kind === "podcast" : tab === "news" ? i.kind === "article" : !["article","podcast"].includes(i.kind))) &&
          (!rankOrder||rankOrder.includes(i.id)) &&
          matchesReaderFilters(articleTags(i),geography.get(i.id)!,filters) &&
          (!hideRead || !state[i.id]?.is_read),
      ).sort((a,b)=>{
        const order=rankOrder||items.map(i=>i.id);return order.indexOf(a.id)-order.indexOf(b.id);
      }),
    [items, tab, filters, hideRead, state, mode, geography,rankOrder,live,now],
  );
  const topics = [...new Set([...items.flatMap(articleTags),...catalogTopics,...addedTopics,...filters.topics,...filters.excludedTopics])]
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
      if(!signed)localStorage.setItem("bittrees-news-reading", JSON.stringify(next));
      if (signed) {await call("reading", { id, field, value: v });setRankRevision(n=>n+1);}
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
      </div>
      <div className="controls">
        <div className="tabs" aria-label="Content type">
          {mode !== "saved" && (
            <>
              <button className={tab === "all" ? "active" : ""} onClick={()=>setTab("all")}>All</button>
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
              <button className={tab === "data" ? "active" : ""} onClick={()=>setTab("data")}>Data</button>
            </>
          )}
        </div>
        <div className="actions">
          {signed && mode === "public" && (
            <button onClick={chooseFeed}>
              {personal ? "Public newspaper" : "My edition"}
            </button>
          )}
          <button onClick={() => updateFilters({...filters,hideRead:!hideRead})}>
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
      <div className="reader-filters" data-insights-ignore="true">
        <span className="geography-note">Click a tag to focus on it; click it again to show all. {signed && <Link href="/account/topics">Manage blocked topics and places in your account</Link>}</span>
        <div className="topic-filters exclusion-tags">
          <button aria-pressed={!filters.topics.length} onClick={()=>updateFilters({...filters,topics:[]})}>All topics</button>
          {topics.map(t=><button key={t} style={tagStyle(t)} aria-pressed={filters.topics.includes(t)} onClick={()=>selectFilter('topics',t)}>{t}</button>)}
        </div>
        <button onClick={()=>updateFilters({...filters,topics:[],countries:[],regions:[]})}>All topics & places</button>
        {(['Countries','Regions'] as const).map(label=>{
          const key=label==='Countries'?'countries':'regions';
          const options=label==='Countries'?countries.filter(c=>`${c.name} ${c.code}`.toLowerCase().includes(countrySearch.toLowerCase())).map(c=>({value:c.code,label:c.name})):regions.map(r=>({value:r,label:r}));
          return <details key={label}><summary>{label} · {filters[key].length?filters[key].join(', '):'All'}</summary>
            {label==='Countries'&&<input type="search" aria-label="Search countries" placeholder="Search countries…" value={countrySearch} onChange={e=>setCountrySearch(e.target.value)}/>}
            <div className="filter-options topic-filters exclusion-tags">
              <button aria-pressed={!filters[key].length} onClick={()=>updateFilters({...filters,[key]:[]})}>All {label.toLowerCase()}</button>
              {options.map(o=><button key={o.value} aria-pressed={filters[key].includes(o.value)} onClick={()=>selectFilter(key,o.value)}>{o.label}</button>)}{!options.length&&<p>No countries found.</p>}
            </div>
          </details>;
        })}
        {signed&&(filters.excludedTopics.length+filters.excludedCountries.length+filters.excludedRegions.length>0)&&<span className="geography-note">Your account blocks still apply, including when viewing all topics and places.</span>}
      </div>
      {help && (
        <p className="notice">
          j / k to move · o to open · m to mark read · s to save · Escape to
          clear selection
        </p>
      )}
      {mode === "public" && (
        <p>
          <Link className="primary" href="/account/delivery">
            Subscribe — daily, weekly or monthly
          </Link>
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message} <Link href="/account">Your account</Link>
        </p>
      )}
      {live&&<p className="muted">Last 24 hours</p>}
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
              className={`story ${n < 3 ? "lead" : ""} ${state[i.id]?.is_read ? "read" : ""} ${cursor === n ? "cursor" : ""}`}
            >
              <div className="story-meta">
                {articleTags(i).map(tag=><span className="topic colored-tag" style={tagStyle(tag)} key={tag}>{tag}</span>)}
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
              <p>{i.briefing_preview ?? i.translation?.summary ?? i.summary ?? i.excerpt}</p>
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
                  <ArticleFeedback id={i.id} />
                  {!i.owner_id&&<Link href={`/story/${i.id}`}>Summary ↗</Link>}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
