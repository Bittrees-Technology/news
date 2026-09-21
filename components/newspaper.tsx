"use client";
import {loadReading,writeReading,watchReading} from "@/lib/reading-sync";
import { useEffect, useMemo, useState, useRef } from "react";
import {matchesArticleSearch,type SearchField} from "@/lib/article-search";
import {ArticleEngagement} from "./article-engagement";
import {ArticleFeedback} from "./article-feedback";
import {articleTags,addedTopics,tagStyle} from "@/lib/tags";
import {defaultReaderFilters,readerFiltersSchema,matchesReaderFilters,guestReaderFilters,selectReaderFilter,type ReaderFilters} from "@/lib/reader-filters";
import {recentUniqueStories} from "@/lib/recent-stories";
import Link from "next/link";
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
  // Hold the reading window steady until the reader explicitly reloads.
  const [now]=useState(()=>Date.now());
  const [items, setItems] = useState<Item[]>(
      initialItems || edition?.data.items || [],
    ),
    [tab, setTab] = useState("all"),
    [countrySearch,setCountrySearch]=useState(""),
    [search,setSearch]=useState(""),
    [searchField,setSearchField]=useState<SearchField>("all"),
    [rankOrder,setRankOrder]=useState<string[]|null>(null),
    [filters, setFilters] = useState<ReaderFilters>(defaultReaderFilters),
    [readSnapshot,setReadSnapshot] = useState<State>({}),
    [state, setState] = useState<State>({}),
    [signed, setSigned] = useState(false),
    [message, setMessage] = useState(""),
    [cursor, setCursor] = useState(-1),
    [personal, setPersonal] = useState(false),
    [help, setHelp] = useState(false);
  const [renderCount,setRenderCount]=useState(30);
  const moreRef=useRef<HTMLDivElement>(null);
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
  },[signed,itemIds]);
  const refs = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    if (mode === "public" && !personal) {
      setItems(edition?.data.items || []);
      setCursor(-1);
    }
  }, [edition, mode, personal]);
  useEffect(() => {
    let active=true;
    async function load(){
      try{
        const a=await call('session');if(!active)return;
        setSigned(!!a.account);
        if(a.account){
          const [rows,f]=await Promise.all([call('reading'),call('reader-filters')]);if(!active)return;
          const reading=Object.fromEntries(rows.map((r:{item_id:string;is_read:boolean;saved:boolean})=>[r.item_id,r]));
          setState(reading);setReadSnapshot(reading);
          setFilters(readerFiltersSchema.parse(f));
          if(mode==='saved'){const saved=await call('saved');if(active)setItems(saved);}
        }else{
          const reading=JSON.parse(localStorage.getItem('bittrees-news-reading')||'{}');
          setState(reading);setReadSnapshot(reading);
          setFilters(guestReaderFilters(readerFiltersSchema.parse(JSON.parse(localStorage.getItem('tbn-guest-filters')||'{}'))));
        }
      }catch(e){if(active)setMessage('Could not load your preferences. Please refresh to retry.');}
    }
    void load();window.addEventListener('news-auth',load);
    return()=>{active=false;window.removeEventListener('news-auth',load);};
  }, [mode]);
  useEffect(()=>{
    let active=true;
    const refresh=()=>{void loadReading(signed).then(reading=>{if(active){setState(reading);setReadSnapshot(reading);}}).catch(()=>{});};
    const stop=watchReading(refresh);
    return()=>{active=false;stop();};
  },[signed]);
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
  const orderPositions=useMemo(()=>new Map((rankOrder||items.map(i=>i.id)).map((id,n)=>[id,n])),[rankOrder,items]);
  const visible = useMemo(
    () =>
      (live?recentUniqueStories(items,now):items).filter(
        (i) =>
          (mode === "saved" || tab === "all" || (tab === "podcasts" ? i.kind === "podcast" : tab === "news" ? i.kind === "article" : !["article","podcast"].includes(i.kind))) &&
          (!rankOrder||rankOrder.includes(i.id)) &&
          matchesReaderFilters(articleTags(i),geography.get(i.id)!,filters) &&
          matchesArticleSearch(i,search,searchField) &&
          (!hideRead || !readSnapshot[i.id]?.is_read),
      ).sort((a,b)=>{
        return (orderPositions.get(a.id)??0)-(orderPositions.get(b.id)??0);
      }),
    [items, tab, filters, hideRead, readSnapshot, mode, geography,rankOrder,orderPositions,live,now,search,searchField],
  );
  useEffect(()=>{setRenderCount(30);},[tab,filters,search,searchField,items]);
  useEffect(()=>{
    if(!moreRef.current||renderCount>=visible.length)return;
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))setRenderCount(n=>n+30);},{rootMargin:'500px'});
    observer.observe(moreRef.current);return()=>observer.disconnect();
  },[renderCount,visible.length]);
  useEffect(()=>{if(cursor>=0){setRenderCount(n=>Math.max(n,cursor+1));requestAnimationFrame(()=>refs.current.get(visible[cursor]?.id)?.focus());}},[cursor]);
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
      await writeReading(signed,id,field,v);
      if(!signed && field==='saved')setMessage('Saved on this device. Sign in to build your library across editions.');
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
          <button onClick={()=>window.location.reload()}>Refresh stories</button>
          {signed && mode === "public" && (
            <button onClick={chooseFeed}>
              {personal ? "Public newspaper" : "My edition"}
            </button>
          )}
          <button onClick={()=>{setReadSnapshot(state);updateFilters({...filters,hideRead:!hideRead});}}>
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
      <div className="article-search" role="search" aria-label="Search this newspaper" data-insights-ignore="true">
        <label className="article-search-input">Search articles
          <input type="search" placeholder="Search titles or summaries…" value={search} maxLength={200} onChange={e=>{setSearch(e.target.value);setCursor(-1);}} />
        </label>
        <label>Search in
          <select value={searchField} onChange={e=>{setSearchField(e.target.value as SearchField);setCursor(-1);}}>
            <option value="all">Title & briefing</option><option value="title">Title only</option><option value="summary">Briefing only</option>
          </select>
        </label>
        {search&&<button type="button" onClick={()=>{setSearch("");setCursor(-1);}}>Clear search</button>}
        {search.trim()&&<span className="muted article-search-status" role="status">{visible.length} {visible.length===1?'match':'matches'} in this view · Current filters still apply.</span>}
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
      {live&&<p className="muted">Last 24 hours at page load · Refresh stories to update content and rankings.</p>}
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
                ? "No stories match this search and filters. Try different words, clear the search, select All topics & places, or show read stories."
                : "The newspaper will appear here when the first collection completes. Reading never requires an account."}
          </p>
        </div>
      ) : (
        <section className="story-list" aria-label="Stories">
          {visible.slice(0,renderCount).map((i, n) => (
            <article
              key={i.id}
              tabIndex={-1}
              ref={(el) => {
                if (el) refs.current.set(i.id, el);
                else refs.current.delete(i.id);
              }}
              className={`story ${n < 3 ? "lead" : ""} ${state[i.id]?.is_read ? "read" : ""} ${cursor === n ? "cursor" : ""}`}
            >
              <ArticleEngagement id={i.id} signed={signed}/>
              <div className="story-meta">
                {articleTags(i).map(tag=><span className="topic colored-tag" style={tagStyle(tag)} key={tag}>{tag}</span>)}
                <span>{sourceName(i.source_id)}</span>
                <span>
                  {i.observation_period ? `Observation: ${i.observation_period} · Release date unknown` : new Date(i.published_at).toLocaleDateString("en-GB", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
              </div>
              <h2>
                <a
                  data-source-link="true"
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
                  <ArticleFeedback id={i.id} />
                  {!i.owner_id&&<Link href={`/briefings?story=${i.id}`}>Briefings ↗</Link>}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
      {renderCount<visible.length&&<div ref={moreRef}><button onClick={()=>setRenderCount(n=>n+30)}>Load more stories</button></div>}
    </>
  );
}
