import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionMinutes,retryMinutes} from '../lib/collection-policy';
test('collection frequency matches source update patterns',()=>{
 assert.equal(collectionMinutes({type:'article',kind:'rss'}),15);
 assert.equal(collectionMinutes({type:'podcast',kind:'rss'}),60);
 assert.equal(collectionMinutes({type:'data',kind:'worldbank'}),1440);
 assert.equal(collectionMinutes({type:'data',kind:'defillama'}),15);
 assert.equal(collectionMinutes({type:'article',kind:'hfpapers'}),60);
});
test('failures back off and respect publisher retry-after without hammering daily sources',()=>{
 assert.equal(retryMinutes(15,1),30);assert.equal(retryMinutes(15,2),60);
 assert.equal(retryMinutes(15,10),360);assert.equal(retryMinutes(15,1,403),1440);
 assert.equal(retryMinutes(15,1,429,7200),120);assert.equal(retryMinutes(1440,1),1440);
});

import {isOverdue} from '../lib/collection-policy';
test('overdue checks respect next scheduled poll and backoff',()=>{
 const now=Date.parse('2026-09-20T12:00:00Z');
 assert.equal(isOverdue('2026-09-20T11:40:00Z',15,now),true);
 assert.equal(isOverdue('2026-09-20T11:50:00Z',15,now),false);
 assert.equal(isOverdue('2026-09-21T00:00:00Z',15,now),false);
});

test('rate limits get at least an hour without shortening longer cooldowns',()=>{
 assert.equal(retryMinutes(15,1,429),60);
 assert.equal(retryMinutes(15,1,429,10),60);
 assert.equal(retryMinutes(15,1,429,7200),120);
 assert.equal(retryMinutes(15,5,429),360);
 assert.equal(retryMinutes(1440,1,429),1440);
});
