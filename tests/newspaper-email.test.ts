import { test } from "node:test";
import assert from "node:assert/strict";
import { newspaperEmail, compactSummary, digestArticles } from "../lib/newspaper-email";
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

import {defaults, type Item} from "../lib/model";
test("compact emails cap stories and summaries and link to the subscribed feed",()=>{
 const items = Array.from({length:6},(_,n)=>({id:String(n),kind:"article",title:"Headline "+n,excerpt:"Word ".repeat(100),source_id:"test",topic:"Science",url:"https://example.org/"+n,published_at:"2026-09-18T00:00:00Z"}) as Item);
 const html=newspaperEmail("Science",items,"2026-09-18","https://news.bittrees.org/unsubscribe","https://news.bittrees.org/my-paper/science");
 assert.equal((html.match(/<article /g)||[]).length,3);
 assert.ok(html.includes('href="https://news.bittrees.org/my-paper/science"'));
 assert.ok(!html.includes("Headline 3"));
 assert.ok(compactSummary(items[0].excerpt).length<=180);
 const chosen=digestArticles([...items,{...items[0],id:"pod",kind:"podcast",title:"Quantum podcast"}],{...defaults,interests:"quantum"},undefined,new Date("2026-09-18T01:00:00Z"));
 assert.equal(chosen.length,3);assert.ok(chosen.every(i=>i.kind==="article"));
 const relevant={...items[5],title:"Quantum research breakthrough"};
 assert.equal(digestArticles([...items.slice(0,5),relevant],{...defaults,interests:"quantum"},undefined,new Date("2026-09-18T01:00:00Z"))[0].id,"5");
});
