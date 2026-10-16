import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedPublicCache} from '../lib/bounded-public-cache';
test('public aggregate cache deduplicates requests, expires and rejects stale fallback', async () => {
 let time=0,calls=0; const cache=boundedPublicCache<number>(60_000,()=>time);
 const load=async()=>++calls;
 assert.deepEqual(await Promise.all([cache('public',load),cache('public',load)]),[1,1]);
 time=59_999;assert.equal(await cache('public',load),1);
 time=60_000;assert.equal(await cache('public',load),2);
 time=120_000;await assert.rejects(cache('public',async()=>{throw Error('offline')}));
 assert.equal(await cache('public',load),3);
});
test('source-set changes do not share results and old in-flight loads cannot overwrite new sets', async()=>{
 let finish!:(n:number)=>void; const cache=boundedPublicCache<number>(60_000);
 const first=cache('old-set',()=>new Promise<number>(r=>finish=r));
 await Promise.resolve();assert.equal(await cache('new-set',async()=>2),2);
 finish(1);assert.equal(await first,1);
 assert.equal(await cache('new-set',async()=>3),2);
});
