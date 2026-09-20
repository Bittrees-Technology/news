import test from 'node:test';import assert from 'node:assert/strict';import {engagementSchema} from '../lib/engagement';
test('engagement accepts only bounded event metadata, not arbitrary tracking payloads',()=>{
 assert.equal(engagementSchema.safeParse({id:'a'.repeat(64),type:'impression'}).success,true);
 for(const type of ['pageview','wallet','keystroke'])assert.equal(engagementSchema.safeParse({id:'a'.repeat(64),type}).success,false);
 assert.equal(engagementSchema.safeParse({id:'a'.repeat(64),type:'source_click',url:'secret'}).success,false);
});
