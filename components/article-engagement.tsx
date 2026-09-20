"use client";
import {useEffect,useRef} from 'react';
export function ArticleEngagement({id,signed}:{id:string;signed:boolean}){
 const ref=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  if(!signed)return;
  const article=ref.current?.closest('article');if(!article)return;
  let timer:ReturnType<typeof setTimeout>|undefined,viewed=false;
  const send=(type:string)=>{void fetch('/api/engagement',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',keepalive:true,body:JSON.stringify({id,type})}).catch(()=>{});};
  const observer=new IntersectionObserver(([entry])=>{clearTimeout(timer);if(entry.isIntersecting&&entry.intersectionRatio>=0.5&&!viewed&&document.visibilityState==='visible')timer=setTimeout(()=>{if(document.visibilityState==='visible'){viewed=true;send('impression');observer.disconnect();}},1000);},{threshold:0.5});observer.observe(article);
  const click=(e:Event)=>{if((e.target as Element).closest('a[data-source-link]'))send('source_click');};
  const hide=()=>{if(document.visibilityState!=='visible')clearTimeout(timer);};article.addEventListener('click',click);document.addEventListener('visibilitychange',hide);
  return()=>{clearTimeout(timer);observer.disconnect();article.removeEventListener('click',click);document.removeEventListener('visibilitychange',hide);};
 },[id,signed]);
 return <span ref={ref} hidden/>;
}
