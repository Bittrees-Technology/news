import type {Item} from './model';
import {sources} from './catalog';
import {geographyFor} from './geography';
export function publisherFamily(i:Pick<Item,'source_id'>){
 const explicit:Record<string,string>={'bbc-world':'bbc','bbc-business':'bbc','bbc-europe':'bbc','ars-technica':'ars','ars-technica-space':'ars','power-magazine':'power','power-magazine-fusion':'power'};
 if(explicit[i.source_id])return explicit[i.source_id];
 const s=sources.find(s=>s.id===i.source_id);return s?new URL(s.homepage).hostname.replace(/^www\./,''):i.source_id;
}
function words(i:Item){return new Set(i.title.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu)||[]);}
export function sameEvent(a:Item,b:Item){const x=words(a),y=words(b);const shared=[...x].filter(t=>y.has(t)).length;return !!x.size&&shared/(x.size+y.size-shared)>=0.6;}
export function diversityShadow(items:Item[]){
 const chosen:Item[]=[];
 for(const i of items){if(!chosen.some(c=>publisherFamily(c)===publisherFamily(i)||sameEvent(c,i)))chosen.push(i);if(chosen.length===3)break;}
 const describe=(rows:Item[])=>({ids:rows.map(i=>i.id),publishers:new Set(rows.map(publisherFamily)).size,eventClusters:rows.filter((i,n)=>!rows.slice(0,n).some(p=>sameEvent(p,i))).length,regions:[...new Set(rows.flatMap(i=>geographyFor(i).regions))],unknownRegion:rows.filter(i=>!geographyFor(i).regions.length).length});
 return {version:1,baseline:describe(items.slice(0,3)),candidate:describe(chosen),note:'Shadow only. Title similarity and geographic mentions are heuristics; no ranking or reader preferences changed.'};
}
