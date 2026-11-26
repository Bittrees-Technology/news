import test from 'node:test';
import assert from 'node:assert/strict';
import {correctProstDisplay,prostStoryId,prostBriefingCid,briefingSearchNote} from '../lib/briefing-search-review';
import {briefingMetadata,briefingSchema} from '../lib/briefing-seo';

test('the disputed article renders the source role and holds the archived briefing', () => {
  const item={id:prostStoryId,title:'Original source',excerpt:'Apps not working.',summary:'Apps not working.',translation:{title:'Incorrect translation'}};
  const corrected=correctProstDisplay(item);
  assert.match(corrected.title,/judge.*tries war-crimes cases/i);
  assert.equal(corrected.translation,undefined);
  assert.doesNotMatch(corrected.excerpt,/apps/i);
  assert.match(briefingSearchNote(prostBriefingCid)!,/withdrawn/i);
  const seo={...corrected,url:'https://example.org',cid:prostBriefingCid,document:{briefing:{overview:'Unsupported overview'}}};
  assert.deepEqual(briefingMetadata(seo,'/story/example').robots,{index:false,follow:true});
  assert.equal(briefingSchema(seo,'/story/example'),null);
  assert.equal(correctProstDisplay({...item,id:'another'}).translation,item.translation);
});
