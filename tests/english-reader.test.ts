import test from 'node:test';
import assert from 'node:assert/strict';
import {englishReaderItem} from '../lib/english-reader';
import {looksPortuguese,briefingLooksPortuguese} from '../lib/language-guard';
import {translationKey} from '../lib/translation';
import type {Item} from '../lib/model';
const item:Item={id:'test',source_id:'eco',topic:'World',kind:'article',title:'Portugal anuncia medidas para uma nova política',summary:'O governo anunciou que não será possível concluir o plano.',excerpt:'O governo anunciou que não será possível concluir o plano.',summary_kind:'excerpt',url:'https://example.org',published_at:'2026-11-26T10:00:00Z'};
const approved={...item,translation_key:translationKey(item),translation_status:'done',translation_reviewed:true,translation:{language:'pt',title:'Portugal announces new policy measures',summary:'The government said the plan could not be completed.',model:'fixture'}};
test('pending, failed, unreviewed and stale copy use an English holding message',()=>{
 for(const source of [item,{...approved,translation_reviewed:false},{...approved,translation_status:'failed'},{...approved,summary:'Altered source'}]){
  const display=englishReaderItem(source);assert.equal(display.title,'English translation awaiting review');assert.ok(!JSON.stringify(display).includes('política'));assert.equal(display.id,item.id);assert.equal(display.url,item.url);
 }
});
test('exact approved translations are rendered in English without source fallback',()=>{
 const display=englishReaderItem(approved);assert.equal(display.title,approved.translation.title);assert.equal(display.summary,approved.translation.summary);assert.ok(!JSON.stringify(display).includes('política'));
});
test('identified English displays the exact original without a model rewrite',()=>{
 const en={...item,title:'A public announcement',summary:'The government announced a new policy.',excerpt:'The government announced a new policy.'};
 const recognized={...en,translation_key:translationKey(en),translation_status:'done',translation:{language:'en',model:'fixture'}};
 assert.equal(englishReaderItem(recognized).title,'English translation awaiting review');
 assert.equal(englishReaderItem({...recognized,translation_reviewed:true}).title,en.title);
});
test('obvious Portuguese is held even if marked English, including generated briefings',()=>{
 assert.equal(looksPortuguese(item.title+' '+item.summary),true);
 assert.equal(looksPortuguese('Portugal announces a new public policy today.'),false);
 assert.equal(briefingLooksPortuguese({overview:item.title,points:[item.summary!]}),true);
 const bad={...approved,translation:{...approved.translation,title:item.title,summary:item.summary!}};
 assert.equal(englishReaderItem(bad).title,'English translation awaiting review');
 const document={briefing:{overview:item.title,points:[item.summary!]}};
 assert.equal((englishReaderItem({...approved,document}) as any).document,undefined);
});
