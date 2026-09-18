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
          e.contentSnippet || e.summary || e.content || "",
          e.isoDate || e.pubDate || now,
          owner,
        ),
      );
    }
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
      `INSERT INTO items(id,source_id,topic,kind,title,url,excerpt,published_at,owner_id,tags) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET fetched_at=now(),excerpt=EXCLUDED.excerpt,title=EXCLUDED.title,tags=EXCLUDED.tags,topic=EXCLUDED.topic`,
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
        articleTags(i),
      ],
    );
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
  return { ok, failed };
}
