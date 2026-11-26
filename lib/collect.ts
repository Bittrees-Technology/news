import {saveAnnotations} from './persist-annotations';
import {rankingColumns,uniqueChangedIds} from "./ranking-projection";
import {annualObservation} from "./data-dates";
import {editorialBase} from "./editorial-priority";
import {articleTags} from "./tags";
import {feedParser,feedAuthors} from "./feed-attribution";
import { createHash } from "node:crypto";
import {collectionMinutes,retryMinutes,nextSourcePoll} from "./collection-policy";
import {withTranslations} from "./translation";
import { safeFetchResponse,type FetchValidators,SourceFetchError } from "./safe-fetch";
import { sources, type Source } from "./catalog";
import { pool, tx } from "./db";
import type { Item } from "./model";
const parser = feedParser;
export const clean = (t: string = "", max = 600) =>
  t
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|quot|lt|gt);/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
export function itemId(url: string, owner = "") {
  return createHash("sha256")
    .update(owner + "|" + url)
    .digest("hex");
}
function item(
  s: Source,
  title: string,
  url: string,
  excerpt: string,
  date: string,
  owner?: string,
): Item | null {
  try {
    const u = new URL(url);
    if (!["https:", "http:"].includes(u.protocol)) return null;
  } catch {
    return null;
  }
  const time = new Date(date);
  if (!title || !Number.isFinite(time.getTime())) return null;
  return {
    id: itemId(url, owner),
    source_id: s.id,
    topic: s.topic,
    kind: s.type,
    title: clean(title, 250),
    url,
    excerpt: clean(excerpt),
    source_context: clean(excerpt,12000),
    authors: [],
    publication:s.name,
    summary_kind: "excerpt",
    published_at: time.toISOString(),
    owner_id: owner || null,
  };
}
function withObservation(i:Item|null,dates:ReturnType<typeof annualObservation>):Item|null{return i?{...i,...dates}:null;}
export async function fetchSource(s:Source,owner?:string):Promise<Item[]>{return (await fetchSourceSnapshot(s,owner)).items || [];}
export async function fetchSourceSnapshot(s: Source, owner?: string, previousHash?:string,validators:FetchValidators={}): Promise<{hash:string;items?:Item[];etag:string|null;lastModified:string|null;bytes:number;notModified:boolean}> {
  // Catalogue feeds often include years of episodes. Keep custom endpoints on
  // the smaller limit and enforce a hard byte limit on every response.
  const catalogued =
    !owner ? sources.find((entry) => entry.id === s.id && entry.url === s.url) : undefined;
  const response = await safeFetchResponse(s.url, catalogued?.maxResponseBytes ?? (catalogued ? 32_000_000 : 2_000_000),previousHash?validators:{});
  if(response.notModified && previousHash)return {...response,hash:previousHash};
  const {body}=response;
  const hash=createHash("sha256").update(body).digest("hex");
  if(hash===previousHash)return {...response,hash};
  const now = new Date().toISOString();
  const list: (Item | null)[] = [];
  if (s.kind === "hfpapers") {
    const data = JSON.parse(body);
    for (const d of data.slice(0, 15))
      list.push(
        item(
          s,
          d.paper?.title,
          `https://huggingface.co/papers/${d.paper?.id}`,
          d.paper?.summary || "",
          d.publishedAt || now,
          owner,
        ),
      );
  } else if (s.kind === "worldbank") {
    for (const d of JSON.parse(body)[1] || [])
      if (d.value !== null)
        list.push(
          withObservation(item(
            s,
            `${d.country.value}: GDP growth ${Number(d.value).toFixed(1)}% (${d.date})`,
            `https://data.worldbank.org/indicator/${d.indicator.id}?locations=${d.countryiso3code}&date=${d.date}`,
            `World Bank annual GDP growth observation for ${d.date}: ${Number(d.value).toFixed(2)} percent. Historical annual observation; release date not supplied.`,
            now,
            owner,
          ), annualObservation(String(d.date),now)),
        );
  } else if (s.kind === "github") {
    for (const d of JSON.parse(body).slice(0, 5))
      list.push(
        item(
          s,
          d.name || d.tag_name,
          d.html_url,
          d.body || "",
          d.published_at || now,
          owner,
        ),
      );
  } else if (s.kind === "defillama") {
    const data = JSON.parse(body)
      .filter((d: { tvl: number }) => d.tvl > 0)
      .sort((a: { tvl: number }, b: { tvl: number }) => b.tvl - a.tvl)
      .slice(0, 5);
    for (const d of data)
      list.push(
        item(
          s,
          `${d.name}: $${(d.tvl / 1e9).toFixed(2)} billion total value locked`,
          `https://defillama.com/protocol/${d.slug}`,
          `DeFiLlama reports $${Math.round(d.tvl).toLocaleString("en-US")} in total value locked for ${d.name}, classified as ${d.category}. Snapshot retrieved ${now.slice(0, 10)}; not a price forecast.`,
          now,
          owner,
        ),
      );
  } else {
    list.push(...await rssItems(s, body, now, owner, catalogued));
  }
  return {...response,hash,items:list
    .filter((i): i is Item => !!i)
    .filter(
      (i) =>
        new Date(i.published_at).getTime() >
          Date.now() - (s.type === "podcast" ? 30 : 14) * 86400000 ||
        s.type === "data",
    )};
}
function isBrazilEducationReport(link: URL, authors: string[]) {
  const staffByline = /^(?:Agência Brasil|[\p{L}][\p{L} .’'-]+ [-–—] Repórter da Agência Brasil)$/iu;
  return link.pathname.startsWith('/educacao/noticia/') && authors.length > 0 &&
    authors.every(name => staffByline.test(name) && !/\b(?:Reuters|AFP|Associated Press)\b/iu.test(name));
}

export async function rssItems(s: Source, body: string, now: string, owner?: string, catalogued?: Source) {
  const feed = await parser.parseString(body);
  const items: Item[] = [];
  for (const entry of (feed.items || []).slice(0, 15)) {
    if (!entry.link || !entry.title) continue;
    const date = entry.isoDate || entry.pubDate;
    const evidence = catalogued?.feedDescriptionOnly
      ? clean((entry.tbnDescription ? entry.contentSnippet : entry.summary) || "", 1200)
      : entry["content:encodedSnippet"] || entry.contentSnippet || entry.summary || entry.content || "";
    const row = item(s, entry.title, entry.link, evidence, date || now, owner);
    if (!row) continue;
    row.authors = feedAuthors(entry);
    if (catalogued?.feedDescriptionOnly && !row.excerpt) continue;
    if (catalogued?.requiresByline && !row.authors.length) continue;
    row.publication = catalogued?.publication || (catalogued?.maxItems || catalogued?.feedDescriptionOnly
      ? catalogued.name : clean(typeof feed.title === 'string' && feed.title || s.name, 200));
    if (catalogued?.maxItems) {
      const link = new URL(row.url);
      const age = Date.parse(now) - Date.parse(row.published_at);
      if (!date || age < 0 || age >= 14 * 86400000 || !row.excerpt ||
        link.username || link.password || link.origin !== new URL(catalogued.homepage).origin) continue;
      if (catalogued.id === 'agencia-brasil-education' && !isBrazilEducationReport(link, row.authors)) continue;
      if (items.some(i => i.id === row.id)) continue;
    }
    items.push(row);
    if (catalogued?.maxItems && items.length >= catalogued.maxItems) break;
  }
  return items;
}
export async function storeItems(items: Item[]) {
  if (!items.length) return;
  await tx(async db => {
    const annotations = new Map<string,Item>();
    const priorities = new Map<string, number>();
    // Lock shared article URLs in the same order across concurrent source batches.
    for (const i of [...items].sort((a,b) => a.id.localeCompare(b.id))) {
      const tags = articleTags(i);
      const stored = await db.query<Item>(
        `INSERT INTO items(id,source_id,topic,kind,title,url,excerpt,published_at,owner_id,tags,authors,publication,source_context,observation_period,released_at,retrieved_at,date_basis) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT(id) DO UPDATE SET observation_period=EXCLUDED.observation_period,released_at=EXCLUDED.released_at,retrieved_at=EXCLUDED.retrieved_at,date_basis=EXCLUDED.date_basis,published_at=CASE WHEN EXCLUDED.date_basis='observation' THEN EXCLUDED.published_at ELSE items.published_at END,fetched_at=CASE WHEN (items.title,items.excerpt,items.source_context) IS DISTINCT FROM (EXCLUDED.title,EXCLUDED.excerpt,EXCLUDED.source_context) THEN now() ELSE items.fetched_at END,summary=CASE WHEN (items.title,items.excerpt) IS DISTINCT FROM (EXCLUDED.title,EXCLUDED.excerpt) THEN NULL ELSE items.summary END,excerpt=EXCLUDED.excerpt,title=EXCLUDED.title,tags=EXCLUDED.tags,topic=EXCLUDED.topic,authors=CASE WHEN items.attribution IS NOT NULL THEN items.authors ELSE EXCLUDED.authors END,publication=EXCLUDED.publication,source_context=EXCLUDED.source_context RETURNING ${rankingColumns}`,
        [
          i.id,
          i.source_id,
          tags[0],
          i.kind,
          i.title,
          i.url,
          i.excerpt,
          i.published_at,
          i.owner_id,
          tags,i.authors||[],i.publication||null,i.source_context||i.excerpt,i.observation_period||null,i.released_at||null,i.retrieved_at||null,i.date_basis||'publication',
        ],
      );
      const original = stored.rows[0];
      if (process.env.NEWS_SHADOW_ANNOTATIONS==='1' && !original.owner_id && original.kind==='article')
        annotations.set(original.id,{...original,source_context:i.source_context||i.excerpt});
      if (!original.owner_id) priorities.set(original.id,editorialBase(original));
    }
    if (annotations.size) await saveAnnotations(db,[...annotations.values()]);
    if (!priorities.size) return;
    await db.query(`INSERT INTO story_documents(item_id,priority,content_key) SELECT i.id,p.score,md5(i.title||'|'||coalesce(i.source_context,i.excerpt)) FROM unnest($1::text[],$2::numeric[]) AS p(id,score) JOIN items i ON i.id=p.id WHERE i.owner_id IS NULL ON CONFLICT(item_id) DO UPDATE SET priority=EXCLUDED.priority,content_key=EXCLUDED.content_key,enqueued_at=CASE WHEN story_documents.content_key IS NULL THEN story_documents.enqueued_at ELSE now() END,document=CASE WHEN story_documents.content_key IS NULL THEN story_documents.document ELSE NULL END,cid=CASE WHEN story_documents.content_key IS NULL THEN story_documents.cid ELSE NULL END,generated_at=CASE WHEN story_documents.content_key IS NULL THEN story_documents.generated_at ELSE NULL END,pinned_at=CASE WHEN story_documents.content_key IS NULL THEN story_documents.pinned_at ELSE NULL END,claimed_at=NULL,lease=NULL,attempts=0,available_at=now(),error=NULL WHERE story_documents.content_key IS DISTINCT FROM EXCLUDED.content_key`,[[...priorities.keys()],[...priorities.values()]]);
    // A re-seen item can adopt the new score without resetting its lease or content.
    await db.query(`UPDATE story_documents s SET priority=p.score FROM unnest($1::text[],$2::numeric[]) AS p(id,score) WHERE s.item_id=p.id AND s.cid IS NULL AND s.priority IS DISTINCT FROM p.score`,[[...priorities.keys()],[...priorities.values()]]);
  });
}
async function recentPublicWork(ids:string[]){
 if(!ids.length)return [];
 const rows=(await pool().query(`SELECT ${rankingColumns} FROM items WHERE id=ANY($1::text[]) AND owner_id IS NULL AND published_at>=now()-interval '24 hours' AND published_at<=now() ORDER BY published_at DESC LIMIT 2000`,[uniqueChangedIds(ids)])).rows as Item[];
 return rows;
}
export async function claimSource(ids:string[]){
 return (await pool().query(`WITH candidate AS (
    SELECT id FROM sources WHERE id=ANY($1::text[]) AND next_poll_at<=now() AND (collection_lease_until IS NULL OR collection_lease_until<now()) ORDER BY next_poll_at,id FOR UPDATE SKIP LOCKED LIMIT 1
   ) UPDATE sources s SET collection_lease=gen_random_uuid(),collection_lease_until=now()+interval '10 minutes' FROM candidate c WHERE s.id=c.id RETURNING s.*`,[ids])).rows[0];
}
export async function collect() {
 const started=Date.now(),ids=sources.map(s=>s.id);
 await pool().query('INSERT INTO sources(id,next_poll_at) SELECT id,next_poll_at FROM jsonb_to_recordset($1::jsonb) AS x(id text,next_poll_at timestamptz) ON CONFLICT DO NOTHING',[JSON.stringify(sources.map(s=>({id:s.id,next_poll_at:nextSourcePoll(s.id,collectionMinutes(s))})))]);
 let ok=0,failed=0,unchanged=0,claimed=0;
 const changedIds:string[]=[];
 // A time and work budget keeps this job below the route's five-minute limit.
 await Promise.all(Array.from({length:3},async()=>{
  while(Date.now()-started<45000 && claimed<12){
   claimed++;
   const row=await claimSource(ids);
   if(!row)return;
   const source=sources.find(s=>s.id===row.id)!,minutes=collectionMinutes(source);
   try{
    const result=await fetchSourceSnapshot(source,undefined,row.body_hash,{etag:row.etag,lastModified:row.last_modified});
    if(result.items){await storeItems(result.items);changedIds.push(...result.items.map(i=>i.id));}else unchanged++;
    await pool().query("WITH completed AS (UPDATE sources SET status='healthy',checked_at=now(),error=NULL,item_count=coalesce($3,item_count),body_hash=$4,etag=$6,last_modified=$7,transferred_bytes=transferred_bytes+$8,conditional_hits=conditional_hits+CASE WHEN $9 THEN 1 ELSE 0 END,completed_checks=completed_checks+1,collected_items=collected_items+coalesce($3,0),failures=0,next_poll_at=$5::timestamptz,collection_lease=NULL,collection_lease_until=NULL WHERE id=$1 AND collection_lease=$2 RETURNING id,checked_at,status) INSERT INTO source_observations(source_id,observed_at,status) SELECT id,checked_at,status FROM completed ON CONFLICT DO NOTHING",[row.id,row.collection_lease,result.items?.length??null,result.hash,nextSourcePoll(source.id,minutes,Math.max(Date.now()+1,new Date(row.next_poll_at).getTime()+minutes*60_000)),result.etag,result.lastModified,result.bytes,result.notModified]);
    ok++;
   }catch(e){
    const message=e instanceof Error?e.message:'Source unavailable';
    const delay=retryMinutes(minutes,row.failures+1,e instanceof SourceFetchError?e.status:undefined,e instanceof SourceFetchError?e.retryAfterSeconds:0);
    await pool().query("WITH completed AS (UPDATE sources SET status='unavailable',checked_at=now(),error=$3,failures=failures+1,next_poll_at=now()+$4*interval '1 minute',collection_lease=NULL,collection_lease_until=NULL WHERE id=$1 AND collection_lease=$2 RETURNING id,checked_at,status) INSERT INTO source_observations(source_id,observed_at,status) SELECT id,checked_at,status FROM completed ON CONFLICT DO NOTHING",[row.id,row.collection_lease,message.slice(0,200),delay]);
    failed++;
   }
  }
 }));
 if(changedIds.length)await withTranslations(await recentPublicWork(changedIds));
 const stats={ok,failed,unchanged,seconds:Math.round((Date.now()-started)/1000)};
 await pool().query("INSERT INTO worker_state(id,data) VALUES('collection',$1) ON CONFLICT(id) DO UPDATE SET updated_at=now(),data=EXCLUDED.data",[JSON.stringify(stats)]);
 return stats;
}
