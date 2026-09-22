import {Pool} from 'pg';
import assert from 'node:assert/strict';
import {publisherFamily} from '../../lib/diversity-shadow';
import {publicFeedBatch} from '../../lib/public-feed';
import {briefingBatch} from '../../lib/briefing-feed';
const p=new Pool({connectionString:process.env.DATABASE_URL}),d=await p.connect();
(globalThis as any).newsPool={query:d.query.bind(d)};
try{
 await d.query('BEGIN');
 await d.query('CREATE TEMP TABLE items (LIKE public.items INCLUDING DEFAULTS) ON COMMIT DROP');
 await d.query('CREATE TEMP TABLE story_documents (LIKE public.story_documents INCLUDING DEFAULTS) ON COMMIT DROP');
 await d.query('CREATE TEMP TABLE translations (LIKE public.translations INCLUDING DEFAULTS) ON COMMIT DROP');
 const snapshot='2026-09-22T12:00:00.000Z';
 for(let n=1;n<=65;n++){
  const id=n.toString(16).padStart(64,'0');
  await d.query(`INSERT INTO items(id,source_id,topic,kind,title,url,excerpt,summary_kind,published_at,fetched_at,owner_id) VALUES($1,'fixture','Tech','article',$1,'https://example.org/'||$1,'Evidence','excerpt',$2::timestamptz-($3||' hours')::interval,$2::timestamptz-interval '1 hour',NULL)`,[id,snapshot,n]);
  // Reverse source order to prove briefing creation time controls the reader.
  await d.query(`INSERT INTO story_documents(item_id,document,generated_at) VALUES($1,$2,$3::timestamptz-($4||' minutes')::interval)`,[id,JSON.stringify({evidence:{kind:'feed_excerpt'},briefing:{overview:'Fixture'}}),snapshot,66-n]);
 }
 const first=await publicFeedBatch(snapshot),second=await publicFeedBatch(snapshot,first.next),third=await publicFeedBatch(snapshot,second.next);
 assert.deepEqual([first.items.length,second.items.length,third.items.length],[30,30,5]);assert.equal(third.next,null);
 assert.equal(new Set([...first.items,...second.items,...third.items].map(i=>i.id)).size,65);
 assert.equal(first.items[0].id,(1).toString(16).padStart(64,'0'));assert.ok(third.items.some(i=>Date.parse(i.published_at)<Date.parse(snapshot)-86400000));
 const brief=await briefingBatch(null,null,snapshot),older=await briefingBatch(brief.next,null,snapshot);
 assert.equal(brief.entries.length,8);assert.equal(brief.entries[0].id,(65).toString(16).padStart(64,'0'));
 assert.equal(older.entries[0].id,(57).toString(16).padStart(64,'0'));
 await d.query('UPDATE story_documents SET document=NULL WHERE item_id=$1',[brief.entries[0].id]);
 assert.equal((await briefingBatch(null,null,snapshot)).entries[0].id,(64).toString(16).padStart(64,'0'));
 // Clicking an unfinished story must never substitute a different completed one.
 const pending=await briefingBatch(null,brief.entries[0].id,snapshot);
 assert.equal(pending.entries[0].id,brief.entries[0].id);assert.equal(pending.entries[0].document,null);assert.equal(pending.selectedId,brief.entries[0].id);
 await d.query('DELETE FROM story_documents WHERE item_id=$1',[brief.entries[0].id]);
 assert.equal((await briefingBatch(null,brief.entries[0].id,snapshot)).entries[0].id,brief.entries[0].id);
 const complete=await briefingBatch(null,older.entries[0].id,snapshot);
 assert.equal(complete.entries[0].id,older.entries[0].id);assert.ok(complete.entries[0].document);
 assert.equal((await briefingBatch(null,'f'.repeat(64),snapshot)).entries.length,0);
 // Arrivals after the reading snapshot never slide into later pages.
 await d.query("UPDATE items SET fetched_at=$1::timestamptz+interval '1 second' WHERE id=$2",[snapshot,first.items[0].id]);
 assert.equal((await publicFeedBatch(snapshot)).items[0].id,(2).toString(16).padStart(64,'0'));
 // Sparse categories are selected before LIMIT, not filtered out of a mixed page.
 await d.query("UPDATE items SET kind='podcast' WHERE id BETWEEN $1 AND $2",[(31).toString(16).padStart(64,'0'),(62).toString(16).padStart(64,'0')]);
 await d.query("UPDATE items SET kind='data' WHERE id>$1",[(62).toString(16).padStart(64,'0')]);
 const podcasts=await publicFeedBatch(snapshot,null,'podcasts');
 const morePodcasts=await publicFeedBatch(snapshot,podcasts.next,'podcasts');
 assert.equal(podcasts.items.length,30);assert.equal(morePodcasts.items.length,2);assert.equal(morePodcasts.next,null);
 assert.ok([...podcasts.items,...morePodcasts.items].every(i=>i.kind==='podcast'));
 assert.equal(new Set([...podcasts.items,...morePodcasts.items].map(i=>i.id)).size,32);
 const data=await publicFeedBatch(snapshot,null,'data');assert.equal(data.items.length,3);assert.equal(data.next,null);assert.ok(data.items.every(i=>i.kind==='data'));
 assert.ok((await publicFeedBatch(snapshot,null,'news')).items.every(i=>i.kind==='article'));
 await d.query("UPDATE items SET owner_id='00000000-0000-0000-0000-000000000001' WHERE id=$1",[data.items[0].id]);
 assert.equal((await publicFeedBatch(snapshot,null,'data')).items.length,2);
 assert.equal((await briefingBatch(null,data.items[0].id,snapshot)).entries.length,0);
 // Balanced coverage shares a publisher allowance across feeds and pages.
 await d.query('DELETE FROM items');
 let fixture=1000;
 for(const source of ['bbc-world','bbc-europe',...Array.from({length:18},(_,n)=>'publisher-'+n)]){
  for(let n=0;n<3;n++){
   const id=(++fixture).toString(16).padStart(64,'0');
   await d.query(`INSERT INTO items(id,source_id,topic,kind,title,url,excerpt,summary_kind,published_at,fetched_at) VALUES($1,$2,'World','article',$1,'https://example.org/'||$1,'Evidence','excerpt',$3::timestamptz-interval '10 minutes'-($4||' seconds')::interval,$3::timestamptz-interval '1 hour')`,[id,source,snapshot,fixture-1000]);
  }
 }
 const balanced=await publicFeedBatch(snapshot,null,'news',true);
 const balanceNext=await publicFeedBatch(snapshot,balanced.next,'news',true);
 const selected=[...balanced.items,...balanceNext.items];
 assert.equal(selected.length,38);assert.equal(balanceNext.next,null);
 assert.equal(new Set(selected.map(i=>i.id)).size,38);
 for(const family of new Set(selected.map(publisherFamily)))assert.equal(selected.filter(i=>publisherFamily(i)===family).length,2);
 const full=await publicFeedBatch(snapshot,null,'news',false),fullNext=await publicFeedBatch(snapshot,full.next,'news',false);
 assert.equal(full.items.length+fullNext.items.length,60);
 console.log('PASS: bounded feed/briefing pages, unique cursors, older history, completed creation order, frozen arrivals, sparse categories, exact unfinished/completed links and private exclusion, cross-page publisher balance and all-updates escape; rolled back fixtures');
}finally{await d.query('ROLLBACK');d.release();await p.end();delete (globalThis as any).newsPool;}
