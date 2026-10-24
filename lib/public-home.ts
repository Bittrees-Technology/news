import type {Edition} from './model';
import {unstable_cache} from 'next/cache';
import {latestEdition} from './publish';
import {publicTopThree} from './top-three-public';
import {globalEdition} from './top-three';
import {publicFeedBatch} from './public-feed';
import {feedOrder} from './feed-order';
// Public editorial data only. Session verification and preferences remain outside.
export const publicHome=unstable_cache(async():Promise<Edition|null>=>{
 const snapshot=new Date().toISOString();
 const [edition,ranked,batch]=await Promise.all([latestEdition(),publicTopThree(globalEdition,new Date(snapshot)),publicFeedBatch(snapshot,null,'all',true)]);
 if(!edition)return null;
 const leads=ranked.items;
 const leadIds=leads.map(i=>i.id);
 return JSON.parse(JSON.stringify({...edition,data:{...edition.data,items:feedOrder([...leads,...batch.items],leadIds)},feedPage:{next:batch.next,snapshot,leadIds,balanced:true}}));
},['public-home-v4'],{revalidate:30});
