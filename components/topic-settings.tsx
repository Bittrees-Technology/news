"use client";
import {useEffect,useState} from 'react';
import {call} from './client';
import {topics} from '@/lib/catalog';
import {tagStyle} from '@/lib/tags';
import {countries,regions} from '@/lib/geography';
import {readerFiltersSchema,type ReaderFilters} from '@/lib/reader-filters';
import {topicSettingsState} from '@/lib/topic-settings-state';
import type {Preferences} from '@/lib/model';
type Blocks=Pick<ReaderFilters,'excludedTopics'|'excludedCountries'|'excludedRegions'>;
export function TopicSettings({initial,onSaved}:{initial:Preferences;onSaved:(preferences:Preferences)=>void}){
 const [prefs,setPrefs]=useState(initial),[blocks,setBlocks]=useState<Blocks|null>(null);
 const [topicSearch,setTopicSearch]=useState(''),[choice,setChoice]=useState('all'),[saved,setSaved]=useState(''),[saveError,setSaveError]=useState(false);
 const [search,setSearch]=useState(''),[status,setStatus]=useState(''),[loadError,setLoadError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;void call('reader-filters').then(value=>{if(active){const f=readerFiltersSchema.parse(value);setBlocks({excludedTopics:f.excludedTopics,excludedCountries:f.excludedCountries,excludedRegions:f.excludedRegions});const normalized={...initial,topics:initial.topics.filter(t=>!f.excludedTopics.includes(t))};setPrefs(normalized);setSaved(topicSettingsState(normalized,f));}}).catch(()=>{if(active)setLoadError('Could not load your settings. Reload the page to retry.');});return()=>{active=false;};},[]);
 function setTopic(topic:string,state:string){
  setPrefs(p=>({...p,topics:[...p.topics.filter(t=>t!==topic),...(state==='focus'?[topic]:[])]}));
  setBlocks(b=>b?{...b,excludedTopics:[...b.excludedTopics.filter(t=>t!==topic),...(state==='block'?[topic]:[])]}:b);
 }
 function togglePlace(key:'excludedCountries'|'excludedRegions',value:string){setBlocks(b=>b?{...b,[key]:b[key].includes(value)?b[key].filter(v=>v!==value):[...b[key],value]}:b);}
 async function save(){if(!blocks||busy||topicSettingsState(prefs,blocks)===saved)return;setBusy(true);setStatus('');setSaveError(false);try{await call('topic-settings',{preferences:{topics:prefs.topics,interests:prefs.interests,blocked:prefs.blocked.map(v=>v.trim()).filter(Boolean),length:prefs.length},blocks});const normalized={...prefs,blocked:prefs.blocked.map(v=>v.trim()).filter(Boolean)};setPrefs(normalized);onSaved(normalized);setSaved(topicSettingsState(normalized,blocks));setStatus('Topics, interests and blocked places saved. They apply the next time you load your reading view or personal edition.');}catch(e){setSaveError(true);setStatus((e as Error).message);}finally{setBusy(false);}}
 const options=[...new Set([...topics,...prefs.topics,...(blocks?.excludedTopics||[])])].sort();
 const dirty=!!blocks&&topicSettingsState(prefs,blocks)!==saved;
 const shown=options.filter(t=>t.toLowerCase().includes(topicSearch.trim().toLowerCase())&&(choice==='all'||(choice==='focus'?prefs.topics.includes(t):blocks?.excludedTopics.includes(t))));
 return <form className="panel reader-blocks topic-settings" data-insights-ignore="true" onSubmit={e=>{e.preventDefault();void save();}}>
  {loadError&&<p role="alert">{loadError}</p>}
  {!blocks&&!loadError&&<p role="status">Loading your settings…</p>}
  <fieldset disabled={busy||!blocks}>
   <legend className="section-label">Topic choices</legend>
   <label className="field topic-search">Find a topic<input type="search" value={topicSearch} onChange={e=>setTopicSearch(e.target.value)} placeholder="Search topics…"/></label>
   <div className="topic-choice-toolbar">
    <div className="topic-choice-tabs" role="group" aria-label="Show topic choices">
     <button type="button" aria-pressed={choice==='all'} onClick={()=>setChoice('all')}>All ({options.length})</button>
     <button type="button" aria-pressed={choice==='focus'} onClick={()=>setChoice('focus')}>Focused ({prefs.topics.length})</button>
     <button type="button" aria-pressed={choice==='block'} onClick={()=>setChoice('block')}>Blocked ({blocks?.excludedTopics.length||0})</button>
    </div>
   </div>
   <div className="topic-choice-grid">{shown.map(t=><label className="topic-choice" key={t}>
    <span className="colored-tag" style={tagStyle(t)}>{t}</span>
    <select aria-label={`${t} preference`} value={blocks?.excludedTopics.includes(t)?'block':prefs.topics.includes(t)?'focus':'include'} onChange={e=>setTopic(t,e.target.value)}>
     <option value="include">Include</option><option value="focus" disabled={!topics.includes(t)}>Focus</option><option value="block">Block</option>
    </select>
   </label>)}</div>
   {!shown.length&&<p role="status">No topics in this view. <button type="button" onClick={()=>{setTopicSearch('');setChoice('all');}}>Show all topics</button></p>}
  <p>All topics are included unless you choose otherwise.</p>
  <details className="topic-choice-help"><summary>How topic choices work</summary><p>Focus limits your personal edition and deliveries to those topics. Block hides a topic from your signed-in reading views. A topic can have only one setting.</p></details>
   <h3>Blocked places</h3><p>Countries and regions are included unless blocked here. These blocks apply to your signed-in reading views, including “All topics & places.”</p>
   {(['excludedCountries','excludedRegions'] as const).map(key=>{
    const label=key==='excludedCountries'?'Countries':'Regions';
    const list=key==='excludedCountries'?countries.filter(c=>`${c.name} ${c.code}`.toLowerCase().includes(search.toLowerCase())).map(c=>({value:c.code,label:c.name})):regions.map(r=>({value:r,label:r}));
    return <details key={key}><summary>{label} · {blocks?.[key].length||0} blocked</summary>
     {key==='excludedCountries'&&<input type="search" aria-label="Search countries to block" placeholder="Search countries…" value={search} onChange={e=>setSearch(e.target.value)}/>}
     <div className="filter-options exclusion-tags">{list.map(o=><button type="button" key={o.value} className={blocks?.[key].includes(o.value)?'excluded':''} aria-pressed={!!blocks?.[key].includes(o.value)} aria-label={`${blocks?.[key].includes(o.value)?'Unblock':'Block'} ${o.label}`} onClick={()=>togglePlace(key,o.value)}>{o.label}{blocks?.[key].includes(o.value)&&<span className="tag-cross" aria-hidden="true">×</span>}</button>)}{!list.length&&<p>No countries found.</p>}</div>
    </details>;
   })}
   <details className="edition-preferences"><summary>Edition preferences</summary><p>Fine-tune interests, excluded phrases and the number of stories in each delivery.</p>
   <label className="field">What would you like more of?<textarea value={prefs.interests} onChange={e=>setPrefs({...prefs,interests:e.target.value})} maxLength={1000} placeholder="e.g. European energy, open-source models, public infrastructure"/></label>
   <div className="form-grid">
    <label className="field">Exclude words or phrases from your personal edition, one per line<textarea value={prefs.blocked.join('\n')} onChange={e=>setPrefs({...prefs,blocked:e.target.value.split('\n')})}/></label>
    <label className="field">Stories per delivery<input type="number" min={5} max={50} value={prefs.length} onChange={e=>setPrefs({...prefs,length:Number(e.target.value)})}/><span className="muted">Between 5 and 50, subject to available stories.</span></label>
   </div>
   </details>
   <div className="button-row"><button type="button" onClick={()=>{setPrefs(p=>({...p,topics:[]}));setBlocks({excludedTopics:[],excludedCountries:[],excludedRegions:[]});}}>Include all topics & places</button></div>
  </fieldset>
  <div className={`settings-save topic-save${dirty||busy||saveError?' has-changes':''}`}>
   <button className="primary" disabled={busy||!blocks||!dirty}>{busy?'Saving…':'Save topics & interests'}</button>
   <span className="muted" role="status">{busy?'Saving your choices…':!blocks?(loadError?'Settings unavailable':'Loading your choices…'):dirty?'Unsaved changes':saveError?'Changes could not be saved':status||'Your choices are up to date.'}</span>
  </div>
  {saveError&&<p role="alert">{status}</p>}
 </form>;
}
