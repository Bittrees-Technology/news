import test from 'node:test';import assert from 'node:assert/strict';import {currentLocalRoleRows} from '../lib/current-role-feed';
const rows=[{value:'0x'+'a'.repeat(40),role:'super_admin',protected:true}];
test('central enrollment excludes protected historical grants without reading or deleting records',async()=>{
 let reads=0;const load=async()=>{reads++;return rows};
 assert.deepEqual(await currentLocalRoleRows(load,async()=>({enrolled:true})),[]);
 assert.equal(reads,0);assert.equal(rows[0].role,'super_admin');
});
test('explicitly unenrolled source retains legacy assignments',async()=>{assert.deepEqual(await currentLocalRoleRows(async()=>rows,async()=>({enrolled:false})),rows)});
test('authority failures and malformed enrollment never fall back to old grants',async()=>{let reads=0;const load=async()=>{reads++;return rows};await assert.rejects(currentLocalRoleRows(load,async()=>{throw Error('offline')}),/offline/);await assert.rejects(currentLocalRoleRows(load,async()=>({})),/enrollment/);assert.equal(reads,0)});
test('oversized legacy roster fails instead of silently truncating',async()=>{await assert.rejects(currentLocalRoleRows(async()=>Array(1001).fill(rows[0]),async()=>({enrolled:false})),/limit/)});
