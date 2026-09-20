import test from 'node:test';import assert from 'node:assert/strict';import {diversityShadow} from '../lib/diversity-shadow';import type {Item} from '../lib/model';
test('shadow diversifies publishers and duplicate headlines without mutating order',()=>{
 const make=(id:string,source_id:string,title:string)=>({id,source_id,title,topic:'World',excerpt:'',summary_kind:'excerpt',kind:'article',url:'https://example.org',published_at:'2026-09-20T00:00:00Z'} as Item);
 const items=[make('1','bbc-world','Global interest rates climb sharply'),make('2','bbc-business','Central banks reduce borrowing costs'),make('3','other','Global interest rates climb sharply'),make('4','africanews','Africa trade talks reach agreement'),make('5','cna-asia','Asian science investment expands')];const before=JSON.stringify(items),r=diversityShadow(items);assert.deepEqual(r.candidate.ids,['1','4','5']);assert.equal(JSON.stringify(items),before);assert.equal(r.baseline.publishers,2);
});
