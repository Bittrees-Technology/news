import test from 'node:test';
import assert from 'node:assert/strict';
import {guestReading,loadReading,writeReading,watchReading} from '../lib/reading-sync';
const data=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)},configurable:true});
Object.defineProperty(globalThis,'window',{value:new EventTarget(),configurable:true});
test('guest read changes preserve saved status, remain local, and notify both views',async()=>{
 data.clear();data.set('bittrees-news-reading',JSON.stringify({one:{saved:true,is_read:false},two:{saved:false,is_read:true}}));
 let notifications=0;const stop=watchReading(()=>notifications++);
 await writeReading(false,'one','is_read',true);
 assert.deepEqual(guestReading(),{one:{saved:true,is_read:true},two:{saved:false,is_read:true}});
 assert.deepEqual(await loadReading(false),guestReading());assert.equal(notifications,1);
 window.dispatchEvent(new Event('focus'));assert.equal(notifications,2);stop();
 window.dispatchEvent(new Event('focus'));assert.equal(notifications,2);
});
test('signed read state uses account API without storing account history locally',async()=>{
 data.clear();let body:any;const original=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{assert.equal(input,'/api/reading');body=JSON.parse(init?.body as string);return new Response(JSON.stringify({ok:true}),{status:200});};
 try{await writeReading(true,'signed-story','is_read',true);assert.deepEqual(body,{id:'signed-story',field:'is_read',value:true});assert.equal(data.has('bittrees-news-reading'),false);assert.ok(![...data.values()].join('').includes('signed-story'));}finally{globalThis.fetch=original;}
});
test('failed account write does not broadcast a successful read',async()=>{
 const original=globalThis.fetch;let notified=0;const stop=watchReading(()=>notified++);
 globalThis.fetch=async()=>new Response(JSON.stringify({error:'Unavailable'}),{status:503});
 try{await assert.rejects(writeReading(true,'one','is_read',true));assert.equal(notified,0);}finally{stop();globalThis.fetch=original;}
});
