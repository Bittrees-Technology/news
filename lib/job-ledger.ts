import type {PoolClient} from 'pg';
import {publicJobSchema} from './job-contract';
// Persist inside the same transaction as the lease. This is a claim ledger,
// not a claim that inference or downstream archiving has completed.
export async function recordClaim(db:Pick<PoolClient,'query'>,input:unknown,phase:'generation'|'archive'='generation'){
 const job=publicJobSchema.parse(input);
 await db.query(`INSERT INTO public_job_claims(lease,task,artifact_id,content_revision,phase,deadline,envelope) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(lease) DO NOTHING`,[job.lease,job.task,job.artifactId,job.contentRevision,phase,job.deadline,JSON.stringify(job)]);
 return job;
}

export type JobOutcome='generated'|'archived'|'translated'|'deferred'|'retry'|'review';
export async function recordOutcome(db:Pick<PoolClient,'query'>,lease:string,event:JobOutcome){
 // Legacy in-flight leases predate the ledger; allow them to finish without
 // inventing a historical claim. New leases always have a matching claim.
 await db.query(`INSERT INTO public_job_events(lease,event) SELECT lease,$2 FROM public_job_claims WHERE lease=$1 ON CONFLICT(lease,event) DO NOTHING`,[lease,event]);
}
