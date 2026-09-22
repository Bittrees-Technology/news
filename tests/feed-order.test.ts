import {test} from 'node:test';
import assert from 'node:assert/strict';
import {feedOrder} from '../lib/feed-order';
import {recentUniqueStories} from '../lib/recent-stories';
import type {Item} from '../lib/model';
const now=Date.parse('2026-09-22T20:00:00Z');
const item=(id:string,hours:number,url='https://example.org/'+id):Item=>({id,title:id,url,source_id:'s',topic:'Tech',kind:'article',excerpt:'Evidence',summary_kind:'excerpt',published_at:new Date(now-hours*3600000).toISOString()});
test('ranked leads stay first, timeline is newest first with stable ties and no duplicates',()=>{
 const ranked=[item('old',25),item('lead1',8),item('lead2',5),item('future',-1),item('lead3',20)];
 const leads=recentUniqueStories(ranked,now).slice(0,3);
 const page=[item('a',1),item('b',1),item('lead1',8),item('yesterday',40)];
 assert.deepEqual(feedOrder([...leads,...page],leads.map(i=>i.id)).map(i=>i.id),['lead1','lead2','lead3','b','a','yesterday']);
});
test('appending older pages does not promote or repeat stories and preserves history beyond a day',()=>{
 const first=feedOrder([item('lead',10),item('new',1)],['lead']);
 const next=feedOrder([...first,item('copy',10,'https://example.org/lead?utm_source=rss'),item('old',50)],['lead']);
 assert.deepEqual(next.map(i=>i.id),['lead','new','old']);
});
