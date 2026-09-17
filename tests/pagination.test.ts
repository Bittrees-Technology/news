import { test } from "node:test";
import assert from "node:assert/strict";
import { newspaperPages } from "../lib/pagination";
import type { Item } from "../lib/model";
test("newspaper pagination preserves all stories and their order", () => {
  const items = Array.from(
    { length: 10 },
    (_, n) =>
      ({ id: String(n), title: "Story", excerpt: "Source text" }) as Item,
  );
  const pages = newspaperPages(items);
  assert.deepEqual(
    pages.map((p) => p.length),
    [3, 4, 3],
  );
  assert.deepEqual(pages.flat(), items);
});
test("long owner edits are separated without truncating content", () => {
  const items = Array.from(
    { length: 3 },
    (_, n) =>
      ({ id: String(n), title: "Story", summary: "x".repeat(2000) }) as Item,
  );
  assert.deepEqual(
    newspaperPages(items).map((p) => p.length),
    [1, 1, 1],
  );
  assert.deepEqual(newspaperPages(items).flat(), items);
});
