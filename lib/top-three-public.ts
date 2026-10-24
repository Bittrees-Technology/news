import {unstable_cache} from 'next/cache';
import {pool} from './db';
import {rankingColumns} from './ranking-projection';
import {feedDisplay} from './public-feed';
import {selectTopThree,type EditionPreference} from './top-three';
export const hourlyTopCandidates=unstable_cache(async(hour:string)=>{
 const at=new Date(hour);
 return (await pool().query(`SELECT ${rankingColumns} FROM items WHERE owner_id IS NULL AND kind='article' AND published_at>$1::timestamptz-interval '24 hours' AND published_at<=$1 AND fetched_at<=$1 ORDER BY published_at DESC,id`,[at])).rows;
},['top-three-hourly-candidates-v1'],{revalidate:3600});
export async function publicTopThree(preference:EditionPreference,at=new Date()){
 const hour=new Date(Math.floor(+at/3600000)*3600000).toISOString();
 const result=selectTopThree(await hourlyTopCandidates(hour),preference,new Date(hour));
 return {...result,items:await feedDisplay(result.items)};
}
