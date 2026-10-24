"use client";
import {useEffect,useState} from 'react';
import {ArticleEngagement} from './article-engagement';
import {ArticleFeedback} from './article-feedback';
import {compactSummary} from '@/lib/newspaper-email';
import {EditionChoice} from './edition-choice';
import {editionPreferenceSchema,globalEdition,type EditionPreference} from '@/lib/top-three';
import type {Item} from '@/lib/model';
export function TopThree({signed=false}:{signed?:boolean}){
 const [choice,setChoice]=useState<EditionPreference>(globalEdition),[ready,setReady]=useState(false),[data,setData]=useState<{items:Item[];asOf:string}|null>(null),[error,setError]=useState('');
 useEffect(()=>{try{const saved=editionPreferenceSchema.safeParse(JSON.parse(localStorage.getItem('tbn-top-three-edition')||'{}'));if(saved.success)setChoice(saved.data);}catch{}setReady(true);},[]);
 useEffect(()=>{
  if(!ready)return;
  const valid=editionPreferenceSchema.safeParse(choice);setData(null);
  if(!valid.success){setError('Choose a country/region, or a city and its country.');return;}
  try{localStorage.setItem('tbn-top-three-edition',JSON.stringify(valid.data));}catch{}
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function load(){try{
   setError('');const p=new URLSearchParams(Object.fromEntries(Object.entries(valid.data!).filter(([,v])=>v)));
   const response=await fetch('/api/top-three?'+p,{signal:controller.signal});if(!response.ok)throw Error();
   const result=await response.json();if(!controller.signal.aborted)setData(result);
  }catch{if(!controller.signal.aborted)setError('Could not update top stories. Please refresh to retry.');}
  finally{if(!controller.signal.aborted)timer=setTimeout(load,3600000-Date.now()%3600000+1000);}}
  const debounce=setTimeout(load,350);return()=>{clearTimeout(debounce);clearTimeout(timer);controller.abort();};
 },[choice,ready]);
 return <section className="panel" aria-label="Top three stories">
 <h2>Top three · {choice.scope==='global'?'Global':choice.scope==='city'?choice.city||'City':choice.country||choice.region||'Region'}</h2>
 <p>Refreshed hourly from the past 24 hours of reporting. Global is the default; choose a place to focus your top stories.</p>
 <EditionChoice value={choice} onChange={setChoice}/>
 {error&&<p role="status">{error}</p>}
 {!data&&!error&&<p>Loading top stories…</p>}
 {data&&<><p>Ranking as of {new Date(data.asOf).toLocaleString()}. Places are matched in source reporting; coverage may be incomplete.</p>
 {data.items.length<3&&<p>Only {data.items.length} matching {data.items.length===1?'story':'stories'} available. We do not substitute unrelated global stories.</p>}
 <ol>{data.items.map(i=><li key={i.id}><article><ArticleEngagement id={i.id} signed={signed}/><h3><a data-source-link href={i.url} rel="noopener noreferrer">{i.translation?.title||i.title}</a></h3><p>{compactSummary(i.translation?.summary||i.summary||i.excerpt)}</p><ArticleFeedback id={i.id}/></article></li>)}</ol></>}
 <p>Chosen using signals of public impact and freshness, with different publishers and stories. These signals do not prove factual accuracy. <a href="/account/delivery">Choose your daily delivery time and edition</a>.</p>
 </section>;
}
