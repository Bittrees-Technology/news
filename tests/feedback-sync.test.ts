import test from 'node:test';
import assert from 'node:assert/strict';
import {guestFeedback,writeFeedback,watchFeedback} from '../lib/feedback-sync';
import {browserApi} from '../lib/browser-api';
const data=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)},configurable:true});
Object.defineProperty(globalThis,'window',{value:new EventTarget(),configurable:true});
test('guest interests synchronize both controls without server collection and can be removed',async()=>{
 data.clear();const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Guest feedback must stay local');};
 const first:any[]=[],second:any[]=[];const stop1=watchFeedback(c=>first.push(c)),stop2=watchFeedback(c=>second.push(c));
 try{
  await writeFeedback(false,'story',1);
  assert.equal(guestFeedback().story,1);assert.deepEqual(first,second);assert.deepEqual(first[0],{id:'story',value:1,signed:false});
  await writeFeedback(false,'story',-1);assert.equal(guestFeedback().story,-1);
  await writeFeedback(false,'story',0);assert.equal(guestFeedback().story,undefined);
  assert.ok(!data.get('tbn-feedback-change')?.includes('story'));
 }finally{stop1();stop2();globalThis.fetch=original;}
});
test('signed interests use the existing ranking endpoint and failed writes do not broadcast',async()=>{
 data.clear();browserApi.reset();const original=globalThis.fetch;let body:any,fail=false;const changes:any[]=[];const stop=watchFeedback(c=>changes.push(c));
 globalThis.fetch=async(input,init)=>{assert.equal(input,'/api/feedback');body=JSON.parse(init?.body as string);return new Response(JSON.stringify(fail?{error:'Unavailable'}:{ok:true}),{status:fail?503:200});};
 try{
  await writeFeedback(true,'story',-1);assert.deepEqual(body,{id:'story',value:-1});assert.equal(data.has('tbn-guest-votes'),false);assert.equal(changes.length,1);
  fail=true;await assert.rejects(writeFeedback(true,'story',1));assert.equal(changes.length,1);
 }finally{stop();globalThis.fetch=original;}
});
test('another tab invalidates feedback before notifying subscribers and listeners clean up',async()=>{
 const original=globalThis.fetch;browserApi.reset();let requests=0;
 globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify({story:requests}),{status:200});};
 let notifications=0;const stop=watchFeedback(()=>notifications++);
 try{
  assert.equal((await browserApi.request('feedback')).story,1);
  const event=new Event('storage');Object.defineProperty(event,'key',{value:'tbn-feedback-change'});window.dispatchEvent(event);
  assert.equal(notifications,1);assert.equal((await browserApi.request('feedback')).story,2);
  stop();window.dispatchEvent(event);assert.equal(notifications,1);
 }finally{stop();globalThis.fetch=original;browserApi.reset();}
});
