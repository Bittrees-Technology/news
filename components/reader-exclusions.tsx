"use client";
import {useEffect,useState} from "react";
import {call} from "./client";
import {topics} from "@/lib/catalog";
import {addedTopics,tagStyle} from "@/lib/tags";
import {countries,regions} from "@/lib/geography";
import {readerFiltersSchema,type ReaderFilters} from "@/lib/reader-filters";

type Blocks=Pick<ReaderFilters,'excludedTopics'|'excludedCountries'|'excludedRegions'>;
export function ReaderExclusions(){
 const [blocks,setBlocks]=useState<Blocks|null>(null);
 const [search,setSearch]=useState('');
 const [status,setStatus]=useState('');
 const [saving,setSaving]=useState(false);
 useEffect(()=>{
  let active=true;
  void call('reader-filters').then(value=>{if(active)setBlocks(readerFiltersSchema.parse(value));}).catch(()=>{if(active)setStatus('Could not load blocked topics. Reload this page to retry.');});
  return()=>{active=false;};
 },[]);
 function toggle(key:keyof Blocks,value:string){
  setBlocks(current=>current?{...current,[key]:current[key].includes(value)?current[key].filter(v=>v!==value):[...current[key],value]}:current);
 }
 async function save(){
  if(!blocks)return;
  setSaving(true);setStatus('');
  try{
   // Preserve current reading, sorting and focus choices when saving account blocks.
   const current=readerFiltersSchema.parse(await call('reader-filters'));
   await call('reader-filters',{...current,excludedTopics:blocks.excludedTopics,excludedCountries:blocks.excludedCountries,excludedRegions:blocks.excludedRegions});
   setStatus('Blocks saved. These topics and places will be hidden when you browse while signed in.');
  }catch{setStatus('Could not save blocks. Please try again.');}
  finally{setSaving(false);}
 }
 const topicOptions=[...new Set([...topics,...addedTopics,...(blocks?.excludedTopics||[])])].filter(t=>!['Portugal','Europe'].includes(t)).sort();
 return <section className="panel reader-blocks" data-insights-ignore="true">
  <h2>Blocked topics & places</h2>
  <p>Click to block a topic, country or region; click again to restore it. Blocks apply to your signed-in reading views, even when you select “All.”</p>
  {blocks?<fieldset disabled={saving}>
   {(['excludedTopics','excludedCountries','excludedRegions'] as const).map(key=>{
    const label=key==='excludedTopics'?'Topics':key==='excludedCountries'?'Countries':'Regions';
    const options=key==='excludedTopics'?topicOptions.map(t=>({value:t,label:t})):key==='excludedCountries'?countries.filter(c=>`${c.name} ${c.code}`.toLowerCase().includes(search.toLowerCase())).map(c=>({value:c.code,label:c.name})):regions.map(r=>({value:r,label:r}));
    return <details key={key} open={key==='excludedTopics'}><summary>{label} · {blocks[key].length} blocked</summary>
     {key==='excludedCountries'&&<input type="search" aria-label="Search countries to block" placeholder="Search countries…" value={search} onChange={e=>setSearch(e.target.value)}/>}
     <div className="filter-options exclusion-tags">{options.map(o=><button type="button" key={o.value} style={key==='excludedTopics'?tagStyle(o.value):undefined} className={blocks[key].includes(o.value)?'excluded':''} aria-pressed={blocks[key].includes(o.value)} aria-label={`${blocks[key].includes(o.value)?'Unblock':'Block'} ${o.label}`} onClick={()=>toggle(key,o.value)}>{o.label}{blocks[key].includes(o.value)&&<span className="tag-cross" aria-hidden="true">×</span>}</button>)}</div>
    </details>;
   })}
   <div className="button-row">
    <button type="button" onClick={()=>setBlocks({excludedTopics:[],excludedCountries:[],excludedRegions:[]})}>Clear blocks</button>
    <button type="button" className="primary" onClick={()=>void save()}>{saving?'Saving…':'Save blocks'}</button>
   </div>
  </fieldset>:!status&&<p>Loading your blocks…</p>}
  {status&&<p role="status">{status}</p>}
 </section>;
}
