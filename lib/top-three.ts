import {z} from 'zod';
import {countries,regions,geographyFor,matchesGeography} from './geography';
import {publisherFamily,sameEvent} from './diversity-shadow';
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
export const topThreeVersion='tbn-top-three-v2';
// Capped public-interest signals, not a fact check or an estimate of lives/money affected.
// A global-sounding headline, repetition or publisher volume cannot supply impact evidence.
export function editorialRelevance(i:Item,scope:EditionPreference['scope']='global'){
 const title=i.title,lead=i.excerpt.slice(0,360),text=title+' '+lead;
 // Match the central headline, not a keyword anywhere in an excerpt/newsletter.
 const central=/\b(emergency|evacuat\w*|outbreak|earthquake|flood\w*|wildfire\w*|ceasefire|war|armed conflict|civilian\w*|election\w*|parliament|court|ruling|regulation\w*|treaty|sanctions?|inflation|interest rates?|trade|food security|water supply|electricity|energy supply|climate change|emissions?|public health|clinical trial|vaccine)\b/i.test(title);
 const background=/\b(public health|clinical trial|vaccine|evacuat\w*|ceasefire|court ruling|public policy|regulation\w*|treaty|sanctions?|inflation|interest rates?|trade agreement|food security|water supply|electricity|energy supply|climate change|emissions?)\b/i.test(lead);
 const feature=/\b(ancient|anniversary|roundup|newsletter|opinion|explains why|according to.{0,30}expert|world [\p{L} -]{2,35} day)\b/iu.test(title)||/^(?:welcome back|here are the studies|in this week)/i.test(lead);
 const promotional=/\b(unconfirmed|rumou?r|could revolutioni[sz]e|game.changing|promotional|sponsored|giveaway)\b/i.test(text);
 const impact=(feature?35:central?90:background?65:45)-(promotional?15:0);
 const geo=geographyFor({title,excerpt:lead,summary:'',topic:''});
 const crossBorder=/\b(international|worldwide|cross[- ]border|multinational|global (?:economy|trade|health|markets?|climate)|united nations|world health organization)\b/i.test(text);
 const breadth=feature?45:crossBorder&&central?95:geo.countries.length>=2&&central?90:central?75:55;
 return scope==='global'?Math.round(breadth*.4+impact*.6):impact;
}

// Availability is operational evidence, not reliability. No clicks/popularity multiplier.
const profile=rankingSchema.parse({weights:{freshness:30,relevance:50,source:0,grounding:0,completeness:20},maxAgeDays:1,kinds:['article']});
export function selectTopThree(items:Item[],preference=globalEdition,at=new Date()){
 const eligible=items.filter(i=>!i.owner_id&&i.kind==='article'&&Date.parse(i.published_at)<=+at&&Date.parse(i.published_at)>+at-86400000&&!!i.excerpt.trim()&&matchesEdition(i,preference));
 const ranked=rankArticles(eligible,defaults,profile,{},eligible.length,at);
 // Geography filters eligibility. Relevance then combines breadth and supported public-interest signals.
 for(const i of ranked){
  i.ranking.version=topThreeVersion;
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
