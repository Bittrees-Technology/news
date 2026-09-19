import {publicRanked} from "./ranking";
import {articleTags,normalizeTopic} from "./tags";
import Parser from "rss-parser";
import { createHash } from "node:crypto";
import { safeFetch } from "./safe-fetch";
import { sources, type Source } from "./catalog";
import { pool } from "./db";
import type { Item } from "./model";
const parser = new Parser();
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
export async function fetchSource(s: Source, owner?: string): Promise<Item[]> {
  // Catalogue feeds often include years of episodes. Keep custom endpoints on
  // the smaller limit and enforce a hard byte limit on every response.
  const catalogued =
    !owner && sources.some((entry) => entry.id === s.id && entry.url === s.url);
  const body = await safeFetch(s.url, catalogued ? 32_000_000 : 2_000_000);
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
          item(
            s,
            `${d.country.value}: GDP growth ${Number(d.value).toFixed(1)}% (${d.date})`,
            `https://data.worldbank.org/indicator/${d.indicator.id}?locations=${d.countryiso3code}&date=${d.date}`,
            `World Bank annual GDP growth observation for ${d.date}: ${Number(d.value).toFixed(2)} percent. Historical observation, retrieved ${now.slice(0, 10)}.`,
            now,
            owner,
          ),
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
    const feed = await parser.parseString(body);
    for (const e of (feed.items || []).slice(0, 15)) {
      if (!e.link || !e.title) continue;
      list.push(
        item(
          s,
          e.title,
          e.link,
          e["content:encodedSnippet"] || e.contentSnippet || e.summary || e.content || "",
          e.isoDate || e.pubDate || now,
          owner,
        ),
      );
    }
  }
  if(!['hfpapers','worldbank','github','defillama'].includes(s.kind)){
    const feed=await parser.parseString(body);
    for(const row of list){if(!row)continue;const e=feed.items.find(e=>e.link===row.url);const author=e?.creator || e?.['dc:creator'];row.authors=author?[clean(String(author),200)]:[];row.publication=clean(feed.title||s.name,200);}
  }
  return list
    .filter((i): i is Item => !!i)
    .filter(
      (i) =>
        new Date(i.published_at).getTime() >
          Date.now() - (s.type === "podcast" ? 30 : 14) * 86400000 ||
        s.type === "data",
    );
}
export async function storeItems(items: Item[]) {
  for (const i of items)
    await pool().query(
      `INSERT INTO items(id,source_id,topic,kind,title,url,excerpt,published_at,owner_id,tags,authors,publication,source_context) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(id) DO UPDATE SET fetched_at=CASE WHEN (items.title,items.excerpt,items.source_context) IS DISTINCT FROM (EXCLUDED.title,EXCLUDED.excerpt,EXCLUDED.source_context) THEN now() ELSE items.fetched_at END,summary=CASE WHEN (items.title,items.excerpt) IS DISTINCT FROM (EXCLUDED.title,EXCLUDED.excerpt) THEN NULL ELSE items.summary END,excerpt=EXCLUDED.excerpt,title=EXCLUDED.title,tags=EXCLUDED.tags,topic=EXCLUDED.topic,authors=EXCLUDED.authors,publication=EXCLUDED.publication,source_context=EXCLUDED.source_context`,
      [
        i.id,
        i.source_id,
        normalizeTopic(i.topic),
        i.kind,
        i.title,
        i.url,
        i.excerpt,
        i.published_at,
        i.owner_id,
        articleTags(i),i.authors||[],i.publication||null,i.source_context||i.excerpt,
      ],
    );
  await pool().query(`INSERT INTO story_documents(item_id,content_key) SELECT id,md5(title||'|'||coalesce(source_context,excerpt)) FROM items WHERE id=ANY($1::text[]) AND owner_id IS NULL ON CONFLICT(item_id) DO UPDATE SET content_key=EXCLUDED.content_key,document=CASE WHEN story_documents.content_key IS NULL THEN story_documents.document ELSE NULL END,cid=CASE WHEN story_documents.content_key IS NULL THEN story_documents.cid ELSE NULL END,generated_at=CASE WHEN story_documents.content_key IS NULL THEN story_documents.generated_at ELSE NULL END,pinned_at=CASE WHEN story_documents.content_key IS NULL THEN story_documents.pinned_at ELSE NULL END,claimed_at=NULL,lease=NULL,attempts=0,available_at=now(),error=NULL WHERE story_documents.content_key IS DISTINCT FROM EXCLUDED.content_key`,[items.map(i=>i.id)]);
}
export async function prioritizePublicWork(){
 const rows=(await pool().query("SELECT * FROM items WHERE owner_id IS NULL AND published_at>=now()-interval '24 hours' AND published_at<=now() ORDER BY published_at DESC LIMIT 2000")).rows as Item[];
 const ranked=await publicRanked(rows);
 await pool().query("UPDATE story_documents s SET priority=x.score FROM jsonb_to_recordset($1::jsonb) AS x(id text,score numeric) WHERE s.item_id=x.id",[JSON.stringify(ranked.map(i=>({id:i.id,score:i.ranking.value})))]);
 return ranked;
}
export async function collect() {
  let ok = 0,
    failed = 0,
    index = 0;
  const jobs = sources.map((s) => ({
    s,
    owner: undefined as string | undefined,
  }));
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (index < jobs.length) {
        const { s, owner } = jobs[index++];
        try {
          const items = await fetchSource(s, owner);
          await storeItems(items);
          if (owner)
            await pool().query(
              "UPDATE connections SET status='healthy',error=NULL,checked_at=now() WHERE id=$1",
              [s.id.slice(8)],
            );
          else
            await pool().query(
              "INSERT INTO sources(id,status,checked_at,item_count) VALUES($1,'healthy',now(),$2) ON CONFLICT(id) DO UPDATE SET status='healthy',checked_at=now(),error=NULL,item_count=$2",
              [s.id, items.length],
            );
          ok++;
        } catch (e) {
          const message = e instanceof Error ? e.message : "Source unavailable";
          if (owner)
            await pool().query(
              "UPDATE connections SET status='unavailable',error=$2,checked_at=now() WHERE id=$1",
              [s.id.slice(8), message.slice(0, 200)],
            );
          else
            await pool().query(
              "INSERT INTO sources(id,status,checked_at,error) VALUES($1,'unavailable',now(),$2) ON CONFLICT(id) DO UPDATE SET status='unavailable',checked_at=now(),error=$2",
              [s.id, message.slice(0, 200)],
            );
          failed++;
        }
      }
    }),
  );
  await prioritizePublicWork();
  return { ok, failed };
}
