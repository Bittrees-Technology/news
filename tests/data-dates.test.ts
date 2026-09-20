import test from 'node:test';import assert from 'node:assert/strict';
import {annualObservation} from '../lib/data-dates';import {scoreArticle} from '../lib/scoring';import {defaults} from '../lib/model';
test('annual observations preserve period, unknown release and zero freshness across retrievals',()=>{
 const a=annualObservation('2024','2026-09-20T00:00:00Z'),b=annualObservation('2024','2026-09-21T00:00:00Z');assert.equal(a.published_at,b.published_at);assert.equal(a.released_at,null);assert.notEqual(a.retrieved_at,b.retrieved_at);
 for(const dates of [a,b])assert.equal(scoreArticle({...dates,id:'x',source_id:'wb',kind:'data',topic:'Economy',title:'GDP observation',url:'https://example.org',excerpt:'Annual historical data',summary_kind:'excerpt'},defaults).factors.freshness,0);
 assert.throws(()=>annualObservation('2099','2026-09-20T00:00:00Z'));
});
