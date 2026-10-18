import {Pool} from 'pg';import assert from 'node:assert/strict';import {claimStory,saveStory,retryStory,saveStoryCid} from '../../lib/story-documents';import {claimTranslation} from '../../lib/translation';
const p=new Pool({connectionString:process.env.DATABASE_URL}),c=await p.connect();
(globalThis as any).newsPool={query:c.query.bind(c),connect:async()=>({query:(sql:string,args?:any[])=>c.query(sql==='BEGIN'?'SAVEPOINT claim_test':sql==='COMMIT'?'RELEASE SAVEPOINT claim_test':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT claim_test':sql,args),release:()=>{}})};
try{
 await c.query('BEGIN');
 await c.query("CREATE TEMP TABLE public_job_claims(lease uuid PRIMARY KEY,task text,artifact_id text,content_revision text,phase text,deadline timestamptz,envelope jsonb,claimed_at timestamptz DEFAULT now())");
 await c.query('CREATE TEMP TABLE public_job_events(lease uuid,event text,PRIMARY KEY(lease,event))');
 await c.query('CREATE TEMP TABLE worker_state(id text PRIMARY KEY,data jsonb,updated_at timestamptz DEFAULT now())');
 await c.query('CREATE TEMP TABLE items(id text PRIMARY KEY,title text,url text,kind text,source_id text,published_at timestamptz,authors text[],publication text,source_context text,excerpt text,owner_id uuid,fetched_at timestamptz)');
 await c.query('CREATE TEMP TABLE story_documents(item_id text PRIMARY KEY,cid text,document jsonb,attempts int DEFAULT 0,available_at timestamptz DEFAULT now(),claimed_at timestamptz,lease uuid,priority numeric,enqueued_at timestamptz)');
 await c.query('CREATE TEMP TABLE translations(key text PRIMARY KEY,status text,attempts int DEFAULT 0,available_at timestamptz DEFAULT now(),claimed_at timestamptz,lease uuid,priority numeric,created_at timestamptz,item_published_at timestamptz,payload jsonb)');

 await c.query('ALTER TABLE story_documents ADD COLUMN generated_at timestamptz, ADD COLUMN pinned_at timestamptz, ADD COLUMN error text');
 await c.query('CREATE TEMP TABLE briefing_versions(short_id text,cid text UNIQUE,item_id text,document jsonb) ON COMMIT DROP');
 const fresh='a'.repeat(64),queued='b'.repeat(64);
 for(const id of [fresh,queued]){await c.query("INSERT INTO items VALUES($1,'Test title','https://example.org','article','test',now(),'{}','Test','Test evidence','Test evidence',NULL,now())",[id]);await c.query('INSERT INTO story_documents(item_id,priority,enqueued_at) VALUES($1,90,now())',[id]);}
 await c.query("UPDATE story_documents SET document='{}',attempts=9 WHERE item_id=$1",[queued]);
 const generation=await claimStory({phase:'generation'});assert.equal(generation.item_id,fresh);
 const upload=await claimStory({phase:'archive'});assert.equal(upload.item_id,queued);
 assert.equal(await claimStory({phase:'archive'}),null);
 const briefing={overview:'A factual overview grounded in the supplied source evidence.',points:['The source reports a bounded observation.'],context:'The observation concerns the reported period.',limitations:'The evidence is limited to a supplied excerpt.'};
 const doc=await saveStory({id:fresh,lease:generation.lease,briefing,model:'fixture',release:true});
 assert.deepEqual(doc.briefing,briefing);
 const saved=(await c.query('SELECT * FROM story_documents WHERE item_id=$1',[fresh])).rows[0];assert.equal(saved.lease,null);assert.equal(saved.attempts,0);assert.equal(saved.cid,null);
 await assert.rejects(saveStoryCid({id:fresh,lease:generation.lease,cid:'b'+'a'.repeat(40)}));
 assert.equal(await claimStory({phase:'generation'}),null);
 const archive=await claimStory({phase:'archive'});assert.equal(archive.item_id,fresh);assert.deepEqual(archive.document,doc);
 await retryStory({id:queued,lease:upload.lease,error:'archive outage'});
 assert.equal((await c.query('SELECT event FROM public_job_events WHERE lease=$1',[upload.lease])).rows[0].event,'retry');
 await c.query('UPDATE story_documents SET available_at=now() WHERE item_id=$1',[queued]);
 assert.equal((await claimStory({phase:'archive'})).item_id,queued);
 await saveStoryCid({id:fresh,lease:archive.lease,cid:'b'+'a'.repeat(40)});
 assert.equal((await c.query('SELECT count(*)::int n FROM briefing_versions')).rows[0].n,1);
 // Expired infrastructure claims remain recoverable; quality-exhausted jobs do not.
 await c.query("UPDATE story_documents SET document=NULL,cid=NULL,attempts=3,claimed_at=now()-interval '31 minutes',available_at=now() WHERE item_id=$1",[fresh]);
 const recovered=await claimStory({phase:'generation'});assert.equal(recovered.item_id,fresh);
 assert.equal((await c.query('SELECT attempts FROM story_documents WHERE item_id=$1',[fresh])).rows[0].attempts,3);
 await retryStory({id:fresh,lease:recovered.lease,busy:true,error:'transport:generate'});
 assert.equal((await c.query('SELECT attempts FROM story_documents WHERE item_id=$1',[fresh])).rows[0].attempts,2);
 await c.query('UPDATE story_documents SET attempts=3,available_at=now() WHERE item_id=$1',[fresh]);
 assert.equal(await claimStory({phase:'generation'}),null);
 console.log('PASS: independent generation/archive claims, released generation lease, saved pending document, archive retries beyond three attempts, stale lease denial and completed archive.');
}finally{await c.query('ROLLBACK');c.release();await p.end();}
