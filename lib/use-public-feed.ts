'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Item} from './model';
import type {FeedCategory,FeedPage} from './public-feed';
import {uniqueStories} from './feed-order';
type Page={items:Item[];next:string|null};
// Separate cursors and cached pages per category. Slow responses from another
// tab can fill its cache, but cannot replace the category currently displayed.
export function usePublicFeed(enabled:boolean,category:FeedCategory,seed:Item[],initial?:FeedPage){
 const [pages,setPages]=useState<Record<string,Page>>({});
 const [errors,setErrors]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState<Record<string,boolean>>({});
 const pending=useRef(new Set<string>()),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const key=`${initial?.snapshot}:${category}`;
 const page=pages[key]||(category==='all'&&initial?{items:seed,next:initial.next}:undefined);
 const loadMore=useCallback(async()=>{
  if(!enabled||!initial||pending.current.has(key)||(page&&page.next===null))return;
  pending.current.add(key);setLoading(old=>({...old,[key]:true}));setErrors(old=>({...old,[key]:''}));
  try{
   const params=new URLSearchParams({snapshot:initial.snapshot,category});
   if(page?.next)params.set('before',page.next);
   const response=await fetch('/api/feed?'+params);
   if(!response.ok)throw Error();
   const batch:Page=await response.json();
   if(mounted.current)setPages(old=>({...old,[key]:{items:uniqueStories([...(page?.items||[]),...batch.items]),next:batch.next}}));
  }catch{if(mounted.current)setErrors(old=>({...old,[key]:'Could not load this feed. Try again.'}));}
  finally{pending.current.delete(key);if(mounted.current)setLoading(old=>({...old,[key]:false}));}
 },[enabled,initial,category,key,page]);
 useEffect(()=>{if(enabled&&!page&&!errors[key])void loadMore();},[enabled,page,errors,key,loadMore]);
 return {items:page?.items||[],next:page?.next||null,loading:enabled&&(!!loading[key]||(!page&&!errors[key])),error:errors[key]||'',loadMore,hasPage:!!page};
}
