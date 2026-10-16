import {test} from 'node:test';
import assert from 'node:assert/strict';
import {briefingSchema} from '../lib/story-documents';
test('standalone briefings require bounded overview, key facts and limitations',()=>{
 assert.equal(briefingSchema.safeParse({overview:'Too short',points:[],context:'Source evidence provides the background for this observation.',limitations:''}).success,false);
 assert.equal(briefingSchema.safeParse({overview:'A factual overview drawn from the publisher feed evidence.',points:['A supporting fact from the source.'],context:'Source evidence provides the background for this observation.',limitations:'Only feed evidence was available.'}).success,true);
 assert.equal(briefingSchema.safeParse({overview:'x'.repeat(2300),points:['A supporting fact.'],context:'Source evidence provides the background for this observation.',limitations:'Only feed evidence available.'}).success,false);
});

test('new briefings require distinct context and limitations',()=>{
 const b={overview:'A factual overview drawn from the publisher feed evidence.',points:['A supporting fact from the source.'],context:'The study examines a defined source population.',limitations:'Only feed evidence was available.'};
 assert.equal(briefingSchema.safeParse(b).success,true);
 assert.equal(briefingSchema.safeParse({...b,context:undefined}).success,false);
 assert.equal(briefingSchema.safeParse({...b,context:b.limitations}).success,false);
});
