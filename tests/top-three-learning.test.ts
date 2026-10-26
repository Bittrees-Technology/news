import test from 'node:test';
import assert from 'node:assert/strict';
import {learnedInterest,interestAdjustment} from '../lib/top-three-learning';
import {selectTopThree} from '../lib/top-three';
import type {Item} from '../lib/model';
test('learning holds sparse evidence neutral and caps both positive and negative adjustments',()=>{
 assert.equal(learnedInterest({readers:4,votes:200,total:4}),0);
 assert.equal(learnedInterest({readers:20,votes:19,total:20}),0);
 assert.equal(learnedInterest(),0);
 assert.ok(learnedInterest({readers:100,votes:100,total:100})<=3);
 assert.ok(learnedInterest({readers:100,votes:100,total:-100})>=-3);
 assert.ok(interestAdjustment('Science','one',{topics:{Science:{readers:100,votes:100,total:100}},stories:{one:{readers:100,votes:100,total:100}}})<=6);
});
test('interest changes close rankings but never makes stale/private stories eligible',()=>{
 const at=new Date('2026-10-26T12:00:00Z');
 const item=(id:string,extra:Partial<Item>={}):Item=>({id,source_id:id,topic:'Science',kind:'article',title:'Study '+id+' reports treatment results',excerpt:'A clinical study reports research on treatment for patients and disease.',summary_kind:'excerpt',url:'https://example.com/'+id,published_at:at.toISOString(),...extra});
 const rows=['a','b','c','d'].map(id=>item(id,{title:({a:'Study reports heart treatment results',b:'Research finds new water purification method',c:'Study finds energy storage improvement',d:'Researchers discover vaccine treatment'}[id])!}));
 const evidence={topics:{},stories:{d:{readers:100,votes:100,total:100},private:{readers:100,votes:100,total:100},stale:{readers:100,votes:100,total:100}}};
 const result=selectTopThree([...rows,item('private',{owner_id:'account'}),item('stale',{published_at:'2026-10-24T12:00:00Z'})],undefined,at,evidence);
 assert.ok(result.items.some(i=>i.id==='d'));
 assert.ok(result.items.every(i=>!['private','stale'].includes(i.id)));
 assert.ok(result.items.every(i=>Math.abs(i.ranking.feedbackAdjustment||0)<=6));
});
