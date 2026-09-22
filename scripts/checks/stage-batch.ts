import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {recordStage} from '../../lib/stage-metrics';
const p=new Pool({connectionString:process.env.DATABASE_URL}),d=await p.connect();
(globalThis as any).newsPool={query:d.query.bind(d)};
try{
 await d.query('BEGIN');
 await d.query('CREATE TEMP TABLE story_documents(item_id text,lease uuid,claimed_at timestamptz) ON COMMIT DROP');
 await d.query('CREATE TEMP TABLE processing_stages(task text,artifact_id text,lease uuid,stage text,milliseconds double precision,PRIMARY KEY(task,artifact_id,lease,stage)) ON COMMIT DROP');
 const id='a'.repeat(64),lease=randomUUID();
 await d.query('INSERT INTO story_documents VALUES($1,$2,now())',[id,lease]);
 const batch={task:'briefing',id,lease,metrics:[{stage:'queue',milliseconds:12},{stage:'generation',milliseconds:34}]};
 await recordStage(batch);await recordStage(batch);
 assert.equal((await d.query('SELECT count(*)::int n FROM processing_stages')).rows[0].n,2);
 await assert.rejects(recordStage({...batch,lease:randomUUID()}),/lease/);
 await d.query("UPDATE story_documents SET claimed_at=now()-interval '41 minutes'");
 await assert.rejects(recordStage({...batch,metrics:[{stage:'archive',milliseconds:1}]}),/lease/);
 await recordStage(batch); // Existing exact retries are idempotent after expiry.
 assert.equal((await d.query('SELECT count(*)::int n FROM processing_stages')).rows[0].n,2);
 console.log('PASS: batch writes, idempotency, invalid and expired leases; rollback only');
}finally{await d.query('ROLLBACK');d.release();await p.end();delete (globalThis as any).newsPool;}
