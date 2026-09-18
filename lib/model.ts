import {articleTags,normalizeTopic} from "./tags";
import { z } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Item = {
  id: string;
  source_id: string;
  topic: string;
  tags?: string[];
  authors?:string[];
  publication?:string;
  source_context?:string;
  kind: string;
  title: string;
  url: string;
  excerpt: string;
  summary?: string;
  briefing_preview?:string;
  original_title?: string;
  user_edited?: boolean;
  summary_kind: string;
  published_at: string;
  owner_id?: string | null;
  translation_key?: string;
  translation_status?: string;
  translation?: {
    language: string;
    title?: string;
    summary?: string;
  briefing_preview?:string;
    model: string;
  };
  ranking?: import("./scoring").Score;
};
export type Edition = {
  id: string;
  publish_at: string;
  published_at: string;
  brief: string;
  data: { items: Item[]; mode: string; feedsOk: number; feedsFailed: number };
};
export const preferencesSchema = z.object({
  topics: z.array(z.string().max(60)).max(40).default([]),
  sources: z.array(z.string().max(100)).max(250).default([]),
  blocked: z.array(z.string().max(80)).max(50).default([]),
  interests: z.string().max(1000).default(""),
  requiredKeywords: z.string().max(500).optional(),
  length: z.number().int().min(5).max(50).default(20),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaults = preferencesSchema.parse({});
export function matches(i: Item, p: Preferences) {
  return (
    (!p.topics.length || p.topics.some(t=>articleTags(i).includes(normalizeTopic(t)))) &&
    (!p.sources.length || p.sources.includes(i.source_id)) &&
    (!(p.requiredKeywords || "").trim() ||
      p
        .requiredKeywords!.split(",")
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean)
        .some((w) =>
          `${i.title} ${i.excerpt} ${i.summary || ""}`
            .toLowerCase()
            .includes(w),
        )) &&
    !p.blocked.some((w) =>
      `${i.title} ${i.excerpt} ${i.summary || ""}`
        .toLowerCase()
        .includes(w.toLowerCase()),
    )
  );
}
export function selectItems(items: Item[], p: Preferences, limit = p.length) {
  const terms = p.interests
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 3);
  return items
    .filter((i) => matches(i, p))
    .map((i, n) => ({
      i,
      n,
      score: terms.reduce(
        (a, t) =>
          a + (new RegExp(t, "i").test(i.title + " " + i.excerpt) ? 1 : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score || a.n - b.n)
    .slice(0, limit)
    .map((r) => r.i);
}
export function periodFor(cadence: string, now = new Date()) {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12),
  );
  if (now.getTime() < end.getTime()) return null;
  if (cadence === "weekly" && end.getUTCDay() !== 1) return null;
  if (cadence === "monthly" && end.getUTCDate() !== 1) return null;
  const start = new Date(end);
  if (cadence === "monthly") start.setUTCMonth(start.getUTCMonth() - 1);
  else start.setUTCDate(start.getUTCDate() - (cadence === "weekly" ? 7 : 1));
  return { start, end, key: `${cadence}:${end.toISOString().slice(0, 10)}` };
}
export function nextDelivery(cadence: string, now = new Date()) {
  for (let n = 0; n < 33; n++) {
    const day = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + n,
        12,
      ),
    );
    if (day <= now) continue;
    if (
      cadence === "daily" ||
      (cadence === "weekly" && day.getUTCDay() === 1) ||
      (cadence === "monthly" && day.getUTCDate() === 1)
    )
      return day.toISOString();
  }
  return null;
}
