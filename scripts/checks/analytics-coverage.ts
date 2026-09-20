import {Pool} from 'pg';
import assert from 'node:assert/strict';
import {analyticsAudit} from '../../lib/analytics-audit';
const pool=new Pool({connectionString:process.env.DATABASE_URL}),c=await pool.connect();
(globalThis as any).newsPool={query:c.query.bind(c)};
try{
 await c.query('BEGIN');
 await c.query('CREATE TEMP TABLE diversity_shadows(edition_id text,recorded_at timestamptz,data jsonb) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE reader_events(account_id text,item_id text,event_type text,bucket date) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE sources(transferred_bytes bigint,conditional_hits int,completed_checks int,collected_items int) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE delivery_events(provider_id text,status text,occurred_at timestamptz,received_at timestamptz) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE worker_state(id text,updated_at timestamptz,data jsonb) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE items(id text,source_id text,kind text,owner_id text,published_at timestamptz) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE story_documents(item_id text,document jsonb,cid text) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE article_feedback(item_id text,account_id text,updated_at timestamptz) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE source_observations(source_id text,observed_at timestamptz,status text) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE deliveries(status text,created_at timestamptz) ON COMMIT DROP');
 let r=await analyticsAudit();assert.equal(r.recent.topSourceShare,null);assert.equal(r.coverage.total,0);
 await c.query("INSERT INTO items VALUES('public','source-a','article',NULL,now()),('private','secret-source','article','owner',now()),('old','source-b','podcast',NULL,now()-interval '2 days'),('future','source-c','data',NULL,now()+interval '1 day')");
 await c.query("INSERT INTO story_documents VALUES('public','{}','cid'),('private','{}','private-cid')");
 await c.query("INSERT INTO article_feedback VALUES('public','reader',now()),('private','private-reader',now())");
 r=await analyticsAudit();assert.equal(r.coverage.total,3);assert.equal(r.coverage.briefings,1);assert.equal(r.recent.total,1);assert.equal(r.recent.topSourceShare,1);assert.equal(r.feedback.voters,1);assert.equal(JSON.stringify(r).includes('secret-source'),false);
 console.log('Analytics empty state, public scope, time window and unique-voter checks passed.');
}finally{await c.query('ROLLBACK');c.release();await pool.end();delete (globalThis as any).newsPool;}
