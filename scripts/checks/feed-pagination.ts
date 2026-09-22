import {Pool} from 'pg';
import assert from 'node:assert/strict';
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
 // Arrivals after the reading snapshot never slide into later pages.
 await d.query("UPDATE items SET fetched_at=$1::timestamptz+interval '1 second' WHERE id=$2",[snapshot,first.items[0].id]);
 assert.equal((await publicFeedBatch(snapshot)).items[0].id,(2).toString(16).padStart(64,'0'));
 console.log('PASS: bounded feed/briefing pages, unique cursors, older history, completed creation order, frozen arrivals; rolled back fixtures');
}finally{await d.query('ROLLBACK');d.release();await p.end();delete (globalThis as any).newsPool;}
