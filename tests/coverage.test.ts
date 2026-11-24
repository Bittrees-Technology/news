import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Item} from '../lib/model';
import {geographyFor} from '../lib/geography';
import {subjectEvidence} from '../lib/story-subjects';
import {coverageCandidates,articleRevision} from '../lib/coverage-review';
import {checkedCoverage,coverageEdit} from '../lib/coverage-store';
import {groupCoverage} from '../lib/coverage';
import {newspaperEmail,coverageText} from '../lib/newspaper-email';
import {variedPages} from '../lib/feed-order';
import {publisherFamily} from '../lib/diversity-shadow';
import {defaultReaderFilters,guestReaderFilters,matchesReaderFilters} from '../lib/reader-filters';
const article=(key:string,source:string,title='Power outage in Mozambique'):Item=>({id:key.repeat(64),source_id:source,
  title,excerpt:'The utility restored electricity in three districts.',published_at:'2026-11-21T04:00:00Z',
  url:'https://example.org/'+key,kind:'article',topic:'Portugal',summary_kind:'excerpt'});
const a=article('a','p-blico'),b=article('b','bbc-world'),rows=[a,b];
const edit=coverageEdit.parse({id:'f953e187-8722-4439-beca-54e35980a827',expectedVersion:0,state:'approved',
  title:'Power returns in Mozambique',reports:rows.map(i=>({id:i.id,revision:articleRevision(i),origin:i.source_id})),
  claims:[{text:'The utility restored electricity in three districts.',evidence:[{id:a.id,quote:a.excerpt}]}]});
test('geography and publisher identity are independent, and subject evidence preserves its span',()=>{
  assert.deepEqual(geographyFor(a).countries,['MZ']);assert.equal(publisherFamily(a),'publico.pt');
  const hit=subjectEvidence(a)[0];assert.equal(hit.id,'energy.grid.outage');assert.equal(a.title.slice(hit.start,hit.end),'Power outage');
  assert.equal(subjectEvidence({...a,title:'Other',excerpt:''}).length,0);
  assert.equal(subjectEvidence({...a,title:'Corte de energia em Maputo'})[0].label,'Grid outages');
  assert.equal(coverageCandidates([a,b]).length,1);assert.equal(coverageCandidates([a,{...b,owner_id:'private'}]).length,0);
});
test('only validated public reports and supported passages reach a grouped card or email',()=>{
  const event=checkedCoverage(edit,rows,1);const items=rows.map(i=>({...i,coverage:event}));
  assert.equal(groupCoverage(items).length,1);assert.equal(groupCoverage([items[0]])[0].coverage,undefined);
  assert.equal(event.claims[0].reports[0],a.id);
  assert(!JSON.stringify(event).includes('"quote"'));
  const html=newspaperEmail('Daily',items.slice(0,1),'2026-11-24','https://example.org/pause',undefined,true);
  for(const i of rows)assert(html.includes(i.url)&&coverageText(items[0]).includes(i.url));
  for(const modified of [[{...a,title:'Correction'},b],[a,{...b,owner_id:'private'}],[a]])
    assert.throws(()=>checkedCoverage(edit,modified,1));
  assert.throws(()=>checkedCoverage({...edit,reports:edit.reports.map(r=>({...r,origin:'Reuters'}))},rows,1));
  assert.throws(()=>checkedCoverage({...edit,claims:[{text:'An unsupported date',evidence:[{id:b.id,quote:'A missing quotation'}]}]},rows,1));
});
test('bounded variation preserves leads, page history, read choices and excluded sources of geography',()=>{
  const items=Array.from({length:65},(_,n)=>({...a,id:String(n),source_id:n%5===4?'b':'a'}));
  const pages=[items.slice(0,30).map(i=>i.id),items.slice(30).map(i=>i.id)];
  const first=variedPages(items.slice(0,30),['0'],pages.slice(0,1),i=>i.source_id);
  const all=variedPages(items,['0'],pages,i=>i.source_id);
  assert.deepEqual(all.slice(0,30),first);assert.equal(all[0].id,'0');assert.equal(all[2].source_id,'b');
  assert.equal(new Set(all.map(i=>i.id)).size,items.length);
  for(const f of [defaultReaderFilters,guestReaderFilters(defaultReaderFilters)])assert(matchesReaderFilters([],geographyFor(a),f));
  assert(!matchesReaderFilters([],geographyFor(a),{...defaultReaderFilters,excludedCountries:['MZ']}));
});
