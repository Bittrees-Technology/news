import test from 'node:test';
import assert from 'node:assert/strict';
import {rankingColumns,accountRankingColumns,uniqueChangedIds} from '../lib/ranking-projection';
import {scoreArticle,rankArticles,defaultRanking} from '../lib/scoring';
import {defaults,type Item} from '../lib/model';
import {translationKey} from '../lib/translation';
test('narrow projection preserves scores, ordering and translation identity',()=>{
 const now=new Date('2026-09-23T12:00:00Z');
 const records=Array.from({length:8},(_,n)=>({id:String(n),source_id:'source'+n,topic:n%2?'World':'Science',kind:'article',title:'International research news '+n,url:'https://example.org/'+n,excerpt:'International health research across countries. '+n,summary:n%2?'International health research':undefined,summary_kind:'extractive',published_at:'2026-09-23T10:00:00Z',owner_id:null,source_context:'large processing-only body'.repeat(100),date_basis:'publication',tags:['Science']} as Item));
 const projected=records.map(i=>Object.fromEntries(rankingColumns.split(',').map(k=>[k,i[k as keyof Item]])) as Item);
 for(let n=0;n<records.length;n++){
 assert.deepEqual(scoreArticle(projected[n],defaults,defaultRanking,75,now),scoreArticle(records[n],defaults,defaultRanking,75,now));
 assert.equal(translationKey(projected[n]),translationKey(records[n]));
 }
 assert.deepEqual(rankArticles(projected,defaults,defaultRanking,{},100,now).map(i=>i.id),rankArticles(records,defaults,defaultRanking,{},100,now).map(i=>i.id));
 assert.ok(JSON.stringify(projected).length<JSON.stringify(records).length/2);
 assert.deepEqual(uniqueChangedIds(['a','b','a']),['a','b']);
});

test("account projection qualifies the same complete scoring fields",()=>{assert.deepEqual(accountRankingColumns.split(","),rankingColumns.split(",").map(k=>`i.${k}`));});
