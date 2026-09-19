import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {pool} from '../lib/db';
import {storeItems} from '../lib/collect';
import {saveStory,retryStory} from '../lib/story-documents';
import {saveTranslation} from '../lib/translation';
import type {Item} from '../lib/model';
const id=createHash('sha256').update(randomUUID()).digest('hex'),key=createHash('sha256').update(randomUUID()).digest('hex');
const item:Item={id,source_id:'processing-test',topic:'Science',kind:'article',title:'Processing integration fixture',url:'https://example.org/'+id,excerpt:'A source-backed observation for an isolated processing test.',source_context:'A source-backed observation for an isolated processing test.',summary_kind:'excerpt',published_at:'2000-01-01T00:00:00Z'};
try{
 await storeItems([item]);
 const lease=randomUUID();await pool().query('UPDATE story_documents SET lease=$2,claimed_at=now(),attempts=1 WHERE item_id=$1',[id,lease]);
 const payload={id,lease,briefing:{overview:'A source-backed observation for an isolated processing test.',points:['A test observation with bounded evidence.'],limitations:'Only supplied test evidence is available.'},model:'integration-test'};
 await saveStory(payload);
 await assert.rejects(saveStory({...payload,lease:randomUUID()}),/lease/);
 await storeItems([item]);
 assert.ok((await pool().query('SELECT document FROM story_documents WHERE item_id=$1',[id])).rows[0].document);
 await storeItems([{...item,source_context:'Changed evidence for this same source article.'}]);
 let row=(await pool().query('SELECT * FROM story_documents WHERE item_id=$1',[id])).rows[0];
 assert.equal(row.document,null);assert.equal(row.lease,null);assert.equal(row.attempts,0);
 await assert.rejects(saveStory(payload),/lease/);
 await pool().query('UPDATE story_documents SET lease=$2,claimed_at=now(),attempts=1 WHERE item_id=$1',[id,lease]);
 await retryStory({id,lease,busy:true,error:'ModelBusy'});
 row=(await pool().query('SELECT * FROM story_documents WHERE item_id=$1',[id])).rows[0];assert.equal(row.attempts,0);assert.equal(row.lease,null);
 await pool().query("INSERT INTO translations(key,payload,status,lease,attempts) VALUES($1,'{}','working',$2,1)",[key,lease]);
 await saveTranslation({key,lease,language:'und',model:'integration-test',deferred:true});
 row=(await pool().query('SELECT * FROM translations WHERE key=$1',[key])).rows[0];assert.equal(row.status,'pending');assert.equal(row.attempts,0);assert.equal(row.lease,null);
 console.log('PASS: unchanged-content reuse, changed-content invalidation, stale-lease rejection, busy deferral without lost retries');
}finally{await pool().query('DELETE FROM translations WHERE key=$1',[key]);await pool().query('DELETE FROM items WHERE id=$1',[id]);await pool().end()}
