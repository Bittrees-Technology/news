import type {Edition} from './model';
import {unstable_cache} from 'next/cache';
import {latestEdition} from './publish';
import {recentPublicRanked} from './ranking';
import {translationKey,translationStatus} from './translation';
// Only public editorial data enters this cache. Account/session authorization,
// score visibility and reader overrides remain outside it on every request.
export const publicHome=unstable_cache(async():Promise<Edition|null>=>{
 const [edition,items]=await Promise.all([latestEdition(),recentPublicRanked()]);
 if(!edition)return null;
 const found=new Map((await translationStatus(items.map(translationKey))).map(row=>[row.key,row]));
 const display=items.map(({source_context,...item})=>{
  const key=translationKey(item),row=found.get(key);
  return {...item,translation_key:key,translation_status:row?.status||'pending',translation:row?.status==='done'?row.result:undefined};
 });
 return JSON.parse(JSON.stringify({...edition,data:{...edition.data,items:display}}));
},['public-home-v1'],{revalidate:30});
