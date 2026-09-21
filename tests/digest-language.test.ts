import { test } from "node:test";
import assert from "node:assert/strict";
import { englishDigestItems } from "../lib/digest-language";
import { translationKey } from "../lib/translation";
import { newspaperEmail } from "../lib/newspaper-email";
import type { Item } from "../lib/model";
const source: Item = {id:"pt",source_id:"eco",title:"Notícias de Portugal",summary:"O orçamento foi anunciado hoje.",excerpt:"O orçamento foi anunciado hoje.",topic:"Economy",kind:"article",url:"https://example.org/article",published_at:"2026-09-21T10:00:00Z",summary_kind:"excerpt"};
const ready: Item = {...source,translation_key:translationKey(source),translation_status:"done",translation:{language:"pt",title:"News from Portugal",summary:"The budget was announced today.",model:"test"}};
test("English digest uses translated copy in HTML and plain-text item fields",()=>{
 const [item]=englishDigestItems([ready]);
 assert.equal(item.title,"News from Portugal"); assert.equal(item.summary,"The budget was announced today.");
 const html=newspaperEmail("TBN",[item],"2026-09-21","https://example.org/unsubscribe");
 assert.ok(html.includes(item.title)); assert.ok(html.includes(item.summary!)); assert.ok(!html.includes(source.title)); assert.ok(!html.includes(source.summary!));
});
test("pending, failed, unavailable, malformed and stale translations cannot leak original text",()=>{
 for(const item of [source,{...ready,translation_status:"pending"},{...ready,translation_status:"failed"},{...ready,translation:undefined},{...ready,summary:"Private owner edit",user_edited:true},{...ready,translation:{language:"pt",model:"test"}}]) assert.deepEqual(englishDigestItems([item]),[]);
 assert.equal(englishDigestItems([source,ready]).length,1);
});
test("verified English original keeps its wording and metadata",()=>{
 const item={...source,title:"English headline",summary:"English summary"};
 const verified={...item,translation_key:translationKey(item),translation_status:"done",translation:{language:"en",model:"test"}};
 assert.deepEqual(englishDigestItems([verified]),[verified]);
});
