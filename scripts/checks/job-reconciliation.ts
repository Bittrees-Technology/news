import {Pool} from 'pg';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {reconcileUnreportedClaims,recordOutcome} from '../../lib/job-ledger';

const p=new Pool({connectionString:process.env.DATABASE_URL}),c=await p.connect();
try {
 await c.query('BEGIN');
 // Keep every fixture and call on one transaction-pooled backend; rollback
 // before releasing it so temporary tables cannot shadow production tables.
 await c.query('CREATE TEMP TABLE public_job_claims(lease uuid PRIMARY KEY,deadline timestamptz NOT NULL) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE public_job_events(lease uuid REFERENCES public_job_claims,event text,recorded_at timestamptz DEFAULT now(),PRIMARY KEY(lease,event)) ON COMMIT DROP');
 const recent=randomUUID(),boundary=randomUUID(),active=randomUUID();
 for(const [lease,minutes] of [[recent,-4],[boundary,-5],[active,5]] as const)
  await c.query("INSERT INTO public_job_claims VALUES($1,now()+$2*interval '1 minute')",[lease,minutes]);
 for(const event of ['generated','archived','translated','deferred','retry','review'] as const){
  const lease=randomUUID();
  await c.query("INSERT INTO public_job_claims VALUES($1,now()-interval '1 hour')",[lease]);
  await recordOutcome(c,lease,event);
 }
 const stale=Array.from({length:105},()=>randomUUID());
 for(const lease of stale)await c.query("INSERT INTO public_job_claims VALUES($1,now()-interval '1 hour')",[lease]);
 assert.equal(await reconcileUnreportedClaims(c),100);
 assert.equal(await reconcileUnreportedClaims(c),5);
 assert.equal(await reconcileUnreportedClaims(c),0);
 assert.equal((await c.query("SELECT count(*)::int n FROM public_job_events WHERE event='deadline_unreported'")).rows[0].n,105);
 assert.equal((await c.query('SELECT count(*)::int n FROM public_job_events WHERE lease=ANY($1::uuid[])',[[recent,boundary,active]])).rows[0].n,0);
 // The reconciler records missing telemetry, never rejects a late outcome
 // or interprets old instrumentation gaps as worker failure.
 await recordOutcome(c,stale[0],'archived');
 await recordOutcome(c,stale[0],'archived');
 assert.deepEqual((await c.query('SELECT event FROM public_job_events WHERE lease=$1 ORDER BY event',[stale[0]])).rows.map(r=>r.event),['archived','deadline_unreported']);
 assert.equal(await reconcileUnreportedClaims(c),0);
 console.log('Reconciliation bounds, grace period, completed claims, replay and late outcomes passed.');
} finally {await c.query('ROLLBACK');c.release(true);await p.end();}
