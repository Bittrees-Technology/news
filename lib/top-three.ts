import {editorialBase,editorialFreshness,editorialRelevance,editorialScore} from './editorial-priority';
import {z} from 'zod';
import {countries,regions,geographyFor,matchesGeography} from './geography';
import {publisherFamily,sameEvent} from './diversity-shadow';
import {scoreArticle,rankingSchema} from './scoring';
import {defaults,type Item} from './model';
import {interestAdjustment,type TopThreeLearning} from './top-three-learning';
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
export const topThreeVersion='tbn-top-three-v4';
export {editorialRelevance} from './editorial-priority';
// Availability is operational evidence, not reliability. No clicks/popularity multiplier.
const profile=rankingSchema.parse({weights:{freshness:30,relevance:50,source:0,grounding:0,completeness:20},maxAgeDays:1,kinds:['article']});
export function rankEditorialCandidates(items:Item[],preference=globalEdition,at=new Date(),learning?:TopThreeLearning){
 const eligible=items.filter(i=>!i.owner_id&&i.kind==='article'&&Date.parse(i.published_at)<=+at&&Date.parse(i.published_at)>+at-86400000&&!!i.excerpt.trim()&&matchesEdition(i,preference));
 const ranked=eligible.map(i=>({...i,ranking:scoreArticle(i,defaults,profile,50,at)}));
 // Geography filters eligibility. Relevance then combines breadth and supported public-interest signals.
 for(const i of ranked){
  i.ranking.version=topThreeVersion;
  i.ranking.factors.relevance=editorialRelevance(i,preference.scope);
  // Recent developments should displace yesterday's coverage, not just headlines with buzzwords.
  i.ranking.factors.freshness=editorialFreshness(i.published_at,at);
  i.ranking.feedbackAdjustment=interestAdjustment(i.topic,i.id,learning);
  i.ranking.value=editorialScore(editorialBase(i,i.ranking.factors.relevance),i.ranking.factors.freshness,i.ranking.feedbackAdjustment);
 }
 ranked.sort((a,b)=>b.ranking.value-a.ranking.value||Date.parse(b.published_at)-Date.parse(a.published_at)||a.id.localeCompare(b.id));
 return ranked;
}

export function chooseEditorialLeads<T extends Item>(ranked:T[]) {
 let publisherRepeatsSkipped=0,eventRepeatsSkipped=0;
 const selected:T[]=[];
 for(const i of ranked){
  if(selected.some(p=>publisherFamily(p)===publisherFamily(i))){publisherRepeatsSkipped++;continue;}
  if(selected.some(p=>p.title.trim().toLowerCase()===i.title.trim().toLowerCase() || sameEvent(p,i))){eventRepeatsSkipped++;continue;}
  selected.push(i);if(selected.length===3)break;
 }
 return {selected,publisherRepeatsSkipped,eventRepeatsSkipped};
}

export function selectTopThree(items:Item[],preference=globalEdition,at=new Date(),learning?:TopThreeLearning) {
 const eligible=rankEditorialCandidates(items,preference,at,learning);
 const {selected,publisherRepeatsSkipped,eventRepeatsSkipped}=chooseEditorialLeads(eligible);
 return {version:topThreeVersion,asOf:at.toISOString(),preference,items:selected,
  metrics:{candidates:eligible.length,selected:selected.length,publisherRepeatsSkipped,eventRepeatsSkipped,selectedMeanAgeHours:selected.length?Math.round(selected.reduce((n,i)=>n+(+at-Date.parse(i.published_at))/3600000,0)/selected.length*10)/10:null,selectedMeanRelevance:selected.length?Math.round(selected.reduce((n,i)=>n+i.ranking.factors.relevance,0)/selected.length):null,publishers:new Set(selected.map(publisherFamily)).size,limitedEvidence:eligible.filter(i=>i.excerpt.trim().length<160).length,unknownGeography:eligible.filter(i=>!geographyFor({...i,summary:'',topic:''}).countries.length).length},
  note:'Editorial ranking, not a claim of factual accuracy. Places are source-text matches; availability and clicks do not establish reliability. Fewer than three stories means insufficient matching coverage.'};
}
