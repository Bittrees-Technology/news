// Transaction-local tables: production rows are never touched.
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { retryStory, saveStoryCid } from '../../lib/story-documents';
import { saveTranslation } from '../../lib/translation';
const pool = new Pool({connectionString:process.env.DATABASE_URL});
const client=await pool.connect();
(globalThis as any).newsPool={query:client.query.bind(client)};
try {
 await client.query('BEGIN');
 await client.query('CREATE TEMP TABLE items(id text,owner_id uuid) ON COMMIT DROP');
 await client.query('CREATE TEMP TABLE story_documents(item_id text,lease uuid,claimed_at timestamptz,cid text,document jsonb,pinned_at timestamptz,error text,attempts int,available_at timestamptz) ON COMMIT DROP');
 await client.query('CREATE TEMP TABLE translations(key text,lease uuid,status text,claimed_at timestamptz,payload jsonb,attempts int,available_at timestamptz,result jsonb,completed_at timestamptz) ON COMMIT DROP');
 const id='a'.repeat(64),lease=randomUUID(),cid='b'+'a'.repeat(40);
 await client.query('INSERT INTO items VALUES($1,NULL)',[id]);
 await client.query("INSERT INTO story_documents VALUES($1,$2,now()-interval '31 minutes',NULL,'{}',NULL,NULL,1,now())",[id,lease]);
 await client.query("INSERT INTO translations VALUES($1,$2,'working',now()-interval '41 minutes','{}',1,now(),NULL,NULL)",[id,lease]);
 await assert.rejects(saveStoryCid({id,lease,cid}));
 await assert.rejects(retryStory({id,lease,busy:true,error:'busy'}));
 await assert.rejects(saveTranslation({key:id,lease,error:'test'} as any));
 await assert.rejects(saveTranslation({key:id,lease,deferred:true} as any));
 await client.query('UPDATE story_documents SET claimed_at=now()');
 await client.query('UPDATE translations SET claimed_at=now()');
 await assert.rejects(saveStoryCid({id,lease:randomUUID(),cid}));
 await saveStoryCid({id,lease,cid});
 await saveTranslation({key:id,lease,error:'test'} as any);
 assert.equal((await client.query('SELECT cid FROM story_documents')).rows[0].cid,cid);
 assert.equal((await client.query('SELECT status FROM translations')).rows[0].status,'pending');
 console.log('Expired and superseded leases rejected; active leases accepted (temporary tables).');
} finally {await client.query('ROLLBACK');client.release();await pool.end();delete (globalThis as any).newsPool;}
