import test from 'node:test';
import assert from 'node:assert/strict';
import {briefingPath,briefingShortId} from '../lib/briefing-links';
test('short aliases use CID-specific suffix rather than shared CID prefix',()=>{
 const first='bafy'+'a'.repeat(40),second='bafy'+'b'.repeat(40);
 assert.equal(briefingShortId(first).length,20);assert.notEqual(briefingShortId(first),briefingShortId(second));
 assert.equal(briefingPath({id:'one',cid:first}),'/briefings/'+'a'.repeat(20));
 assert.equal(briefingPath({id:'one'}),'/story/one');assert.throws(()=>briefingShortId('../not-a-cid'));
});
