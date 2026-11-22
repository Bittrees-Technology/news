import test from 'node:test';
import assert from 'node:assert/strict';
import {selectTopThree,matchesEdition,editionPreferenceSchema,editorialRelevance} from '../lib/top-three';
import {scheduledPeriod} from '../lib/delivery-schedule';
import type {Item} from '../lib/model';
const at=new Date('2026-10-24T12:00:00Z');
const item=(id:string,extra:Partial<Item>={}):Item=>({id,source_id:id,title:'International trade agreement expands market access',excerpt:'Portugal and Brazil signed a trade agreement on Saturday affecting access to their export markets.',kind:'article',topic:'World',url:`https://example.org/${id}`,summary_kind:'excerpt',published_at:'2026-10-24T10:00:00Z',...extra});
test('global default excludes future/private/stale/non-article candidates and repeated events',()=>{
 const result=selectTopThree([item('a'),item('duplicate'),item('b',{title:'New international health study reports vaccine results'}),item('c',{title:'World energy policy changes electricity transmission'}),item('future',{published_at:'2026-10-24T13:00:00Z'}),item('old',{published_at:'2026-10-22T12:00:00Z'}),item('private',{owner_id:'account'}),item('podcast',{kind:'podcast'})],undefined,at);
 assert.deepEqual(result.items.map(i=>i.id),['a','b','c']);
 assert.equal(result.metrics.publishers,3);
 assert.equal(result.items[0].ranking.version,result.version);
});
test('regional ranking uses source evidence, never model-invented geography or publisher location',()=>{
 const portugal=editionPreferenceSchema.parse({scope:'region',country:'PT'});
 assert.equal(matchesEdition(item('a'),portugal),true);
 assert.equal(matchesEdition(item('b',{title:'Regional transit project',excerpt:'The city council approved the project.',summary:'This happened in Portugal.'}),portugal),false);
 assert.equal(selectTopThree([item('a')],portugal,at).items.length,1);
});
test('city requires a country and whole-word matching; no unrelated global backfill',()=>{
 assert.equal(editionPreferenceSchema.safeParse({scope:'city',city:'Lisbon'}).success,false);
 const city=editionPreferenceSchema.parse({scope:'city',country:'PT',city:'Lisbon'});
 assert.equal(matchesEdition(item('a',{title:'Lisbon opens a new tram line'}),city),true);
 assert.equal(matchesEdition(item('b',{title:'Lisbonshire proposal'}),city),false);
 assert.equal(selectTopThree([item('c')],city,at).items.length,0);
 assert.equal(editionPreferenceSchema.safeParse({scope:'region',country:'invalid'}).success,false);
 assert.equal(editionPreferenceSchema.safeParse({scope:'global',city:''}).success,true);
 assert.equal(editionPreferenceSchema.safeParse({scope:'global',city:'L'}).success,true);
});
test('publisher siblings share one top-three slot; source availability never changes editorial score',()=>{
 const a=item('a',{source_id:'bbc-world'}),b=item('b',{source_id:'bbc-business',title:'International energy project changes energy supply'});
 assert.equal(selectTopThree([a,b],undefined,at).items.length,1);
 assert.equal(selectTopThree([a],undefined,at).items[0].ranking.factors.source,50);
});
test('daily time respects timezone, fractional offsets, and stable daily idempotency keys',()=>{
 assert.equal(scheduledPeriod('daily',new Date('2026-10-24T07:29:00Z'),'09:30','Europe/Paris'),null);
 const due=scheduledPeriod('daily',new Date('2026-10-24T07:39:00Z'),'09:30','Europe/Paris')!;
 assert.equal(due.end.toISOString(),'2026-10-24T07:30:00.000Z');
 assert.equal(due.key,'daily:2026-10-24');
 assert.equal(scheduledPeriod('daily',new Date('2026-10-24T03:00:00Z'),'08:30','Asia/Kolkata')!.end.toISOString(),'2026-10-24T03:00:00.000Z');
 assert.equal(scheduledPeriod('daily',at)!.key,'daily:2026-10-24');
 assert.throws(()=>scheduledPeriod('daily',at,'24:00','UTC'));
 assert.throws(()=>scheduledPeriod('daily',at,'09:30','Invalid/Zone'));
});
test('DST gap delivers first available local minute; fold cannot create two daily keys',()=>{
 assert.equal(scheduledPeriod('daily',new Date('2026-03-29T01:10:00Z'),'02:30','Europe/Paris')!.end.toISOString(),'2026-03-29T01:00:00.000Z');
 const first=scheduledPeriod('daily',new Date('2026-10-25T00:40:00Z'),'02:30','Europe/Paris')!;
 const second=scheduledPeriod('daily',new Date('2026-10-25T01:40:00Z'),'02:30','Europe/Paris')!;
 assert.equal(first.key,second.key);
 assert.equal(first.end.toISOString(),second.end.toISOString());
});

