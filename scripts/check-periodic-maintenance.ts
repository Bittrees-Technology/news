import {Pool} from 'pg';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {periodicMaintenance} from '../lib/periodic-maintenance';
if (!process.env.MAINTENANCE_TEST_DATABASE_URL) throw Error('Explicit isolated test database required');
const schema='efficiency_'+randomUUID().replaceAll('-','');
const admin=new Pool({connectionString:process.env.MAINTENANCE_TEST_DATABASE_URL});
await admin.query(`CREATE SCHEMA "${schema}"`);
const db=new Pool({connectionString:process.env.MAINTENANCE_TEST_DATABASE_URL,options:`-c search_path=${schema}`,max:5});
try {
 await db.query('CREATE TABLE worker_state(id text PRIMARY KEY,updated_at timestamptz NOT NULL DEFAULT now(),data jsonb NOT NULL)');
 let release!:()=>void, started!:()=>void, calls=0;
 const begun=new Promise<void>(r=>started=r);const wait=new Promise<void>(r=>release=r);
 const first=periodicMaintenance(db,async()=>{calls++;started();await wait;return 'done'});
 await begun;
 assert.equal(await periodicMaintenance(db,async()=>{calls++;return 'duplicate'}),null);
 release();assert.equal(await first,'done');
 assert.equal(await periodicMaintenance(db,async()=>{calls++;return 'too soon'}),null);assert.equal(calls,1);
 await db.query("UPDATE worker_state SET updated_at=now()-interval '6 minutes'");
 await assert.rejects(periodicMaintenance(db,async()=>{throw Error('retry me')}));
 assert.equal(await periodicMaintenance(db,async()=>{calls++;return 'retried'}),'retried');
 assert.equal(calls,2);
 console.log(JSON.stringify({passed:true,checks:['concurrent exclusion','five-minute throttle','failure retry','completion marker']}));
} finally {await db.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);await admin.end()}
