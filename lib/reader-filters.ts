import {z} from 'zod';
const choices=z.array(z.string().min(1).max(80)).max(200).default([]);
export const readerFiltersSchema=z.object({topics:choices,excludedTopics:choices,countries:choices,excludedCountries:choices,regions:choices,excludedRegions:choices,hideRead:z.boolean().default(true),sort:z.enum(["score","saved","newest"]).default("score")});
export type ReaderFilters=z.infer<typeof readerFiltersSchema>;
export const defaultReaderFilters=readerFiltersSchema.parse({});
export function matchesReaderFilters(tags:string[],geo:{countries:string[];regions:string[]},f:ReaderFilters){
 return ([['topics','excludedTopics',tags],['countries','excludedCountries',geo.countries],['regions','excludedRegions',geo.regions]] as const).every(([include,exclude,values])=>(!f[include].length||f[include].some(t=>values.includes(t)))&&!f[exclude].some(t=>values.includes(t)));
}
export function interactionAdjustment(vote:number,saved:boolean,read:boolean,signed:boolean){return (vote*1+(saved?0.6:0)-(read?0.2:0))*(signed?5:1);}

export function exclusionFilters(f:ReaderFilters):ReaderFilters{return {...f,topics:[],countries:[],regions:[]};}
