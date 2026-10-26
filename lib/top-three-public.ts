import {unstable_cache} from 'next/cache';
import {pool} from './db';
import {rankingColumns} from './ranking-projection';
import {feedDisplay} from './public-feed';
import {selectTopThree,type EditionPreference} from './top-three';
import {readInterestLearning} from './top-three-learning-db';
export const hourlyTopCandidates=unstable_cache(async(hour:string)=>{
 const at=new Date(hour);
 return (await pool().query(`SELECT ${rankingColumns} FROM items WHERE owner_id IS NULL AND kind='article' AND published_at>$1::timestamptz-interval '24 hours' AND published_at<=$1 AND fetched_at<=$1 ORDER BY published_at DESC,id`,[at])).rows;
},['top-three-hourly-candidates-v1'],{revalidate:3600});
// Shared minute cache: local discovery only, no extra publisher/model requests.
const liveCandidates=unstable_cache(async(snapshot:string)=>{
 return (await pool().query(`SELECT ${rankingColumns} FROM items WHERE owner_id IS NULL AND kind='article' AND published_at>$1::timestamptz-interval '24 hours' AND published_at<=$1 AND fetched_at<=$1 ORDER BY published_at DESC,id`,[snapshot])).rows;
},['top-three-live-candidates-v3'],{revalidate:60});
export const publicInterestLearning=unstable_cache(readInterestLearning,['top-three-interest-v1'],{revalidate:300});
export async function publicTopThree(preference:EditionPreference,at=new Date()){
 const snapshot=new Date(Math.floor(+at/60000)*60000).toISOString();
 const [items,learning]=await Promise.all([liveCandidates(snapshot),publicInterestLearning().catch(()=>undefined)]);
 const result=selectTopThree(items,preference,new Date(snapshot),learning);
 return {...result,learning:{available:!!learning,windowDays:30,minReaders:5,minTopicVotes:20,maxAdjustment:6},items:await feedDisplay(result.items)};
}
