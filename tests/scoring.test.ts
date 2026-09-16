import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultRanking,
  rankingSchema,
  rankArticles,
  scoreArticle,
} from "../lib/scoring";
import { defaults, type Item } from "../lib/model";
import { nextPublication } from "../lib/curation";
const now = new Date("2026-09-17T12:00:00Z");
const item: Item = {
  id: "a",
  source_id: "s",
  topic: "Tech",
  kind: "article",
  title: "Research in renewable energy",
  url: "https://example.com/a",
  excerpt: "Researchers published evidence about renewable energy storage.",
  summary: "Researchers published evidence about renewable energy storage.",
  summary_kind: "extractive",
  published_at: now.toISOString(),
};
test(
  "balanced scoring is bounded, reproducible and grounded",
  { concurrency: false },
  () => {
    const a = scoreArticle(item, defaults, defaultRanking, 80, now);
    assert.ok(a.value >= 0 && a.value <= 100);
    assert.equal(a.factors.grounding, 100);
    assert.equal(a.factors.relevance, 50);
    assert.deepEqual(a, scoreArticle(item, defaults, defaultRanking, 80, now));
    assert.equal(
      scoreArticle(
        { ...item, summary: "This cures every disease." },
        defaults,
        defaultRanking,
        80,
        now,
      ).factors.grounding,
      25,
    );
  },
);
test("weights alter order; hard filters, source limits and duplicates apply", () => {
  const old = {
    ...item,
    id: "b",
    title: "Energy storage research",
    published_at: "2026-09-16T12:00:00Z",
  };
  const recent = {
    ...item,
    id: "c",
    title: "Sporting result",
    excerpt: "Some other story",
    summary: undefined,
  };
  const prefs = { ...defaults, interests: "energy" };
  const relevance = rankingSchema.parse({
    weights: {
      freshness: 0,
      relevance: 100,
      source: 0,
      grounding: 0,
      completeness: 0,
    },
  });
  assert.equal(
    rankArticles([recent, old], prefs, relevance, {}, 10, now)[0].id,
    "b",
  );
  assert.equal(
    rankArticles(
      [recent, old],
      prefs,
      { ...relevance, requireSummary: true },
      {},
      10,
      now,
    ).length,
    1,
  );
  assert.equal(
    rankArticles(
      [item, { ...item, id: "duplicate" }],
      prefs,
      defaultRanking,
      {},
      10,
      now,
    ).length,
    1,
  );
  assert.equal(
    rankArticles(
      [item, old],
      prefs,
      { ...defaultRanking, maxPerSource: 1 },
      {},
      10,
      now,
    ).length,
    1,
  );
  assert.equal(
    rankArticles(
      [old],
      prefs,
      { ...defaultRanking, maxAgeDays: 1 },
      {},
      10,
      new Date(now.getTime() + 1),
    ).length,
    0,
  );
  assert.equal(
    rankingSchema.safeParse({
      weights: {
        freshness: 0,
        relevance: 0,
        source: 0,
        grounding: 0,
        completeness: 0,
      },
    }).success,
    false,
  );
});
test("automatic publishing uses UTC and advances strictly beyond the prior slot", () => {
  assert.equal(
    nextPublication("daily", new Date("2026-09-17T11:57:00Z")).toISOString(),
    "2026-09-18T11:57:00.000Z",
  );
  assert.equal(
    nextPublication(
      "three_daily",
      new Date("2026-09-17T11:57:00Z"),
    ).toISOString(),
    "2026-09-17T19:57:00.000Z",
  );
  assert.equal(
    nextPublication("hourly", new Date("2026-09-17T12:00:00Z")).toISOString(),
    "2026-09-17T13:00:00.000Z",
  );
});
