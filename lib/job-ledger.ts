import type {PoolClient} from 'pg';
import {publicJobSchema} from './job-contract';
// Persist inside the same transaction as the lease. This is a claim ledger,
// not a claim that inference or downstream archiving has completed.
export async function recordClaim(db:Pick<PoolClient,'query'>,input:unknown,phase:'generation'|'archive'='generation'){
 const job=publicJobSchema.parse(input);
 const inserted=await db.query(`INSERT INTO public_job_claims(lease,task,artifact_id,content_revision,phase,deadline,envelope) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(lease) DO NOTHING RETURNING lease`,[job.lease,job.task,job.artifactId,job.contentRevision,phase,job.deadline,JSON.stringify(job)]);
 if(!inserted.rowCount)return job;
 // This runs in the claim transaction: only a committed replacement can
 // supersede an unfinished claim. Preserve prior completed/retried history.
 await db.query(`INSERT INTO public_job_events(lease,event)
 SELECT c.lease,'superseded' FROM public_job_claims c
 WHERE c.task=$1 AND c.artifact_id=$2 AND c.lease<>$3
 AND c.content_revision<>$4 AND c.claimed_at<=(SELECT claimed_at FROM public_job_claims WHERE lease=$3)
 AND NOT EXISTS(SELECT 1 FROM public_job_events e WHERE e.lease=c.lease AND e.event<>'deadline_unreported')
 ON CONFLICT(lease,event) DO NOTHING`,[job.task,job.artifactId,job.lease,job.contentRevision]);
 return job;
}

export type JobOutcome='generated'|'archived'|'translated'|'deferred'|'retry'|'review';
export async function recordOutcome(db:Pick<PoolClient,'query'>,lease:string,event:JobOutcome){
 // Legacy in-flight leases predate the ledger; allow them to finish without
 // inventing a historical claim. New leases always have a matching claim.
 await db.query(`INSERT INTO public_job_events(lease,event) SELECT lease,$2 FROM public_job_claims WHERE lease=$1 ON CONFLICT(lease,event) DO NOTHING`,[lease,event]);
}

// An observation of missing telemetry, not a processing failure. In-flight
// transactions can commit later; their real outcomes must remain admissible.
// Do not infer failure for claims created before outcome tracking was deployed.
export async function reconcileUnreportedClaims(db:Pick<PoolClient,'query'>){
 const result=await db.query(`INSERT INTO public_job_events(lease,event)
 SELECT c.lease,'deadline_unreported' FROM public_job_claims c
 WHERE c.deadline<now()-interval '5 minutes'
 AND NOT EXISTS(SELECT 1 FROM public_job_events e WHERE e.lease=c.lease)
 ORDER BY c.deadline,c.lease LIMIT 100
 ON CONFLICT(lease,event) DO NOTHING RETURNING lease`);
 return result.rowCount??0;
}
