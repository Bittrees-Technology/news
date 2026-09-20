import { z } from "zod";
import { globalRelevance } from "./global-relevance";
import type { Item, Preferences } from "./model";
export const factorNames = {
  freshness: "Freshness",
  relevance: "Global / interest relevance",
  source: "Feed availability + feedback",
  grounding: "Excerpt match (heuristic)",
  completeness: "Metadata completeness",
};
export type Factor = keyof typeof factorNames;
const weight = z.number().min(0).max(100);
export const rankingSchema = z
  .object({
    weights: z
      .object({
        freshness: weight.default(20),
        relevance: weight.default(25),
        source: weight.default(20),
        grounding: weight.default(25),
        completeness: weight.default(10),
      })
      .default({
        freshness: 20,
        relevance: 25,
        source: 20,
        grounding: 25,
        completeness: 10,
      }),
    minScore: z.number().min(0).max(100).default(0),
    maxAgeDays: z.number().int().min(1).max(90).default(14),
    kinds: z.array(z.enum(["article", "podcast", "data"])).default([]),
    requireSummary: z.boolean().default(false),
    deduplicate: z.boolean().default(true),
    maxPerSource: z.number().int().min(1).max(100).default(100),
  })
  .refine(
    (p) => Object.values(p.weights).some((v) => v > 0),
    "Give at least one factor a weight.",
  );
export type RankingProfile = z.infer<typeof rankingSchema>;
export const defaultRanking = rankingSchema.parse({});
export type Score = {
  value: number;
  factors: Record<Factor, number>;
  sourceScore: number;
  version: string;
  feedbackAdjustment?: number;
};
export const scoreVersion = "tbn-global-v3";
const clean = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
export function scoreArticle(
  i: Item,
  p: Preferences,
  config = defaultRanking,
  sourceScore = 50,
  now = new Date(),
): Score {
  const age = Math.max(
    0,
    (now.getTime() - new Date(i.published_at).getTime()) / 3600000,
  );
  const terms = [
    ...new Set(
      p.interests
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length > 2),
    ),
  ];
  const evidence = clean(i.excerpt),
    summary = clean(i.summary || "");
  const factors = {
    freshness: i.date_basis === "observation" && !i.released_at ? 0 : Number.isFinite(age) ? 100 * Math.pow(0.5, age / 48) : 0,
    relevance: terms.length
      ? (100 *
          terms.filter((t) => clean(i.title + " " + i.excerpt).includes(t))
            .length) /
        terms.length
      : globalRelevance(i),
    source: sourceScore,
    grounding: summary
      ? evidence.includes(summary)
        ? 100
        : 25
      : evidence
        ? 65
        : 0,
    completeness: Math.min(
      100,
      (i.title.length >= 10 ? 20 : 0) +
        (i.url.startsWith("https://") ? 20 : 0) +
        (Number.isFinite(age) ? 20 : 0) +
        Math.min(40, i.excerpt.length / 8),
    ),
  };
  const sum = Object.values(config.weights).reduce((a, b) => a + b, 0);
  const value =
    Object.entries(config.weights).reduce(
      (a, [k, w]) => a + factors[k as Factor] * w,
      0,
    ) / sum;
  return {
    value: Math.round(value * 10) / 10,
    factors: Object.fromEntries(
      Object.entries(factors).map(([k, v]) => [k, Math.round(v)]),
    ) as Record<Factor, number>,
    sourceScore,
    version: scoreVersion,
  };
}
export function rankArticles(
  items: Item[],
  prefs: Preferences,
  config = defaultRanking,
  sourceScores: Record<string, number> = {},
  limit = 100,
  now = new Date(),
  feedback: Record<string,number> = {},
) {
  const seen = new Set<string>(),
    counts = new Map<string, number>();
  return items
    .filter(
      (i) =>
        new Date(i.published_at).getTime() >=
          now.getTime() - config.maxAgeDays * 86400000 &&
        (!config.kinds.length || config.kinds.includes(i.kind as "article")) &&
        (!config.requireSummary || !!i.summary),
    )
    .map((i) => ({
      ...i,
      ranking: scoreArticle(
        i,
        prefs,
        config,
        sourceScores[i.source_id] ?? 50,
        now,
      ),
    }))
    .map(i=>({...i,ranking:{...i.ranking,value:Math.round(Math.max(0,Math.min(100,i.ranking.value+Math.max(-10,Math.min(10,feedback[i.id]||0))))*10)/10,feedbackAdjustment:Math.max(-10,Math.min(10,feedback[i.id]||0))}}))
    .filter((i) => i.ranking.value >= config.minScore)
    .sort(
      (a, b) =>
        b.ranking.value - a.ranking.value ||
        new Date(b.published_at).getTime() -
          new Date(a.published_at).getTime() ||
        a.id.localeCompare(b.id),
    )
    .filter((i) => {
      const key = clean(i.title).replace(/[^\p{L}\p{N}]/gu, "");
      if (
        (config.deduplicate && seen.has(key)) ||
        (counts.get(i.source_id) || 0) >= config.maxPerSource
      )
        return false;
      seen.add(key);
      counts.set(i.source_id, (counts.get(i.source_id) || 0) + 1);
      return true;
    })
    .slice(0, limit);
}
