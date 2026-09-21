import {Pool} from 'pg';
import assert from 'node:assert/strict';
import {briefingBatch} from '../../lib/briefing-feed';
const p=new Pool({connectionString:process.env.DATABASE_URL}),c=await p.connect();
(globalThis as any).newsPool={query:c.query.bind(c)};
try{
 await c.query('BEGIN');
 for(const table of ['items','story_documents','translations'])await c.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES) ON COMMIT DROP`);
 for(let n=1;n<=47;n++)await c.query(`INSERT INTO items(id,source_id,topic,kind,title,url,excerpt,published_at,fetched_at,owner_id) VALUES($1,$2,'World',$3,'Fixture title','https://example.org','Fixture excerpt',$4,'2010-01-01',$5)`,[n.toString(16).padStart(64,'0'),'source-'+n%3,['article','podcast','data'][n%3],n===47?'2099-01-01':'2020-01-01',n===46?'00000000-0000-4000-8000-000000000001':null]);
 await c.query(`INSERT INTO story_documents(item_id,document) VALUES($1,$2)`,[(1).toString(16).padStart(64,'0'),JSON.stringify({briefing:{overview:'Prepared briefing',points:[],limitations:'Fixture'}})]);
 const first=await briefingBatch(null,null,'2026-01-01T00:00:00Z');
 assert.equal(first.entries.length,30);assert.ok(first.next);assert.equal(new Set(first.entries.map((i:any)=>i.kind)).size,3);
 const second=await briefingBatch(first.next,null,first.snapshot);
 assert.equal(second.entries.length,15);assert.equal(second.next,null);
 const all=[...first.entries,...second.entries];assert.equal(new Set(all.map(i=>i.id)).size,45);assert.equal(new Set(all.map(i=>i.source_id)).size,3);assert.equal(all.filter(i=>i.document).length,1);
 assert.ok(all.every(i=>i.owner_id===null&&i.evidence_label));
 const selected=await briefingBatch(null,(10).toString(16).padStart(64,'0'),first.snapshot);assert.equal(selected.entries.length,10);
 assert.equal((await briefingBatch((46).toString(16).padStart(64,'0'),null,first.snapshot)).entries.length,0);
 console.log('PASS: stable tie pagination, all source kinds, unprepared posts, selected start, private/future exclusion; rollback-only fixtures');
}finally{await c.query('ROLLBACK');c.release(true);await p.end();delete (globalThis as any).newsPool;}
