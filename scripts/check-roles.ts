import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {api} from '../lib/api';
import {pool} from '../lib/db';
import {hash,sessionName} from '../lib/auth';
const fixtures:{id:string,email:string,session:string}[]=[];
async function request(path:string,session='',body?:unknown){
  return api(new Request(`${process.env.APP_URL}/api/${path}`,{
    method:body?'POST':'GET', headers:{origin:process.env.APP_URL!,cookie:`${sessionName}=${session}`},
    ...(body?{body:JSON.stringify(body)}:{})
  }));
}
try {
  for(const role of ['member','moderator','editor','admin','super_admin']){
    const id=randomUUID(),email=`roles-${id}@example.invalid`,session=randomUUID();
    fixtures.push({id,email,session});
    await pool().query('INSERT INTO accounts(id) VALUES($1)',[id]);
    await pool().query("INSERT INTO identities(kind,value,account_id) VALUES('email',$1,$2)",[email,id]);
    await pool().query("INSERT INTO news_role_grants(kind,value,role) VALUES('email',$1,$2)",[email,role]);
    await pool().query("INSERT INTO sessions VALUES($1,$2,now()+interval '5 minutes')",[hash(session),id]);
    const rankingResponse=await request('ranking',session);
    assert.equal(rankingResponse.status,200);
    if(!['admin','super_admin'].includes(role)) assert.deepEqual((await rankingResponse.json()).history,[]);
    assert.equal((await request('staff/roles',session)).status,role==='super_admin'?200:403);
    assert.equal((await request('staff/reviews',session)).status,role==='member'?403:200);
    const sources=await (await request('sources',session)).json();
    assert.equal('source_score' in sources.sources[0],['admin','super_admin'].includes(role));
  }
  assert.equal((await request('ranking')).status,401);
  assert.equal((await request('editor/story/claim','',{})).status,401);
  const edition=await (await request('edition')).json();
  assert.equal(JSON.stringify(edition).includes('"ranking":'),false);
  assert.equal((await request('staff/reviews',fixtures[1].session,{item_id:'missing',status:'approved',note:'Should be denied'})).status,403);
  assert.equal((await request('staff/roles',fixtures[0].session,{kind:'email',value:fixtures[0].email,role:'super_admin'})).status,403);
  assert.equal((await request('staff/roles',fixtures[4].session,{kind:'email',value:fixtures[0].email,role:'moderator'})).status,200);
  assert.equal((await (await request('account',fixtures[0].session)).json()).account.role,'moderator');
  await pool().query("UPDATE news_role_grants SET protected=true WHERE value=$1",[fixtures[4].email]);
  assert.equal((await request('staff/roles',fixtures[4].session,{kind:'email',value:fixtures[4].email,role:'member'})).status,403);
  assert.equal((await request('reader-filters')).status,401);
  assert.equal((await request('reader-filters','',{topics:['Crypto']})).status,401);
  assert.equal((await request('reader-filters',fixtures[0].session,{topics:['Crypto','Bitcoin'],excludedTopics:['Politics'],countries:['PT'],excludedRegions:['Asia']})).status,200);
  const filters=await (await request('reader-filters',fixtures[0].session)).json();
  assert.deepEqual(filters.topics,['Crypto','Bitcoin']);assert.equal(filters.hideRead,true);
  assert.deepEqual((await (await request('reader-filters',fixtures[1].session)).json()).topics,[]);
  const itemId=fixtures[0].id.replaceAll('-','').repeat(2);
  await pool().query("INSERT INTO items(id,source_id,topic,kind,title,url,excerpt,published_at,owner_id) VALUES($1,'feedback-test','Tech','article','Feedback test','https://example.org','Private fixture',now(),$2)",[itemId,fixtures[0].id]);
  assert.equal((await request('reader-order','',{ids:[itemId]})).status,401);
  assert.deepEqual(await (await request('reader-order',fixtures[1].session,{ids:[itemId]})).json(),[]);
  assert.equal((await request('feedback','',{id:itemId,value:1})).status,401);
  assert.equal((await request('feedback',fixtures[1].session,{id:itemId,value:1})).status,404);
  assert.equal((await request('feedback',fixtures[0].session,{id:itemId,value:1})).status,200);
  assert.equal((await request('feedback',fixtures[0].session,{id:itemId,value:-1})).status,200);
  const votes=(await pool().query('SELECT value FROM article_feedback WHERE item_id=$1',[itemId])).rows;
  assert.deepEqual(votes,[{value:-1}]);
  assert.equal((await request('feedback',fixtures[0].session,{id:itemId,value:0})).status,200);
  assert.equal((await pool().query('SELECT 1 FROM article_feedback WHERE item_id=$1',[itemId])).rowCount,0);
  console.log('Verified server role boundaries, score redaction, escalation rejection, grant audit, protected owner and authenticated feedback isolation/update/undo.');
} finally {
  for(const f of fixtures){
    await pool().query('DELETE FROM news_staff_audit WHERE actor=$1',[f.id]);
    await pool().query('DELETE FROM news_role_grants WHERE value=$1',[f.email]);
    await pool().query('DELETE FROM accounts WHERE id=$1',[f.id]);
  }
  await pool().end();
}
