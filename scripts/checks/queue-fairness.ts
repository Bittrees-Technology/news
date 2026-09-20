import {Pool} from 'pg';import assert from 'node:assert/strict';import {claimStory} from '../../lib/story-documents';import {claimTranslation} from '../../lib/translation';
const p=new Pool({connectionString:process.env.DATABASE_URL}),c=await p.connect();
(globalThis as any).newsPool={query:c.query.bind(c),connect:async()=>({query:(sql:string,args?:any[])=>c.query(sql==='BEGIN'?'SAVEPOINT claim_test':sql==='COMMIT'?'RELEASE SAVEPOINT claim_test':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT claim_test':sql,args),release:()=>{}})};
try{
 await c.query('BEGIN');
 await c.query('CREATE TEMP TABLE worker_state(id text PRIMARY KEY,data jsonb,updated_at timestamptz DEFAULT now())');
 await c.query('CREATE TEMP TABLE items(id text PRIMARY KEY,title text,url text,kind text,source_id text,published_at timestamptz,authors text[],publication text,source_context text,excerpt text,owner_id uuid,fetched_at timestamptz)');
 await c.query('CREATE TEMP TABLE story_documents(item_id text PRIMARY KEY,cid text,document jsonb,attempts int DEFAULT 0,available_at timestamptz DEFAULT now(),claimed_at timestamptz,lease uuid,priority numeric,enqueued_at timestamptz)');
 await c.query('CREATE TEMP TABLE translations(key text PRIMARY KEY,status text,attempts int DEFAULT 0,available_at timestamptz DEFAULT now(),claimed_at timestamptz,lease uuid,priority numeric,created_at timestamptz,item_published_at timestamptz,payload jsonb)');
 for(let n=0;n<12;n++){
 const id=n.toString(16).padStart(64,'0'),old=n===0;
 await c.query("INSERT INTO items VALUES($1,'Test title','https://example.org','article','test',now()-$2*interval '1 day','{}','Test','Test evidence','Test evidence',NULL,now()-$2*interval '1 day')",[id,old?10:0]);
 await c.query("INSERT INTO story_documents(item_id,priority,enqueued_at) VALUES($1,$2,now()-$3*interval '1 day')",[id,old?0:90,old?10:0]);
 await c.query("INSERT INTO translations(key,status,priority,created_at,item_published_at,payload) VALUES($1,'pending',$2,now()-$3*interval '1 day',now()-$3*interval '1 day','{}')",[id,old?0:90,old?10:0]);
 }
 for(let n=1;n<=10;n++){const s=await claimStory(),t=await claimTranslation();assert.equal(s.item_id==='0'.repeat(64),n===10);assert.equal(t.key==='0'.repeat(64),n===10);}
 console.log('Real PostgreSQL: both queues select current work on turns 1–9 and oldest work on turn 10.');
}finally{await c.query('ROLLBACK');c.release(true);await p.end();delete (globalThis as any).newsPool;}
