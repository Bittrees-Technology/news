import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sourceEvidence,evidenceLabel} from '../lib/source-evidence';
const base={title:'Observation',kind:'article',source_id:'publisher'};
test('even long feed evidence never implies complete text or known language',()=>{
 const e=sourceEvidence({...base,source_context:'a'.repeat(12000),fetched_at:'2026-09-19T00:00:00Z'});
 assert.equal(e.completeness,'partial');assert.equal(e.fullTextStatus,'not-acquired');assert.equal(e.sourceLanguage,null);
 assert.equal(e.retrievedAt,'2026-09-19T00:00:00.000Z');
 assert.notEqual(e.revision,sourceEvidence({...base,source_context:'changed'}).revision);
});
test('missing bodies and dates remain unknown; podcast descriptions and snapshots stay distinct',()=>{
 const e=sourceEvidence({...base,fetched_at:'invalid'});assert.equal(e.kind,'title-only');assert.equal(e.completeness,'unavailable');assert.equal(e.retrievedAt,null);
 assert.equal(sourceEvidence({...base,kind:'podcast',excerpt:'Description'}).kind,'episode-description');
 const data=sourceEvidence({...base,kind:'data',source_id:'world-bank-gdp',excerpt:'Annual change'});assert.equal(data.kind,'structured-observation');assert.equal(data.completeness,'partial');
 assert.match(evidenceLabel('episode-description'),/not a full transcript/);
});
