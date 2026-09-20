import type {PoolClient} from 'pg';
import {publicJobSchema} from './job-contract';
// Persist inside the same transaction as the lease. This is a claim ledger,
// not a claim that inference or downstream archiving has completed.
export async function recordClaim(db:Pick<PoolClient,'query'>,input:unknown,phase:'generation'|'archive'='generation'){
 const job=publicJobSchema.parse(input);
 await db.query(`INSERT INTO public_job_claims(lease,task,artifact_id,content_revision,phase,deadline,envelope) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(lease) DO NOTHING`,[job.lease,job.task,job.artifactId,job.contentRevision,phase,job.deadline,JSON.stringify(job)]);
 return job;
}
