import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalPublication,
  publicReviewSnapshot,
  publishReviewedSchema,
} from "../lib/reviewed-publication";
const item = {
  id: "a".repeat(64),
  source_id: "source",
  url: "https://example.org/story",
  title: "Title",
  topic: "science",
  kind: "article",
  published_at: "2026-09-23T00:00:00.000Z",
  excerpt: "Source excerpt",
  summary_kind: "excerpt",
};
test("publication canonicalization preserves exact arrays/text and is stable across JSON object key order", () => {
  assert.equal(
    canonicalPublication({ b: [2, 1], a: "line\n  value" }),
    canonicalPublication({ a: "line\n  value", b: [2, 1] }),
  );
  assert.notEqual(canonicalPublication([1, 2]), canonicalPublication([2, 1]));
  assert.notEqual(canonicalPublication(" x "), canonicalPublication("x"));
  assert.throws(() => canonicalPublication({ value: undefined }));
  assert.throws(() => canonicalPublication({ value: NaN }));
  let deep: any = {};
  for (let n = 0; n < 20; n++) deep = { deep };
  assert.throws(() => canonicalPublication(deep));
  assert.throws(() => canonicalPublication("x".repeat(8 * 1024 * 1024)));
  assert.throws(() => canonicalPublication(Array(100001).fill(null)));
});
test("publication snapshot strips diagnostics and internal metadata while retaining declared public source content", () => {
  const raw = {
    front: [
      {
        ...item,
        owner_id: "private-owner",
        ranking: { value: 100 },
        source_score: 100,
        source_context: "internal",
        additional_public_detail: "review this too",
      },
    ],
    feeds: [],
    _companionPublication: { secret: "not a receipt" },
  };
  const result = publicReviewSnapshot(raw);
  assert.deepEqual(result, {
    front: [item],
    feeds: [],
  });
  assert.equal((raw.front[0] as any).owner_id, "private-owner");
  for (const bad of [
    { ...raw, front: [{ ...item, url: "https://secret@example.org" }] },
    { ...raw, front: [{ ...item, url: "http://example.org" }] },
    { ...raw, front: [item, item] },
    { ...raw, front: [{ ...item, user_edited: true }] },
    { ...raw, front: [{ ...item, summary_kind: "user_edited" }] },
  ])
    assert.throws(() => publicReviewSnapshot(bad));
  assert.equal(
    publicReviewSnapshot({
      front: [{ ...item, user_edited: true, summary_kind: "user_edited" }],
      feeds: [],
    }).front.length,
    1,
  );
});
test("reviewed publication requires public-audience confirmation and never accepts caller account, payload or sharing authority", () => {
  const input = {
    operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    revision: 3,
    publicationVersion: 2,
    reviewDigest: "a".repeat(64),
    confirmed: true,
    audience: "public",
  };
  assert.equal(publishReviewedSchema.safeParse(input).success, true);
  for (const change of [
    { confirmed: false },
    { audience: "private" },
    { revision: -1 },
    { publicationVersion: 2147483647 },
    { accountId: "other" },
    { snapshot: {} },
    { share_public: true },
    { credentialId: "other" },
  ])
    assert.equal(
      publishReviewedSchema.safeParse({ ...input, ...change }).success,
      false,
    );
});
