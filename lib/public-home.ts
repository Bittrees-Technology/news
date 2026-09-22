import type {Edition} from './model';
import {unstable_cache} from 'next/cache';
import {latestEdition} from './publish';
import {recentPublicRanked} from './ranking';
import {feedDisplay,publicFeedBatch} from './public-feed';
import {feedOrder} from './feed-order';
// Public editorial data only. Session verification and preferences remain outside.
export const publicHome=unstable_cache(async():Promise<Edition|null>=>{
 const snapshot=new Date().toISOString();
 const [edition,ranked,batch]=await Promise.all([latestEdition(),recentPublicRanked(snapshot),publicFeedBatch(snapshot,null,'all',true)]);
 if(!edition)return null;
 const leads=await feedDisplay(ranked.slice(0,3));
 const leadIds=leads.map(i=>i.id);
 return JSON.parse(JSON.stringify({...edition,data:{...edition.data,items:feedOrder([...leads,...batch.items],leadIds)},feedPage:{next:batch.next,snapshot,leadIds,balanced:true}}));
},['public-home-v3'],{revalidate:30});
