import {briefingPath} from '../lib/briefing-links';

type Entry={id:string;cid?:string|null;title:string;translation?:{title?:string}};
// Public entries arrive from the existing ownership-filtered feed. No reader state.
export function BriefingLinks({entries,next,currentId}:{entries:Entry[];next:string|null;currentId?:string}){
 const unique=[...new Map(entries.filter(item=>item.id!==currentId).map(item=>[item.id,item])).values()];
 if(!unique.length&&!next)return null;
 return <nav aria-label="More public briefings"><h2>More public briefings</h2>
  <ul>{unique.map(item=><li key={item.id}><a href={briefingPath(item)}>{item.translation?.title||item.title}</a></li>)}</ul>
  {next&&<p><a href={`/briefings?before=${encodeURIComponent(next)}`}>Older briefings</a></p>}
 </nav>;
}
