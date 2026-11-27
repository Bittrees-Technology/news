import {Pool} from 'pg';
import assert from 'node:assert/strict';
import {sourceEvidence} from '../../lib/source-evidence';
import {publicFeedBatch} from '../../lib/public-feed';
import {briefingBatch} from '../../lib/briefing-feed';
import {translationKey} from '../../lib/translation';
import {translationFingerprint} from '../../lib/translation-review';
import {briefingFingerprintSql} from '../../lib/briefing-semantic-review';
import {publisherFamily} from '../../lib/diversity-shadow';

if(!process.env.DATABASE_URL)throw Error('Set DATABASE_URL to a disposable local PostgreSQL database');
const p=new Pool({connectionString:process.env.DATABASE_URL}),d=await p.connect();
(globalThis as any).newsPool={query:d.query.bind(d)};
try{
 await d.query('BEGIN');
 await d.query(`CREATE TEMP TABLE items(id text PRIMARY KEY,source_id text,authors text[],topic text,tags text[],kind text,title text,url text,excerpt text,summary text,summary_kind text,published_at timestamptz,fetched_at timestamptz,observation_period text,source_context text,owner_id uuid)`);
 await d.query(`CREATE TEMP TABLE story_documents(item_id text PRIMARY KEY,document jsonb,cid text,generated_at timestamptz)`);
 await d.query(`CREATE TEMP TABLE translations(key text,payload jsonb,result jsonb,status text)`);
 await d.query(`CREATE TEMP TABLE quality_reviews(task text,artifact_id text,category text,note text)`);
 const snapshot='2026-11-27T12:00:00Z';
 const briefing={overview:'A complete briefing describing the facts reported by the publisher.',points:['The original source provides the reported details.'],context:'The source provides the available background.',limitations:'Further independent details were not available.'};
 for(let n=1;n<=45;n++){
  const id=n.toString(16).padStart(64,'0'),i={id,title:'English fixture '+n,kind:'article',source_id:'bbc-world',excerpt:'A source excerpt providing evidence.',source_context:null};
  await d.query(`INSERT INTO items(id,source_id,authors,topic,tags,kind,title,url,excerpt,summary_kind,published_at,fetched_at) VALUES($1,'bbc-world','{}','World','{}','article',$2,'https://example.org/'||$1,$3,'excerpt',$4::timestamptz-($5||' minutes')::interval,$4::timestamptz-interval '1 day')`,[id,i.title,i.excerpt,snapshot,n]);
  // Five are missing a briefing, one has changed evidence, and one has an incomplete briefing.
  if(n<=5)continue;
  const evidence=sourceEvidence(i);if(n===6)evidence.revision='stale';
  const doc={title:i.title,kind:i.kind,source:{url:'https://example.org/'+id,authors:[]},evidence,briefing:n===7?{overview:'Incomplete'}:briefing};
  await d.query('INSERT INTO story_documents VALUES($1,$2,NULL,$3::timestamptz-($4||\' minutes\')::interval)',[id,JSON.stringify(doc),snapshot,n]);
 }
 const id='f'.repeat(64), pt={id,title:'O governo anunciou um plano',kind:'article',source_id:'eco',excerpt:'O governo anunciou uma nova medida.',source_context:null};
 await d.query(`INSERT INTO items(id,source_id,authors,topic,tags,kind,title,url,excerpt,summary_kind,published_at,fetched_at) VALUES($1,'eco','{}','World','{}','article',$2,'https://example.org/pt',$3,'excerpt',$4::timestamptz-interval '46 minutes',$4::timestamptz-interval '1 day')`,[id,pt.title,pt.excerpt,snapshot]);
 const ptDoc={title:pt.title,kind:'article',source:{url:'https://example.org/pt',authors:[]},evidence:sourceEvidence(pt),briefing};
 await d.query("INSERT INTO story_documents VALUES($1,$2,NULL,$3::timestamptz-interval '46 minutes')",[id,JSON.stringify(ptDoc),snapshot]);
 const fp=(await d.query(`SELECT ${briefingFingerprintSql('i','s.document')} AS fp FROM items i JOIN story_documents s ON s.item_id=i.id WHERE i.id=$1`,[id])).rows[0].fp;
 await d.query("INSERT INTO quality_reviews VALUES('briefing_semantics',$1,'briefing_approved',$2)",[id,fp+':reviewed']);
 const key=translationKey(pt as any),payload={title:pt.title,summary:pt.excerpt},result={language:'pt',title:'Government announces a plan',summary:'The government announced a new measure.',model:'fixture'};
 await d.query("INSERT INTO translations VALUES($1,$2,$3,'done')",[key,JSON.stringify(payload),JSON.stringify(result)]);
 assert.ok(!(await publicFeedBatch(snapshot)).items.some(i=>i.id===id));
 await d.query("INSERT INTO quality_reviews VALUES('translation',$1,'translation_approved',$2)",[key,JSON.stringify({fingerprint:translationFingerprint(key,payload,result)})]);
 assert.ok((await publicFeedBatch(snapshot,(30).toString(16).padStart(64,'0'))).items.some(i=>i.id===id));
 await d.query('DELETE FROM items WHERE id=$1',[id]);await d.query('DELETE FROM story_documents WHERE item_id=$1',[id]);
 const first=await publicFeedBatch(snapshot),second=await publicFeedBatch(snapshot,first.next);
 assert.equal(first.items.length,30);assert.equal(second.items.length,8);assert.equal(second.next,null);
 assert.equal(new Set([...first.items,...second.items].map(i=>i.id)).size,38);
 assert.ok(first.items.every(i=>i.publication_ready&&i.briefing_preview===briefing.overview));
 const missing=(1).toString(16).padStart(64,'0');assert.equal((await briefingBatch(null,missing,snapshot)).entries.length,0);
 const current=await briefingBatch(null,null,snapshot);assert.equal(current.entries.length,8);assert.ok(current.entries.every(i=>i.document?.briefing?.overview===briefing.overview));
 const next=await briefingBatch(current.next,null,snapshot);assert.equal(next.entries.length,8);assert.equal(new Set([...current.entries,...next.entries].map(i=>i.id)).size,16);
 // A dense held backlog advances the scan cursor without leaking filler or looping.
 for(let n=0;n<121;n++){
  const held=(1000+n).toString(16).padStart(64,'0');
  await d.query(`INSERT INTO items(id,source_id,authors,topic,tags,kind,title,url,excerpt,summary_kind,published_at,fetched_at) VALUES($1,'bbc-world','{}','World','{}','article','Pending source','https://example.org/'||$1,'Pending evidence','excerpt',$2::timestamptz-interval '1 second'-($3||' milliseconds')::interval,$2::timestamptz-interval '1 day')`,[held,snapshot,n]);
 }
 const heldPage=await publicFeedBatch(snapshot);assert.equal(heldPage.items.length,0);assert.ok(heldPage.next);
 const afterHeld=await publicFeedBatch(snapshot,heldPage.next);assert.equal(afterHeld.items.length,30);
 assert.ok(afterHeld.items.every(i=>i.publication_ready&&i.briefing_preview));
 // Snapshot isolation and private ownership still apply after readiness filtering.
 const readyId=(8).toString(16).padStart(64,'0');
 await d.query("UPDATE items SET fetched_at=$2::timestamptz+interval '1 second' WHERE id=$1",[readyId,snapshot]);
 assert.ok(!(await publicFeedBatch(snapshot,heldPage.next)).items.some(i=>i.id===readyId));
 await d.query("UPDATE items SET fetched_at=$2::timestamptz-interval '1 day',owner_id='00000000-0000-0000-0000-000000000001' WHERE id=$1",[readyId,snapshot]);
 assert.equal((await briefingBatch(null,readyId,snapshot)).entries.length,0);
 await d.query("UPDATE items SET owner_id=NULL WHERE id=$1",[readyId]);
 // Category selection precedes the page limit.
 await d.query("UPDATE items SET kind='podcast' WHERE id BETWEEN $1 AND $2",[(10).toString(16).padStart(64,'0'),(24).toString(16).padStart(64,'0')]);
 const podcasts=await publicFeedBatch(snapshot,null,'podcasts');assert.equal(podcasts.items.length,15);assert.ok(podcasts.items.every(i=>i.kind==='podcast'));
 await d.query('DELETE FROM quality_reviews');await d.query('DELETE FROM translations');await d.query('DELETE FROM story_documents');await d.query('DELETE FROM items');
 const sources=['bbc-world','bbc-europe','bbc-business','the-guardian-world','the-guardian-economics','al-jazeera','propublica','techdirt','times-of-israel'];
 let number=2000;
 for(const source of sources)for(let k=0;k<3;k++){
  const id=(++number).toString(16).padStart(64,'0'),i={id,title:'English report '+number,kind:'article',source_id:source,excerpt:'A source excerpt providing evidence.',source_context:null};
  await d.query(`INSERT INTO items(id,source_id,authors,topic,tags,kind,title,url,excerpt,summary_kind,published_at,fetched_at) VALUES($1,$2,'{}','World','{}','article',$3,'https://example.org/'||$1,$4,'excerpt',$5::timestamptz-interval '10 minutes'-($6||' seconds')::interval,$5::timestamptz-interval '1 day')`,[id,source,i.title,i.excerpt,snapshot,number-2000]);
  const doc={title:i.title,kind:i.kind,source:{url:'https://example.org/'+id,authors:[]},evidence:sourceEvidence(i),briefing};
  await d.query('INSERT INTO story_documents VALUES($1,$2,NULL,$3::timestamptz-interval \'10 minutes\')',[id,JSON.stringify(doc),snapshot]);
 }
 const balanced=await publicFeedBatch(snapshot,null,'news',true),full=await publicFeedBatch(snapshot,null,'news',false);
 const familyCount=new Set(full.items.map(publisherFamily)).size;
 assert.equal(full.items.length,sources.length*3);assert.equal(balanced.items.length,familyCount*2);
 for(const family of new Set(balanced.items.map(publisherFamily)))assert.equal(balanced.items.filter(i=>publisherFamily(i)===family).length,2);
 console.log('PASS: completed publication, bounded pagination, dense held backlog, snapshot and privacy, category and publisher balance.');
}finally{await d.query('ROLLBACK');d.release();await p.end();delete (globalThis as any).newsPool;}
