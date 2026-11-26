import test from 'node:test';
import assert from 'node:assert/strict';
import {isFeedFailure,cleanFailureText,failedEvidence} from '../lib/feed-safeguards';
import {sourceEvidence} from '../lib/source-evidence';
import {rssItems} from '../lib/collect';
import {sources} from '../lib/catalog';
import {sourceIsEnglish,withTranslations,translationKey,translationNumbersSupported} from '../lib/translation';
import {englishDigestItems} from '../lib/digest-language';
import type {Item} from '../lib/model';

const item:Item={id:'a'.repeat(64),source_id:'al-jazeera',topic:'World',kind:'article',title:'Judge tries war crimes cases',url:'https://www.aljazeera.com/news/example',excerpt:'Apps not working.',summary_kind:'excerpt',published_at:'2026-11-26T12:00:00Z'};
test('standalone transport errors are suppressed while actual reporting about outages survives', async()=>{
 for(const text of ['Apps not working.','Access denied','ERROR 503','Please enable JavaScript']) assert.equal(isFeedFailure(text),true);
 for(const text of ['Apps not working after the storm leaves thousands without access','Judge tries war crimes cases','A short summary.']) assert.equal(isFeedFailure(text),false);
 const cleaned=cleanFailureText(item);
 assert.equal(cleaned.excerpt,'');
 assert.equal(cleanFailureText({...item,excerpt:'Apps not working after the storm'}).excerpt,'Apps not working after the storm');
 const s=sources.find(x=>x.id==='al-jazeera')!;
 const xml=(description:string)=>`<rss version="2.0"><channel><title>News</title><item><title>Judge tries war crimes cases</title><link>https://www.aljazeera.com/news/example</link><description>${description}</description><pubDate>Thu, 26 Nov 2026 11:00:00 GMT</pubDate></item></channel></rss>`;
 assert.equal((await rssItems(s,xml('Apps not working.'),'2026-11-26T12:00:00Z',undefined,s)).length,0);
 assert.equal((await rssItems(s,xml('Apps not working after the storm.'),'2026-11-26T12:00:00Z',undefined,s)).length,1);
});
test('old briefing is held only when failure text matches its frozen evidence revision',()=>{
 const row={...item,source_context:item.excerpt};
 const revision=sourceEvidence(row).revision;
 assert.equal(failedEvidence({...row,document:{evidence:{revision}}}),true);
 assert.equal(failedEvidence({...row,document:{evidence:{revision:'other'}}}),false);
 assert.equal(failedEvidence({...row,document:{}}),false);
});
test('trusted English feeds bypass model translations without changing private sources',async()=>{
 assert.equal(sourceIsEnglish(item),true);
 assert.equal(sourceIsEnglish({...item,owner_id:'personal'}),false);
 const [result]=await withTranslations([item]);
 assert.equal(result.title,item.title);
 assert.equal(result.excerpt,'');
 assert.equal(result.translation?.language,'en');
 assert.equal(result.translation_key,translationKey(result));
 assert.equal(sourceIsEnglish({...item,source_id:'observador'}),false);
});

test('translation numeric claims must occur in the source',()=>{
 const original={title:'Mais de 20 pessoas',summary:'Em 2024, a população caiu.'};
 assert.equal(translationNumbersSupported(original,{title:'More than 20 people',summary:'The population fell in 2024.'}),true);
 assert.equal(translationNumbersSupported(original,{title:'More than 200 people',summary:'The population fell in 2024.'}),false);
 assert.equal(translationNumbersSupported(original,{title:'More than 20 people',summary:'The population fell in 2025.'}),false);
});

test('digest rejects source errors and preserves originals for known English sources',()=>{
 assert.equal(englishDigestItems([item]).length,0);
 const legitimate={...item,excerpt:'A real short report.',translation:{language:'fr',title:'Wrong title',summary:'Wrong summary',model:'fixture'}};
 assert.equal(englishDigestItems([legitimate])[0].title,item.title);
});
