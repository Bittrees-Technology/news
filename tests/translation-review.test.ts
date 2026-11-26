import test from 'node:test';
import assert from 'node:assert/strict';
import {translationFingerprint,isTranslationApproved,translationDecisionSchema} from '../lib/translation-review';
import {englishDigestItems} from '../lib/digest-language';
import {translationKey} from '../lib/translation';
import type {Item} from '../lib/model';

const key='a'.repeat(64);
const payload={title:'A juíza julga crimes de guerra',summary:'A juíza foi sancionada.'};
const result={language:'pt',title:'A judge tries war-crimes cases',summary:'The judge was sanctioned.',model:'fixture'};
const approved={key,payload,result,review_category:'translation_approved',review_note:JSON.stringify({fingerprint:translationFingerprint(key,payload,result),note:'Checked against the original.'})};
test('only review of the exact source and output authorizes a translation',()=>{
 assert.equal(isTranslationApproved(approved),true);
 assert.equal(isTranslationApproved({...approved,review_category:null}),false);
 assert.equal(isTranslationApproved({...approved,review_category:'translation_rejected'}),false);
 assert.equal(isTranslationApproved({...approved,payload:{...payload,title:'Different source'}}),false);
 assert.equal(isTranslationApproved({...approved,result:{...result,title:'Judge is being tried'}}),false);
 assert.equal(isTranslationApproved({...approved,review_note:'invalid'}),false);
 assert.equal(translationFingerprint(key,{a:1,b:2},result),translationFingerprint(key,{b:2,a:1},result));
});
test('decision input requires a revision and explicit review findings',()=>{
 const d={key,fingerprint:translationFingerprint(key,payload,result),decision:'approve',note:'Compared both texts carefully.'};
 assert.equal(translationDecisionSchema.safeParse(d).success,true);
 assert.equal(translationDecisionSchema.safeParse({...d,fingerprint:'stale'}).success,false);
 assert.equal(translationDecisionSchema.safeParse({...d,note:'ok'}).success,false);
 assert.equal(translationDecisionSchema.safeParse({...d,grant:true}).success,false);
});
test('unreviewed translations do not enter English digests',()=>{
 const source:Item={id:key,source_id:'observador',topic:'World',kind:'article',url:'https://example.org/story',title:payload.title,excerpt:payload.summary,summary_kind:'excerpt',published_at:'2026-11-26T10:00:00Z'};
 const candidate={...source,translation_key:translationKey(source),translation_status:'done',translation:result};
 assert.deepEqual(englishDigestItems([candidate]),[]);
 assert.equal(englishDigestItems([{...candidate,translation_reviewed:true}])[0].title,result.title);
});

test('language recognition requires review for unclassified sources',()=>{
 const recognized={language:'en',model:'fixture'};
 assert.equal(isTranslationApproved({key,payload,result:recognized}),false);
 assert.equal(isTranslationApproved({key,payload,result:recognized,review_category:'translation_approved',review_note:JSON.stringify({fingerprint:translationFingerprint(key,payload,recognized)})}),true);
});
