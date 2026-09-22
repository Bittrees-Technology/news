import {resolveEditorialReference} from '../../lib/editorial-reference';
import {Pool} from 'pg';
import assert from 'node:assert/strict';
import {briefingVersion} from '../../lib/briefing-versions';
import {briefingShortId,briefingPath} from '../../lib/briefing-links';
const p=new Pool({connectionString:process.env.DATABASE_URL}),c=await p.connect();
(globalThis as any).newsPool={query:c.query.bind(c)};
try{
 await c.query('BEGIN');
 for(const table of ['items','briefing_versions','translations','story_documents'])await c.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES) ON COMMIT DROP`);
 const id='e'.repeat(64),cid='bafy'+'a'.repeat(40),cid2='bafy'+'c'.repeat(40);
 await c.query("INSERT INTO items(id,source_id,topic,kind,title,url,excerpt,published_at) VALUES($1,'test','World','article','New title','https://example.org/new','Excerpt',now())",[id]);
 const doc={title:'Archived title',kind:'article',source:{url:'https://example.org/old',authors:['Original author'],publication:'Original publication',publishedAt:'2020-01-01T00:00:00Z'},briefing:{overview:'First version'},generatedAt:'2020-01-02T00:00:00Z'};
 for(const [cidValue,document] of [[cid,doc],[cid2,{...doc,briefing:{overview:'Second version'}}]] as const)await c.query('INSERT INTO briefing_versions(short_id,cid,item_id,document) VALUES($1,$2,$3,$4)',[cidValue.slice(-20),cidValue,id,JSON.stringify(document)]);
 await c.query("INSERT INTO translations(key,payload,status,result) VALUES($1,$2,'done',$3)",['f'.repeat(64),JSON.stringify({title:'Archived title',summary:'Fixture'}),JSON.stringify({title:'English archived title',language:'pt'})]);
 const legacy=await briefingVersion(cid.slice(-20));assert.equal(legacy.translation.title,'English archived title');
 const first=await briefingVersion(briefingShortId(cid));assert.equal(first.title,'Archived title');assert.equal(first.translation.title,'English archived title');assert.equal(first.url,'https://example.org/old');assert.deepEqual(first.authors,['Original author']);assert.equal(first.document.briefing.overview,'First version');assert.equal(first.cid,cid);assert.equal(briefingPath(first),'/briefings/'+briefingShortId(cid));
 assert.equal((await briefingVersion(briefingShortId(cid2))).document.briefing.overview,'Second version');
 await c.query('INSERT INTO story_documents(item_id,cid) VALUES($1,$2)',[id,cid2]);
 assert.equal((await resolveEditorialReference(c,id)).briefing_cid,cid2);
 for(const ref of [cid,cid.slice(-20),briefingShortId(cid),'https://news.bittrees.org/briefings/'+briefingShortId(cid)]){
  const resolved=await resolveEditorialReference(c,ref);assert.equal(resolved.item_id,id);assert.equal(resolved.briefing_cid,cid);
 }
 await c.query('SAVEPOINT collision');
 await assert.rejects(c.query('INSERT INTO briefing_versions(short_id,cid,item_id,document) VALUES($1,$2,$3,$4)',[briefingShortId(cid),'bafyc'+'a'.repeat(40),id,JSON.stringify(doc)]));
 await c.query('ROLLBACK TO SAVEPOINT collision');
 await c.query("UPDATE items SET owner_id='00000000-0000-4000-8000-000000000001' WHERE id=$1",[id]);
 assert.equal(await briefingVersion(briefingShortId(cid)),null);assert.equal(await briefingVersion('invalid'),null);await assert.rejects(resolveEditorialReference(c,id));await assert.rejects(resolveEditorialReference(c,cid));
 console.log('PASS: version isolation, stable short/CID mapping, collision rejection and private/invalid exclusion; rolled back');
}finally{await c.query('ROLLBACK');c.release(true);await p.end();delete (globalThis as any).newsPool;}
