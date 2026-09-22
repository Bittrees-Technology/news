import {z} from 'zod';import {pool} from './db';import {HttpError} from './model';
export const stageMetricSchema=z.object({task:z.enum(['briefing','translation']),id:z.string().regex(/^[a-f0-9]{64}$/),lease:z.uuid(),stage:z.enum(['queue','generation','validation','archive','persist','model_prepare','inference_request','cache_read']),milliseconds:z.number().finite().min(0).max(90*86400000)}).strict();
export const stageBatchSchema=stageMetricSchema.omit({stage:true,milliseconds:true}).extend({metrics:z.array(stageMetricSchema.pick({stage:true,milliseconds:true})).min(1).max(8).refine(rows=>new Set(rows.map(r=>r.stage)).size===rows.length,'Duplicate timing stages')}).strict();
export async function recordStage(input:unknown){
 const parsed=z.union([stageMetricSchema,stageBatchSchema]).parse(input);
 const b='metrics' in parsed?parsed:{task:parsed.task,id:parsed.id,lease:parsed.lease,metrics:[{stage:parsed.stage,milliseconds:parsed.milliseconds}]};
 const table=b.task==='briefing'?'story_documents':'translations',key=b.task==='briefing'?'item_id':'key';
 const r=await pool().query(`INSERT INTO processing_stages(task,artifact_id,lease,stage,milliseconds) SELECT $1,$2,$3,x.stage,x.milliseconds FROM ${table} CROSS JOIN jsonb_to_recordset($4::jsonb) AS x(stage text,milliseconds double precision) WHERE ${key}=$2 AND lease=$3 AND claimed_at>now()-interval '40 minutes' ON CONFLICT DO NOTHING RETURNING stage`,[b.task,b.id,b.lease,JSON.stringify(b.metrics)]);
 if(r.rowCount!==b.metrics.length){
  const existing=await pool().query('SELECT stage FROM processing_stages WHERE task=$1 AND artifact_id=$2 AND lease=$3 AND stage=ANY($4::text[])',[b.task,b.id,b.lease,b.metrics.map(m=>m.stage)]);
  if(existing.rowCount!==b.metrics.length)throw new HttpError(409,'Timing lease unavailable');
 }
 return {ok:true};
}
export async function stageMetrics(){return (await pool().query("SELECT task,stage,count(*)::int samples,round(percentile_cont(0.5) WITHIN GROUP(ORDER BY milliseconds)::numeric)::float median_ms,round(percentile_cont(0.95) WITHIN GROUP(ORDER BY milliseconds)::numeric)::float p95_ms FROM processing_stages WHERE recorded_at>now()-interval '7 days' GROUP BY task,stage ORDER BY task,stage")).rows;}
