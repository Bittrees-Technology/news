/** Disposable local PostgreSQL only. No provider, subscriber or article collection calls. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool,schema,tx} from '../lib/db';
import {saveAnnotations} from '../lib/persist-annotations';
import {reviewDesk,saveCoverage,reviewedCoverage} from '../lib/coverage-store';
import {groupCoverage} from '../lib/coverage';
import {articleRevision} from '../lib/coverage-review';
import {HttpError, type Item} from '../lib/model';

const target=new URL(process.env.DATABASE_URL||'');
if(!['localhost','127.0.0.1'].includes(target.hostname)||!target.searchParams.get('host')?.startsWith('/private/tmp/tbn-coverage-'))
  throw Error('Run against the disposable local coverage fixture.');
try{
 const db=pool();await db.query(schema);
 const actor=randomUUID(),id=randomUUID(),a='1'.repeat(64),b='2'.repeat(64);
 for(const [key,source] of [[a,'bbc-world'],[b,'p-blico']]){
  await db.query("INSERT INTO items(id,source_id,topic,kind,title,url,excerpt,summary_kind,published_at) VALUES($1,$2,'Energy','article','Grid outage in Mozambique',$3,'The utility restored service in three districts.','excerpt',now())",[key,source,'https://example.org/'+key]);
 }
 const items=(await db.query('SELECT * FROM items ORDER BY id')).rows as Item[];
 await tx(async client=>{
   assert.equal(await saveAnnotations(client,items),2);
   assert.equal(await saveAnnotations(client,items),0);
   assert.equal(await saveAnnotations(client,[{...items[0],owner_id:actor}]),0);
 });
 assert.equal((await reviewDesk(true)).articles.length,2);
 const edit={id,expectedVersion:0,state:'approved',title:'Grid service restored',
  reports:items.map(i=>({id:i.id,revision:articleRevision(i),origin:i.source_id})),claims:[{text:'Three districts have power again.',evidence:[{id:a,quote:'restored service in three districts'}]}]};
 const concurrent=await Promise.allSettled([saveCoverage(actor,edit),saveCoverage(actor,edit)]);
 assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(concurrent.filter(r=>r.status==='rejected' && r.reason instanceof HttpError && r.reason.status===409).length,1);
 assert.equal((await reviewDesk()).events.length,1);
 process.env.NEWS_COVERAGE_WEB='1';
 assert.deepEqual((await reviewedCoverage(items,'email')).map(i=>i.coverage),[undefined,undefined]);
 assert.equal(groupCoverage(await reviewedCoverage(items,'web'))[0].coverage?.claims.length,0);
 process.env.NEWS_COVERAGE_BRIEFINGS='1';process.env.NEWS_COVERAGE_EMAIL='1';
 assert.equal(groupCoverage(await reviewedCoverage(items,'email'))[0].coverage?.claims.length,1);
 await db.query("UPDATE items SET excerpt='A corrected account.' WHERE id=$1",[a]);
 assert.equal(groupCoverage(await reviewedCoverage(items,'web')).length,2);
 await assert.rejects(()=>saveCoverage(actor,{...edit,expectedVersion:1}));
 await saveCoverage(actor,{...edit,expectedVersion:1,state:'withdrawn'});
 assert.equal((await db.query('SELECT count(*)::int n FROM news_coverage_members')).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM news_coverage_history')).rows[0].n,2);
 console.log('Coverage integration passed: public projection, concurrent revision, exact citations, email gate, correction and withdrawal.');
}finally{await pool().end();}
