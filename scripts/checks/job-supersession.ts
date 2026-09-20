import {Pool} from 'pg';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {publicJob} from '../../lib/job-contract';
import {recordClaim,recordOutcome} from '../../lib/job-ledger';
const p=new Pool({connectionString:process.env.DATABASE_URL}),c=await p.connect();
try {
 await c.query('BEGIN');
 await c.query('CREATE TEMP TABLE public_job_claims(lease uuid PRIMARY KEY,task text,artifact_id text,content_revision text,phase text,deadline timestamptz,envelope jsonb,claimed_at timestamptz DEFAULT now()) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE public_job_events(lease uuid,event text,PRIMARY KEY(lease,event)) ON COMMIT DROP');
 const a=publicJob('briefing','a','old',randomUUID());
 await recordClaim(c,a);
 const same=publicJob('briefing','a','old',randomUUID());
 await recordClaim(c,same);
 assert.equal((await c.query('SELECT count(*)::int n FROM public_job_events')).rows[0].n,0);
 await recordOutcome(c,same.lease,'archived');
 const other=publicJob('briefing','b','old',randomUUID());
 await recordClaim(c,other);
 const translation=publicJob('translation','a','old',randomUUID());
 await recordClaim(c,translation);
 await c.query("INSERT INTO public_job_events VALUES($1,'deadline_unreported')",[a.lease]);
 const replacement=publicJob('briefing','a','new',randomUUID());
 await recordClaim(c,replacement);
 await recordClaim(c,replacement);
 await recordClaim(c,a); // Replaying an old claim cannot supersede its replacement.
 assert.deepEqual((await c.query("SELECT lease FROM public_job_events WHERE event='superseded'")).rows.map(r=>r.lease),[a.lease]);
 assert.deepEqual((await c.query('SELECT event FROM public_job_events WHERE lease=$1 ORDER BY event',[a.lease])).rows.map(r=>r.event),['deadline_unreported','superseded']);
 assert.equal((await c.query('SELECT count(*)::int n FROM public_job_claims')).rows[0].n,5);
 console.log('Revision supersession, replay, task/artifact isolation and completed-history preservation passed.');
} finally {await c.query('ROLLBACK');c.release(true);await p.end();}
