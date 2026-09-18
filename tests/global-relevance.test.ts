import test from "node:test";
import assert from "node:assert/strict";
import { globalRelevance } from "../lib/global-relevance";
import { rankArticles } from "../lib/scoring";
import { defaults, type Item } from "../lib/model";

const now = new Date("2026-09-19T12:00:00Z");
const item: Item = {id:"local", source_id:"s", title:"Local community events", topic:"Local", kind:"article", url:"https://example.org/local", excerpt:"Community events this week.", summary_kind:"excerpt", published_at:now.toISOString()};

test("global relevance ranks all formats above comparable local coverage", () => {
  for (const kind of ["article", "podcast", "data"]) {
    const global = {...item, kind, id:"global", title:"Global economic outlook", url:"https://example.org/global"};
    assert.equal(globalRelevance(global), 95);
    assert.equal(rankArticles([item,global],defaults,undefined,{},10,now)[0].id,"global");
  }
});

test("no preferred country, publisher, or keyword frequency; broad topics qualify", () => {
  assert.equal(globalRelevance({...item,title:"Kenya and Brazil trade talks"}),85);
  assert.equal(globalRelevance({...item,title:"France and Portugal trade talks"}),85);
  assert.equal(globalRelevance({...item,title:"British tourist rescued in Malawi"}),50);
  assert.equal(globalRelevance({...item,source_id:"world-publisher"}),50);
  assert.equal(globalRelevance({...item,title:"Global ".repeat(100)}),95);
  assert.equal(globalRelevance({...item,topic:"Science"}),70);
  assert.equal(globalRelevance({...item,translation:{language:"pt",title:"International trade outlook",model:"test"}}),95);
});

test("personal interests still override global defaults", () => {
  const global = {...item,id:"global",title:"International trade outlook",excerpt:"Trade outlook this week.",url:"https://example.org/global"};
  const ranked=rankArticles([global,item],{...defaults,interests:"community"},undefined,{},10,now);
  assert.equal(ranked[0].id,"local");
  assert.equal(ranked[0].ranking.factors.relevance,100);
});
