import {test} from 'node:test';
import assert from 'node:assert/strict';
import {briefingSchema} from '../lib/story-documents';
test('standalone briefings require bounded overview, key facts and limitations',()=>{
 assert.equal(briefingSchema.safeParse({overview:'Too short',points:[],limitations:''}).success,false);
 assert.equal(briefingSchema.safeParse({overview:'A factual overview drawn from the publisher feed evidence.',points:['A supporting fact from the source.'],limitations:'Only feed evidence was available.'}).success,true);
 assert.equal(briefingSchema.safeParse({overview:'x'.repeat(2300),points:['A supporting fact.'],limitations:'Only feed evidence available.'}).success,false);
});
