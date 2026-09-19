import {createHash} from 'node:crypto';
import {z} from 'zod';
export const publicJobSchema=z.object({version:z.literal(1),scope:z.literal('public'),task:z.enum(['translation','briefing']),artifactId:z.string().min(1).max(100),contentRevision:z.string().regex(/^[a-f0-9]{64}$/),lease:z.uuid(),priority:z.number().min(0).max(100),dependencies:z.array(z.enum(['public-source-evidence'])),deadline:z.string().datetime(),promptVersion:z.literal(1),schemaVersion:z.literal(1)});
export function publicJob(task:'translation'|'briefing',id:string,evidence:unknown,lease:string,priority=0){
 return publicJobSchema.parse({version:1,scope:'public',task,artifactId:id,contentRevision:createHash('sha256').update(JSON.stringify(evidence)).digest('hex'),lease,priority:Number(priority)||0,dependencies:['public-source-evidence'],deadline:new Date(Date.now()+(task==='translation'?40:30)*60000).toISOString(),promptVersion:1,schemaVersion:1});
}
