import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {publicJob,publicJobSchema} from '../lib/job-contract';
test('public job revisions change with evidence and reject a private scope',()=>{
 const lease=randomUUID(),j=publicJob('briefing','x',['title','evidence'],lease,80);
 assert.equal(j.contentRevision,publicJob('briefing','x',['title','evidence'],lease,80).contentRevision);
 assert.notEqual(j.contentRevision,publicJob('briefing','x',['title','changed'],lease,80).contentRevision);
 assert.equal(publicJobSchema.safeParse({...j,scope:'private'}).success,false);
 assert.equal(j.lease,lease);
});
