import { test } from "node:test";
import assert from "node:assert/strict";
import { newspaperEmail } from "../lib/newspaper-email";
test("newspaper email escapes owner edits and keeps source and unsubscribe links", () => {
  const html = newspaperEmail(
    "Paper <script>",
    [
      {
        id: "x",
        source_id: "test",
        topic: "Science",
        kind: "article",
        title: "<img src=x onerror=alert(1)>",
        url: "https://example.org/a?x=1&y=2",
        excerpt: "A < B & C",
        summary_kind: "excerpt",
        published_at: "2026-09-16T00:00:00Z",
        user_edited: true,
      },
    ],
    "2026-09-17",
    "https://news.bittrees.org/unsubscribe?id=a&token=b",
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("x=1&amp;y=2"));
  assert.ok(html.includes("Edited by the newspaper owner"));
  assert.ok(html.includes("Pause this subscription"));
});
