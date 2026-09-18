import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {GET} from '../app/rss.xml/route';
import {pool} from '../lib/db';
const id=randomUUID(),slug='rss-test-'+id;
try{
 await pool().query('INSERT INTO accounts(id) VALUES($1)',[id]);
 const item={id:'f'.repeat(64),title:'RSS boundary fixture',url:'https://example.org/story',excerpt:'Published summary.',source_id:'test',topic:'Tech',kind:'article',published_at:new Date().toISOString()};
 await pool().query("INSERT INTO newspapers(account_id,name,slug,snapshot,published) VALUES($1,'RSS test',$2,$3,false)",[id,slug,JSON.stringify({front:[item],feeds:[]})]);
 const req=()=>new Request(`https://news.bittrees.org/rss.xml?newspaper=${slug}`);
 assert.equal((await GET(req())).status,404);
 await pool().query('UPDATE newspapers SET published=true WHERE account_id=$1',[id]);
 const response=await GET(req());assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok((await response.text()).includes('RSS boundary fixture'));
 await pool().query('UPDATE newspapers SET published=false WHERE account_id=$1',[id]);assert.equal((await GET(req())).status,404);
 console.log('RSS publication and unpublication boundaries verified.');
}finally{await pool().query('DELETE FROM accounts WHERE id=$1',[id]);await pool().end();}
