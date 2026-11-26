import type {Item} from './model';
import {allSources} from './catalog';
import {geographyFor} from './geography';
const families = new Map(allSources.map(source => [
  source.id, source.publisherFamily || new URL(source.homepage).hostname.replace(/^www\./, ''),
]));
export function publisherFamily(item: Pick<Item, 'source_id'>) {
  return families.get(item.source_id) || item.source_id;
}
function words(i:Item){return new Set(i.title.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu)||[]);}
export function sameEvent(a:Item,b:Item){const x=words(a),y=words(b);const shared=[...x].filter(t=>y.has(t)).length;return !!x.size&&shared/(x.size+y.size-shared)>=0.6;}
export function diversityShadow(items:Item[]){
 const chosen:Item[]=[];
 for(const i of items){if(!chosen.some(c=>publisherFamily(c)===publisherFamily(i)||sameEvent(c,i)))chosen.push(i);if(chosen.length===3)break;}
 const describe=(rows:Item[])=>({ids:rows.map(i=>i.id),publishers:new Set(rows.map(publisherFamily)).size,eventClusters:rows.filter((i,n)=>!rows.slice(0,n).some(p=>sameEvent(p,i))).length,regions:[...new Set(rows.flatMap(i=>geographyFor(i).regions))],unknownRegion:rows.filter(i=>!geographyFor(i).regions.length).length});
 return {version:1,baseline:describe(items.slice(0,3)),candidate:describe(chosen),note:'Shadow only. Title similarity and geographic mentions are heuristics; no ranking or reader preferences changed.'};
}
