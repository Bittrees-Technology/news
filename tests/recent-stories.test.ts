import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recentUniqueStories} from '../lib/recent-stories';
import type {Item} from '../lib/model';
const now=Date.parse('2026-09-19T12:00:00Z');
const item=(id:string,hours:number,url='https://example.org/'+id):Item=>({id,title:id,url,source_id:'source',topic:'Tech',kind:'article',excerpt:'Evidence',summary_kind:'excerpt',published_at:new Date(now-hours*3600000).toISOString()});
test('rolling day excludes old, future and invalid dates while preserving ranked order',()=>{
 assert.deepEqual(recentUniqueStories([item('first',12),item('second',1),item('old',25),item('future',-1),item('boundary',24)],now).map(i=>i.id),['first','second','boundary']);
});
test('deduplicates tracking links, repeated IDs and equivalent titles',()=>{
 const first=item('first',1,'https://example.org/a?utm_source=x');
 assert.deepEqual(recentUniqueStories([first,item('second',2,'https://example.org/a?utm_source=y'),{...item('third',3),title:'FIRST!'},first],now).map(i=>i.id),['first']);
});
