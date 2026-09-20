import {Pool} from 'pg';
import assert from 'node:assert/strict';
import {storeItems} from '../../lib/collect';
import type {Item} from '../../lib/model';
const p=new Pool({connectionString:process.env.DATABASE_URL}),c=await p.connect();
(globalThis as any).newsPool={query:c.query.bind(c)};
try {
 await c.query('BEGIN');
 // LIKE excludes foreign keys; all writes remain in rollback-local fixtures.
 await c.query('CREATE TEMP TABLE items (LIKE public.items INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE story_documents (LIKE public.story_documents INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES) ON COMMIT DROP');
 const item:Item={id:'a'.repeat(64),source_id:'test',topic:'World',kind:'article',title:'Original title',excerpt:'Original evidence.',url:'https://example.org/test',published_at:new Date().toISOString(),summary_kind:'excerpt'};
 await storeItems([item]);
 await c.query("UPDATE story_documents SET enqueued_at=now()-interval '1 hour',document='{}',cid='saved'");
 await storeItems([item]);
 assert.equal((await c.query("SELECT enqueued_at=now()-interval '1 hour' AS unchanged,cid FROM story_documents")).rows[0].unchanged,true);
 const revised={...item,title:'Revised title'};
 await storeItems([revised]);
 assert.deepEqual((await c.query('SELECT enqueued_at=now() AS reset,document,cid FROM story_documents')).rows[0],{reset:true,document:null,cid:null});
 await c.query("UPDATE story_documents SET enqueued_at=now()-interval '10 minutes',attempts=1,available_at=now()+interval '5 minutes'");
 await storeItems([revised]);
 assert.deepEqual((await c.query("SELECT enqueued_at=now()-interval '10 minutes' AS preserved,attempts FROM story_documents")).rows[0],{preserved:true,attempts:1});
 await c.query("UPDATE story_documents SET content_key=NULL,enqueued_at=NULL,document='{}',cid='legacy'");
 await storeItems([revised]);
 assert.deepEqual((await c.query('SELECT enqueued_at,cid FROM story_documents')).rows[0],{enqueued_at:null,cid:'legacy'});
 console.log('Revision clock reset, unchanged/refetched evidence, retry age and unknown legacy timestamps passed.');
} finally {await c.query('ROLLBACK');c.release(true);await p.end();delete (globalThis as any).newsPool;}
