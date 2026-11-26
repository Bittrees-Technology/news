import type {Item} from './model';

export type Coverage = {
  id:string; version:number; title:string;
  reports:{id:string;sourceId?:string;outlet:string;title:string;url:string;publishedAt:string;authors:string[]}[];
  claims:{text:string;reports:string[]}[];
};

// Group after eligibility filtering so a source blocked by the reader cannot
// enter through a related article. Incomplete groups keep individual cards.
export function groupCoverage<T extends Item>(items:T[], batches?:string[][]):T[] {
  const page=new Map<string,number>();
  batches?.forEach((ids,n)=>ids.forEach(id=>{if(!page.has(id))page.set(id,n);}));
  const eligible=new Set(items.map(i=>i.id)),seen=new Set<string>();
  return items.flatMap(i=>{
    const group=i.coverage;
    if(!group)return [i];
    const pageNumber=page.get(i.id);
    const complete=group.reports.every(report=>eligible.has(report.id) &&
      (!batches || (pageNumber!==undefined && page.get(report.id)===pageNumber)));
    if(!complete)return [{...i,coverage:undefined}];
    if(seen.has(group.id))return [];
    seen.add(group.id);
    return [i];
  });
}
