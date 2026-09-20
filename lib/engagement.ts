import {z} from 'zod';import {pool} from './db';import {HttpError} from './model';
export const engagementSchema=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),type:z.enum(['impression','source_click'])}).strict();
export async function recordEngagement(accountId:string,input:unknown){
 const b=engagementSchema.parse(input);
 const r=await pool().query(`INSERT INTO reader_events(account_id,item_id,event_type) SELECT $1,id,$3 FROM items WHERE id=$2 AND owner_id IS NULL ON CONFLICT DO NOTHING RETURNING item_id`,[accountId,b.id,b.type]);
 if(!r.rowCount && !(await pool().query('SELECT 1 FROM items WHERE id=$1 AND owner_id IS NULL',[b.id])).rowCount)throw new HttpError(404,'Public article not found');
 return {ok:true};
}
export async function engagementMetrics(){return (await pool().query(`WITH pairs AS (SELECT account_id,item_id,bucket,bool_or(event_type='impression') viewed,bool_or(event_type='source_click') clicked FROM reader_events WHERE bucket>=(now() AT TIME ZONE 'UTC')::date-29 GROUP BY account_id,item_id,bucket) SELECT count(*) FILTER(WHERE viewed)::int impressions,count(*) FILTER(WHERE clicked)::int clicks,count(*) FILTER(WHERE viewed AND clicked)::int clicks_after_view,count(DISTINCT account_id)::int readers FROM pairs`)).rows[0];}
