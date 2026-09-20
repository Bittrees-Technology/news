import {Pool} from 'pg';import assert from 'node:assert/strict';import {claimStory} from '../../lib/story-documents';import {claimTranslation} from '../../lib/translation';
const p=new Pool({connectionString:process.env.DATABASE_URL}),c=await p.connect();
(globalThis as any).newsPool={query:c.query.bind(c),connect:async()=>({query:(sql:string,args?:any[])=>c.query(sql==='BEGIN'?'SAVEPOINT claim_test':sql==='COMMIT'?'RELEASE SAVEPOINT claim_test':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT claim_test':sql,args),release:()=>{}})};
try{
 await c.query('BEGIN');
 await c.query("CREATE TEMP TABLE public_job_claims(lease uuid PRIMARY KEY,task text,artifact_id text,content_revision text,phase text,deadline timestamptz,envelope jsonb,claimed_at timestamptz DEFAULT now())");
 await c.query('CREATE TEMP TABLE worker_state(id text PRIMARY KEY,data jsonb,updated_at timestamptz DEFAULT now())');
 await c.query('CREATE TEMP TABLE items(id text PRIMARY KEY,title text,url text,kind text,source_id text,published_at timestamptz,authors text[],publication text,source_context text,excerpt text,owner_id uuid,fetched_at timestamptz)');
 await c.query('CREATE TEMP TABLE story_documents(item_id text PRIMARY KEY,cid text,document jsonb,attempts int DEFAULT 0,available_at timestamptz DEFAULT now(),claimed_at timestamptz,lease uuid,priority numeric,enqueued_at timestamptz)');
 await c.query('CREATE TEMP TABLE translations(key text PRIMARY KEY,status text,attempts int DEFAULT 0,available_at timestamptz DEFAULT now(),claimed_at timestamptz,lease uuid,priority numeric,created_at timestamptz,item_published_at timestamptz,payload jsonb)');
 for(let n=0;n<13;n++){
 const id=n.toString(16).padStart(64,'0'),old=n===0;
 await c.query("INSERT INTO items VALUES($1,'Test title','https://example.org','article','test',now()-$2*interval '1 day','{}','Test','Test evidence','Test evidence',NULL,now()-$2*interval '1 day')",[id,old?10:0]);
 await c.query("INSERT INTO story_documents(item_id,priority,enqueued_at) VALUES($1,$2,now()-$3*interval '1 day')",[id,old?0:90,old?10:0]);
 await c.query("INSERT INTO translations(key,status,priority,created_at,item_published_at,payload) VALUES($1,'pending',$2,now()-$3*interval '1 day',now()-$3*interval '1 day','{}')",[id,old?0:90,old?10:0]);
 }
 const backedOff=(12).toString(16).padStart(64,'0');
 await c.query("UPDATE translations SET priority=999,available_at=now()+interval '10 minutes' WHERE key=$1",[backedOff]);
 await c.query("UPDATE story_documents SET priority=999,available_at=now()+interval '10 minutes' WHERE item_id=$1",[backedOff]);
 for(let n=1;n<=10;n++){const s=await claimStory(),t=await claimTranslation();assert.notEqual(s.item_id,backedOff);assert.notEqual(t.key,backedOff);assert.equal(s.item_id==='0'.repeat(64),n===10);assert.equal(t.key==='0'.repeat(64),n===10);}
 assert.equal((await c.query('SELECT count(*)::int n FROM public_job_claims')).rows[0].n,20);
 await c.query('DELETE FROM public_job_claims');
 await c.query("ALTER TABLE public_job_claims ADD CONSTRAINT reject_claims CHECK(false)");
 const before=(await c.query("SELECT count(*)::int n FROM story_documents WHERE lease IS NOT NULL")).rows[0].n;
 await assert.rejects(claimStory());
 assert.equal((await c.query("SELECT count(*)::int n FROM story_documents WHERE lease IS NOT NULL")).rows[0].n,before);
 const transBefore=(await c.query("SELECT count(*)::int n FROM translations WHERE lease IS NOT NULL")).rows[0].n;
 await assert.rejects(claimTranslation());
 assert.equal((await c.query("SELECT count(*)::int n FROM translations WHERE lease IS NOT NULL")).rows[0].n,transBefore);
 console.log('Atomic claim ledger rollback checks passed.');
 console.log('Real PostgreSQL: both queues select current work on turns 1–9 and oldest work on turn 10.');
}finally{await c.query('ROLLBACK');c.release(true);await p.end();delete (globalThis as any).newsPool;}
