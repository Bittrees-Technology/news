import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../lib/model';
import {topicSettingsState} from '../lib/topic-settings-state';
const blocks={excludedTopics:['Gaming','Crypto'],excludedCountries:['US','GB'],excludedRegions:[]};
test('restoring the same choices in another order leaves no unsaved changes',()=>{
 const prefs={...defaults,topics:['Science','Energy']};
 assert.equal(topicSettingsState(prefs,blocks),topicSettingsState({...prefs,topics:['Energy','Science'],sources:['another-source']},{...blocks,excludedTopics:['Crypto','Gaming'],excludedCountries:['GB','US']}));
});
test('actual topic, place, interest, phrase and delivery-length edits remain unsaved',()=>{
 const original=topicSettingsState(defaults,blocks);
 for(const prefs of [{...defaults,topics:['Science']},{...defaults,interests:'Energy'},{...defaults,blocked:['climate']},{...defaults,length:5}])assert.notEqual(topicSettingsState(prefs,blocks),original);
 assert.notEqual(topicSettingsState(defaults,{...blocks,excludedCountries:[]}),original);
 assert.equal(topicSettingsState({...defaults,blocked:['  climate  ','']},blocks),topicSettingsState({...defaults,blocked:['climate']},blocks));
});
