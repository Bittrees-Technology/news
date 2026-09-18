import {test} from 'node:test';
import assert from 'node:assert/strict';
import {articleTags,normalizeTopic,tagStyle} from '../lib/tags';
import {communityAdjustment} from '../lib/feedback';
import {matches,defaults,type Item} from '../lib/model';
import {rankArticles,defaultRanking} from '../lib/scoring';
const item:Item={id:'x',source_id:'s',topic:'Apple',kind:'article',title:'Bitcoin DAOs debate election legislation',excerpt:'Ethereum governance and politics.',summary_kind:'excerpt',url:'https://example.org',published_at:'2026-09-18T12:00:00Z'};
test('article tags overlap, replace brand labels and match user filters',()=>{
 assert.deepEqual(articleTags(item),['Tech','Bitcoin','Crypto','Politics','DAOs']);
 assert.equal(normalizeTopic('Nintendo'),'Gaming');
 assert.ok(matches(item,{...defaults,topics:['DAOs']}));
 assert.ok(!matches(item,{...defaults,topics:['Health']}));
 assert.deepEqual(tagStyle('Bitcoin'),tagStyle('Bitcoin'));
});
test('feedback needs five distinct voters and stays bounded',()=>{
 assert.equal(communityAdjustment(4,4,10),0);
 assert.equal(communityAdjustment(0,6,10),0);
 assert.ok(communityAdjustment(5,5,10)>0);
 assert.ok(communityAdjustment(-5,5,10)<0);
 assert.ok(communityAdjustment(1000,1000,10)<=10);
 const now=new Date('2026-09-18T13:00:00Z');
 const base=rankArticles([item],defaults,defaultRanking,{},10,now)[0].ranking.value;
 assert.equal(rankArticles([item],defaults,defaultRanking,{},10,now,{x:-5})[0].ranking.value,Math.round((base-5)*10)/10);
});
