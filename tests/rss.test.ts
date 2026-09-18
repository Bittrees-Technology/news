import {test} from 'node:test';
import assert from 'node:assert/strict';
import Parser from 'rss-parser';
import {rssDocument} from '../lib/rss';
import type {Item} from '../lib/model';
test('RSS parses with escaped source content, stable identity and attribution',async()=>{
 const item:Item={id:'a'.repeat(64),source_id:'source',topic:'Science',kind:'article',title:'Science & <data>',url:'https://example.org/report?a=1&b=2',excerpt:'Evidence <not markup> & facts.',summary_kind:'excerpt',published_at:'2026-09-18T12:00:00Z',authors:['A & B'],publication:'Test publication'};
 const body=rssDocument({title:'TBN & friends',description:'A feed',url:'https://news.bittrees.org',self:'https://news.bittrees.org/rss.xml',items:[item]});
 const parsed=await new Parser().parseString(body);
 assert.equal(parsed.items.length,1);assert.equal(parsed.items[0].title,item.title);assert.equal(parsed.items[0].guid,'tbn:'+item.id);assert.ok(parsed.items[0].content?.includes('https://example.org/report?a=1&amp;b=2'));assert.ok(!body.includes('<not markup>'));assert.ok(!body.includes('source_context'));
});
