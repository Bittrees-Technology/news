import {z} from 'zod';
import {countries,regions,geographyFor,matchesGeography} from './geography';
import {publisherFamily,sameEvent} from './diversity-shadow';
import {globalRelevance} from './global-relevance';
import {rankArticles,rankingSchema} from './scoring';
import {defaults,type Item} from './model';
export const editionPreferenceSchema=z.object({
 scope:z.enum(['global','region','city']).default('global'),
 country:z.string().default(''),region:z.string().max(80).default(''),
 city:z.string().trim().max(80).optional(),
}).superRefine((v,c)=>{
 if(v.country&&!countries.some(x=>x.code===v.country))c.addIssue({code:'custom',message:'Choose a valid country.',path:['country']});
 if(v.region&&!regions.includes(v.region))c.addIssue({code:'custom',message:'Choose a valid region.',path:['region']});
 if(v.scope==='region'&&!v.country&&!v.region)c.addIssue({code:'custom',message:'Choose a country or region.',path:['country']});
 if(v.scope==='city'&&(!v.country||!v.city||v.city.length<2))c.addIssue({code:'custom',message:'Choose a city and its country.',path:['city']});
});
export type EditionPreference=z.infer<typeof editionPreferenceSchema>;
export const globalEdition=editionPreferenceSchema.parse({});
const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function matchesEdition(i:Item,p:EditionPreference){
 if(p.scope==='global')return true;
 // Source text only: model-written summaries and publisher addresses cannot establish a place.
 const evidence={title:i.title,excerpt:i.excerpt,summary:'',topic:''};
 const geo=geographyFor(evidence);
 if(!matchesGeography(geo,p.country,p.scope==='city'?'':p.region))return false;
 if(p.scope!=='city')return true;
 const text=normalize(i.title+' '+i.excerpt),city=normalize(p.city!);
 const escaped=city.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return new RegExp('(?:^|[^\\p{L}\\p{N}])'+escaped+'(?=$|[^\\p{L}\\p{N}])','u').test(text);
}
export const topThreeVersion='tbn-top-three-v1';
// Capped public-interest signals, not a fact check or an estimate of lives/money affected.
// A global-sounding headline, repetition or publisher volume cannot supply impact evidence.
export function editorialRelevance(i:Item,scope:EditionPreference['scope']='global'){
 const text=i.title+' '+i.excerpt;
 const consequence=/\b(public health|clinical trial|vaccine|outbreak|pandemic|evacuat\w*|earthquake|flood\w*|wildfire\w*|ceasefire|war|armed conflict|civilian\w*|election\w*|parliament|court ruling|public policy|regulation\w*|treaty|sanctions?|inflation|interest rates?|trade agreement|food security|water supply|electricity|energy supply|climate change|emissions?|peer.reviewed|scientific evidence)\b/i.test(text);
 const speculative=/\b(unconfirmed|rumou?r|could revolutioni[sz]e|game.changing|promotional|sponsored|giveaway)\b/i.test(text);
 const impact=(consequence?85:45)-(speculative?15:0);
 return scope==='global'?Math.round(globalRelevance(i)*.5+impact*.5):impact;
}

// Availability is operational evidence, not reliability. No clicks/popularity multiplier.
const profile=rankingSchema.parse({weights:{freshness:30,relevance:50,source:0,grounding:0,completeness:20},maxAgeDays:1,kinds:['article']});
export function selectTopThree(items:Item[],preference=globalEdition,at=new Date()){
 const eligible=items.filter(i=>!i.owner_id&&i.kind==='article'&&Date.parse(i.published_at)<=+at&&Date.parse(i.published_at)>+at-86400000&&!!i.excerpt.trim()&&matchesEdition(i,preference));
 const ranked=rankArticles(eligible,defaults,profile,{},eligible.length,at);
 // Geography filters eligibility. Relevance then combines breadth and supported public-interest signals.
 for(const i of ranked){
  i.ranking.factors.relevance=editorialRelevance(i,preference.scope);
  i.ranking.value=Math.round((i.ranking.factors.freshness*.3+i.ranking.factors.relevance*.5+i.ranking.factors.completeness*.2)*10)/10;
 }
 ranked.sort((a,b)=>b.ranking.value-a.ranking.value||Date.parse(b.published_at)-Date.parse(a.published_at)||a.id.localeCompare(b.id));
 let publisherRepeatsSkipped=0,eventRepeatsSkipped=0;
 const selected:typeof ranked=[];
 for(const i of ranked){
  if(selected.some(p=>publisherFamily(p)===publisherFamily(i))){publisherRepeatsSkipped++;continue;}
  if(selected.some(p=>sameEvent(p,i))){eventRepeatsSkipped++;continue;}
  selected.push(i);if(selected.length===3)break;
 }
 return {version:topThreeVersion,asOf:at.toISOString(),preference,items:selected,
  metrics:{candidates:eligible.length,selected:selected.length,publisherRepeatsSkipped,eventRepeatsSkipped,selectedMeanAgeHours:selected.length?Math.round(selected.reduce((n,i)=>n+(+at-Date.parse(i.published_at))/3600000,0)/selected.length*10)/10:null,selectedMeanRelevance:selected.length?Math.round(selected.reduce((n,i)=>n+i.ranking.factors.relevance,0)/selected.length):null,publishers:new Set(selected.map(publisherFamily)).size,limitedEvidence:eligible.filter(i=>i.excerpt.trim().length<160).length,unknownGeography:eligible.filter(i=>!geographyFor({...i,summary:'',topic:''}).countries.length).length},
  note:'Editorial ranking, not a claim of factual accuracy. Places are source-text matches; availability and clicks do not establish reliability. Fewer than three stories means insufficient matching coverage.'};
}
