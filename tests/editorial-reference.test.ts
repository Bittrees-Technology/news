import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEditorialReference,resolveEditorialReference} from '../lib/editorial-reference';
test('review references accept article IDs, compact and legacy briefing links and CID',()=>{
 const id='a'.repeat(64),cid='bafy'+'c'.repeat(40);
 assert.deepEqual(parseEditorialReference(id),{kind:'article',value:id});
 for(const value of ['a'.repeat(12),'a'.repeat(20),cid])assert.equal(parseEditorialReference(value).kind,'briefing');
 assert.equal(parseEditorialReference('https://news.bittrees.org/briefings/abcdefghijkl').value,'abcdefghijkl');
 assert.equal(parseEditorialReference('https://news.bittrees.org/story/'+id).value,id);
 assert.equal(parseEditorialReference('https://news.bittrees.org/briefings?story='+id).value,id);
 for(const bad of ['https://evil.example/briefings/abcdefghijkl','../../secret','bad','https://news.bittrees.org/account'])assert.throws(()=>parseEditorialReference(bad));
});
test('resolver requires public records and keeps selected archived CID',async()=>{
 const cid='bafy'+'c'.repeat(40);let query='';
 const target={item_id:'a'.repeat(64),briefing_cid:cid};
 const result=await resolveEditorialReference({query:async(sql:string)=>{query=sql;return {rows:[target]};}},cid);
 assert.deepEqual(result,target);assert.match(query,/owner_id IS NULL/);assert.match(query,/briefing_versions/);
 await assert.rejects(resolveEditorialReference({query:async()=>({rows:[]})},cid),/not found/);
});
