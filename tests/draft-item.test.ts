import test from "node:test";
import assert from "node:assert/strict";
import { editDraftItemSchema } from "../lib/drafts";
test("reviewed story input cannot choose ownership, links, sharing or publishing", () => {
  const input = {
    revision: 4,
    itemId: "a".repeat(64),
    title: "Edited",
    summary: "Exact owner text",
  };
  assert.deepEqual(editDraftItemSchema.parse(input), input);
  for (const extra of [
    { accountId: "other" },
    { url: "https://evil.example" },
    { share_public: true },
    { published: true },
  ])
    assert.equal(
      editDraftItemSchema.safeParse({ ...input, ...extra }).success,
      false,
    );
  for (const patch of [
    { revision: -1 },
    { revision: 1.5 },
    { itemId: "bad" },
    { title: " " },
    { summary: "x".repeat(2001) },
  ])
    assert.equal(
      editDraftItemSchema.safeParse({ ...input, ...patch }).success,
      false,
    );
});
