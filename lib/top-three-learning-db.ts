import {pool} from './db';
import type {TopThreeLearning} from './top-three-learning';
export async function readInterestLearning():Promise<TopThreeLearning>{
 const rows=(await pool().query(`WITH evidence AS (
 SELECT f.account_id,f.item_id,i.topic,f.value FROM article_feedback f JOIN items i ON i.id=f.item_id
 WHERE i.owner_id IS NULL AND i.kind='article' AND f.updated_at>now()-interval '30 days'
 ), per_reader AS (
 SELECT topic,account_id,avg(value)::float vote,count(*)::int votes FROM evidence GROUP BY topic,account_id
 ) SELECT 'topic' kind,topic key,count(*)::int readers,sum(votes)::int votes,sum(vote)::float total FROM per_reader GROUP BY topic
 UNION ALL SELECT 'story',item_id,count(*)::int,count(*)::int,sum(value)::float FROM evidence GROUP BY item_id HAVING count(*)>=5`)).rows;
 const result:TopThreeLearning={topics:Object.create(null),stories:Object.create(null)};
 for(const r of rows)if(r.readers>=5) (r.kind==='topic'?result.topics:result.stories)[r.key]={readers:r.readers,votes:r.votes,total:r.total};
 return result;
}
