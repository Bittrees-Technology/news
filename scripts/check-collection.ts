import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool} from '../lib/db';
import {claimSource} from '../lib/collect';
const id='collection-test-'+randomUUID();
try{
 await pool().query('INSERT INTO sources(id) VALUES($1)',[id]);
 const results=await Promise.all([claimSource([id]),claimSource([id]),claimSource([id])]);
 const claims=results.filter(Boolean);assert.equal(claims.length,1);
 assert.equal(await claimSource([id]),undefined);
 await pool().query("UPDATE sources SET collection_lease_until=now()-interval '1 minute' WHERE id=$1",[id]);
 const reclaimed=await claimSource([id]);assert.notEqual(reclaimed.collection_lease,claims[0].collection_lease);
 const stale=await pool().query("UPDATE sources SET status='healthy' WHERE id=$1 AND collection_lease=$2",[id,claims[0].collection_lease]);assert.equal(stale.rowCount,0);
 await pool().query("UPDATE sources SET collection_lease_until=NULL,next_poll_at=now()+interval '1 hour' WHERE id=$1",[id]);
 assert.equal(await claimSource([id]),undefined);
 console.log('PASS: concurrent claims are exclusive, expired claims recover, stale claims cannot finalize, future sources are skipped');
}finally{await pool().query('DELETE FROM sources WHERE id=$1',[id]);await pool().end()}
