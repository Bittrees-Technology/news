import test from "node:test";
import assert from "node:assert/strict";
import {
  translationKey,
  translationResultSchema,
  translatedResult,
} from "../lib/translation";
import type { Item } from "../lib/model";
const item: Item = {
  id: "a".repeat(64),
  source_id: "test",
  url: "https://example.org/test",
  topic: "World",
  kind: "article",
  title: "Investigação em Lisboa",
  excerpt: "Investigadores anunciaram resultados.",
  summary_kind: "excerpt",
  published_at: "2026-09-16T00:00:00Z",
};
const result = {
  key: "a".repeat(64),
  lease: "11111111-1111-4111-8111-111111111111",
  language: "pt",
  model: "Bittrees-hosted test",
  title: "Research in Lisbon",
  summary: "Researchers announced results.",
};
test("translation cache invalidates when the displayed title or summary changes", () => {
  assert.equal(
    translationKey(item),
    translationKey({ ...item, ranking: undefined }),
  );
  assert.notEqual(
    translationKey(item),
    translationKey({ ...item, title: "Novo título" }),
  );
  assert.notEqual(
    translationKey(item),
    translationKey({ ...item, summary: "Resumo atualizado." }),
  );
});
test("English recognition never replaces the original with model rewrites", () => {
  assert.deepEqual(translatedResult({ ...result, language: "en" }), {
    language: "en",
    model: result.model,
  });
});
test("non-English results require both fields and bounded validated payloads", () => {
  assert.equal(
    translatedResult(translationResultSchema.parse(result)).title,
    result.title,
  );
  assert.throws(() => translatedResult({ ...result, title: undefined }));
  assert.throws(() => translatedResult({ ...result, summary: undefined }));
  assert.throws(() =>
    translationResultSchema.parse({ ...result, title: "x".repeat(601) }),
  );
  assert.throws(() =>
    translationResultSchema.parse({ ...result, lease: "not-a-lease" }),
  );
});