test('global buzzwords do not beat public consequences, and regional stories retain meaningful impact ranking',()=>{
 const hype=item('hype',{title:'Global game-changing product giveaway',excerpt:'A sponsored promotion describes a worldwide brand campaign.'});
 const policy=item('policy',{title:'Portugal court ruling protects water supply',excerpt:'The court ruling sets public policy for water supply and electricity.'});
 assert.ok(editorialRelevance(policy)>editorialRelevance(hype));
 assert.ok(editorialRelevance(policy,'region')>editorialRelevance(hype,'region'));
 assert.equal(editorialRelevance(hype),editorialRelevance({...hype,title:hype.title.repeat(20)}));
});

test('historical pandemic mentions and anniversary features cannot masquerade as current public emergencies',()=>{
 const roundup=item('history',{title:'An ancient virus explains why brains evolved',excerpt:'Welcome back to the Abstract. An ancient viral pandemic affected our relatives. International research continues.'});
 const current=item('current',{title:'Parliament approves cross-border electricity treaty',excerpt:'Portugal and Spain approved an electricity treaty today, affecting energy supply.'});
 const anniversary=item('anniversary',{title:'World Kangaroo Day: climate change and wildlife',excerpt:'Australia marks an anniversary with a feature on climate change.'});
 assert.ok(editorialRelevance(current)>editorialRelevance(roundup)+30);
 assert.ok(editorialRelevance(current)>editorialRelevance(anniversary)+30);
});

test('a newly discovered useful development replaces a weaker lead without changing the 24-hour boundary',()=>{
 const baseline=[item('a'),item('b',{title:'Public health vaccine trial reduces disease'}),item('c',{title:'Court ruling protects energy supply'})];
 const fresh=item('fresh',{title:'International clinical trial discovers treatment that prevents disease',topic:'Science',excerpt:'A clinical study reports that a new treatment prevents disease in patients.',published_at:at.toISOString()});
 const before=selectTopThree(baseline,undefined,at);
 const after=selectTopThree([...baseline,fresh],undefined,at);
 assert.ok(after.items.some(i=>i.id==='fresh'));
 assert.equal(after.items.length,3);
 assert.equal(before.items.some(i=>i.id==='fresh'),false);
 assert.ok(editorialRelevance(fresh)>editorialRelevance({...fresh,title:'Sponsored game-changing product giveaway'}));
 assert.equal(editorialRelevance({...fresh,topic:'Gaming',tags:[],title:'A new game launches',excerpt:'A new edition is available today.'})<editorialRelevance(fresh),true);
});

test('an evidenced public safety order receives the same base priority independent of display ranking',async()=>{
 const {editorialBase,editorialScore,editorialFreshness}=await import('../lib/editorial-priority');
 const order=item('order',{title:'Governo declara situação de alerta',excerpt:'A Proteção Civil publicou o aviso de emergência.'});
 const drill={...order,id:'drill',title:'Simulacro: Governo declara situação de alerta'};
 const result=selectTopThree([drill,order],undefined,at);
 assert.ok(editorialBase(order)>editorialBase(drill));
 assert.equal(result.items[0].id,'order');
 assert.equal(result.items[0].ranking.value,editorialScore(editorialBase(order),editorialFreshness(order.published_at,at)));
 assert.equal(editorialBase({...order,summary:'An invented public emergency'}),editorialBase(order));
});

test('daily email backfills within the ranked shortlist after verifying exact English copy',async()=>{
 const {readyDailyLeads}=await import('../lib/top-three-public');
 const {translationKey}=await import('../lib/translation');
 const from=(id:string,title:string)=>item(id,{source_id:id,title});
 const stale=from('no','County issues red alert');
 const first=from('bbc-world','Hospital opens emergency ward');
 const sibling=from('bbc-europe','Schools resume after closures');
 const repeat=from('copy',first.title);
 const second=from('two','Reservoir provides safe drinking water');
 const third=from('three','Health agency approves new vaccine');
 const rows=[stale,first,sibling,repeat,second,third];
 const receipts=new Map(rows.slice(1).map(i=>[translationKey(i),{status:'done',result:{language:'en',model:'test'}}]));
 receipts.set(translationKey({...stale,title:'Superseded title'}),{status:'done',result:{language:'en',model:'test'}});
 assert.deepEqual(readyDailyLeads(rows,receipts).map(i=>i.id),[first.id,second.id,third.id]);
});
