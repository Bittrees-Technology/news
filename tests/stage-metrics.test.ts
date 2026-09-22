import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {stageMetricSchema} from '../lib/stage-metrics';
test('stage metrics reject text, invalid stage, duration and authority payloads',()=>{const b={task:'briefing',id:'a'.repeat(64),lease:randomUUID(),stage:'generation',milliseconds:5};assert.equal(stageMetricSchema.safeParse(b).success,true);for(const change of [{milliseconds:-1},{milliseconds:Infinity},{stage:'prompt'},{scope:'private'}])assert.equal(stageMetricSchema.safeParse({...b,...change}).success,false);});

test('accepts separate measured model stages without changing metric authority',()=>{for(const stage of ['model_prepare','inference_request','cache_read'])assert.equal(stageMetricSchema.safeParse({task:'translation',id:'a'.repeat(64),lease:randomUUID(),stage,milliseconds:12}).success,true);});

import {stageBatchSchema} from '../lib/stage-metrics';
test('timing batches have one authority and unique bounded stages',()=>{
 const b={task:'briefing',id:'a'.repeat(64),lease:randomUUID(),metrics:[{stage:'queue',milliseconds:1},{stage:'generation',milliseconds:2}]};
 assert.equal(stageBatchSchema.safeParse(b).success,true);
 for(const metrics of [[],[b.metrics[0],b.metrics[0]],[{...b.metrics[0],lease:randomUUID()}],[{stage:'secret',milliseconds:1}]])assert.equal(stageBatchSchema.safeParse({...b,metrics}).success,false);
});
