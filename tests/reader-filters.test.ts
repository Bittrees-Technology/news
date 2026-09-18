import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readerFiltersSchema,matchesReaderFilters,interactionAdjustment,exclusionFilters} from '../lib/reader-filters';
test('hide read defaults on; multiple inclusions use OR and exclusions override',()=>{
 const f=readerFiltersSchema.parse({topics:['Crypto','Science'],excludedTopics:['Politics'],countries:['US','PT'],excludedRegions:['Asia']});
 assert.equal(f.hideRead,true);
 assert.equal(matchesReaderFilters(['Science'],{countries:['PT'],regions:['Europe']},f),true);
 assert.equal(matchesReaderFilters(['Crypto','Politics'],{countries:['PT'],regions:['Europe']},f),false);
 assert.equal(matchesReaderFilters(['Crypto'],{countries:['US'],regions:['Asia']},f),false);
 assert.equal(matchesReaderFilters(['Crypto'],{countries:['FR'],regions:['Europe']},f),false);
});
test('account interactions carry five times the personal weight of guest actions',()=>{
 assert.equal(interactionAdjustment(1,true,false,true),5*interactionAdjustment(1,true,false,false));
 assert.ok(interactionAdjustment(-1,false,false,false)<0);
 assert.ok(interactionAdjustment(0,false,true,true)<0);
 assert.equal(interactionAdjustment(0,false,false,true),0);
});

test('exclusion-only controls migrate old inclusions and keep saved exclusions and sort',()=>{
 const f=exclusionFilters(readerFiltersSchema.parse({topics:['Science'],countries:['PT'],regions:['Europe'],excludedTopics:['Crypto'],sort:'saved'}));
 assert.deepEqual(f.topics,[]);assert.deepEqual(f.countries,[]);assert.deepEqual(f.regions,[]);
 assert.equal(f.sort,'saved');assert.equal(matchesReaderFilters(['Tech'],{countries:['US'],regions:['North America']},f),true);
 assert.equal(matchesReaderFilters(['Crypto'],{countries:[],regions:[]},f),false);
 assert.equal(readerFiltersSchema.parse({}).sort,'score');
});
