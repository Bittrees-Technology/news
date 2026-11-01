import test,{before,after,mock} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,generateKeyPairSync,sign,createHmac} from 'node:crypto';
import pg from 'pg';import {Wallet} from 'ethers';
import {pool,schema} from '../lib/db';
import {startChallenge,verifyChallenge,currentAccount,currentAuthentication,hash} from '../lib/auth';
import {sharedSignIn} from '../lib/sso';import {roleForAccount} from '../lib/roles';
import {ecosystemDecisionMessage} from '../shared/ecosystem-authority.mjs';
const origin='http://127.0.0.1:3070',issuer='https://roles.test',keys=generateKeyPairSync('ed25519'),source=generateKeyPairSync('ed25519');
let sharedIdentity='',sharedTime=0;const requests:any[]=[];
const pair=(s:string)=>s.split(';')[0];
const request=(cookies='',path='/api/auth/verify')=>new Request(origin+path,{headers:{cookie:cookies,origin}});
before(async()=>{
 assert(process.env.DATABASE_URL?.endsWith('/news_test'));
 const schemaName='session_proof_'+randomUUID().replaceAll('-',''),db=new pg.Client({connectionString:process.env.DATABASE_URL});
 await db.connect();try{await db.query('CREATE SCHEMA "'+schemaName+'"');}finally{await db.end();}
 const u=new URL(process.env.DATABASE_URL!);u.searchParams.set('options','-csearch_path='+schemaName);process.env.DATABASE_URL=u.toString();await pool().query(schema);
 Object.assign(process.env,{BITTREES_SSO_ENABLED:'1',BITTREES_SSO_ISSUER:issuer,BITTREES_SSO_CLIENT_SECRET:'synthetic-sso-test-secret-news-only',ROLES_ECOSYSTEM_REQUEST_PRIVATE_KEY:source.privateKey.export({type:'pkcs8',format:'pem'}),ROLES_ECOSYSTEM_DECISION_PUBLIC_KEY:keys.publicKey.export({type:'spki',format:'pem'}),ROLES_FEED_SUBJECT_SECRET:'synthetic-news-subject-secret-only'});
 mock.method(globalThis,'fetch',async(url:any,options:any)=>{
  if(String(url)===issuer+'/api/sso/redeem')return Response.json({issuer,audience:'news',identity:sharedIdentity,auth_time:sharedTime});
  assert.equal(String(url),'https://roles.bittrees.org/api/authority/ecosystem-decision');
  const r=JSON.parse(options.body).request;requests.push(r);const now=Date.now(),decision={version:1,issuer:'https://roles.bittrees.org',audience:r.source,request:r,authoritative:true,enrolled:true,policyRevision:29,actions:r.authenticatedWallet?['project.admin','role.super-admin']:[],checkedAt:now,expiresAt:now+5000,requiresPrivateOwnership:true};
  return Response.json({decision,signature:sign(null,Buffer.from(ecosystemDecisionMessage(decision)),keys.privateKey).toString('base64')});
 });
});
after(async()=>{mock.restoreAll();await pool().end();});
async function wallet(){const w=Wallet.createRandom(),c=await startChallenge(request(),{kind:'wallet',value:w.address,purpose:'login'}),r=await verifyChallenge(request(pair(c.cookie)),{id:c.body.id,proof:await w.signMessage(c.body.message!)});assert(r.authenticationCookie);return {w,r,cookies:[r.cookie,r.authenticationCookie!].map(pair).join('; ')};}
async function resume(identity:string,authTime:number){sharedIdentity=identity;sharedTime=authTime;const start=await sharedSignIn(request('','/api/sso/start?mode=resume')),state=new URL(start.headers.get('location')!).searchParams.get('state'),cookies=start.headers.getSetCookie().map(pair).join('; '),done=await sharedSignIn(request(cookies,'/api/sso/callback?code=synthetic&state='+encodeURIComponent(state!)));assert.equal(done.status,303);return done.headers.getSetCookie().map(pair).join('; ');}
test('native wallet gets current Superadmin while explicit lower active role and MCP boundary remain intact',async()=>{
 const a=await wallet(),account=(await currentAccount(request(a.cookies)))!;assert.equal(account.role,'super_admin');assert.equal(requests.at(-1).authenticatedWallet,a.w.address.toLowerCase());
 await pool().query('UPDATE sessions SET active_role=$1 WHERE hash=$2',['member',hash(a.r.cookie.split('=')[1].split(';')[0])]);assert.equal((await currentAccount(request(a.cookies)))!.role,'member');assert.equal(await roleForAccount(account.id),'member');
});
test('verified email SSO cannot inherit linked wallet authority and preserves original authentication time',async()=>{
 const a=await wallet(),account=(await currentAccount(request(a.cookies)))!,email=randomUUID()+'@example.invalid';await pool().query("INSERT INTO identities(kind,value,account_id) VALUES('email',$1,$2)",[email,account.id]);const at=Date.now()-90000,cookies=await resume(email,at);
 assert.equal((await currentAccount(request(cookies)))!.id,account.id);assert.equal((await currentAccount(request(cookies)))!.role,'member');assert.deepEqual(await currentAuthentication(request(cookies)),{identity:email,kind:'email',authTime:at});assert.equal(requests.at(-1).authenticatedWallet,null);
});
test('legacy, swapped, removed and expired proof cannot supply wallet administration or replace private account',async()=>{
 const a=await wallet(),b=await wallet(),legacy=pair(a.r.cookie);assert.equal((await currentAccount(request(legacy)))!.role,'member');assert.equal(await currentAuthentication(request(pair(b.r.cookie)+'; '+pair(a.r.authenticationCookie!))),null);
 const status=await sharedSignIn(request(legacy,'/api/sso/status'));assert.equal((await status.json()).action,null);const callback=await sharedSignIn(request(legacy,'/api/sso/callback?code=untrusted&state=untrusted'));assert.equal(callback.headers.getSetCookie().length,0);
 await pool().query('DELETE FROM identities WHERE value=$1',[a.w.address.toLowerCase()]);assert.equal(await currentAuthentication(request(a.cookies)),null);await pool().query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE hash=$1",[hash(b.r.cookie.split('=')[1].split(';')[0])]);assert.equal(await currentAuthentication(request(b.cookies)),null);
});
test('wallet SSO retains account and original authentication time',async()=>{const a=await wallet(),account=(await currentAccount(request(a.cookies)))!,at=Date.now()-120000,cookies=await resume(a.w.address.toLowerCase(),at);assert.equal((await currentAccount(request(cookies)))!.id,account.id);assert.equal((await currentAccount(request(cookies)))!.role,'super_admin');assert.equal((await currentAuthentication(request(cookies)))!.authTime,at);});
test('native verified email login never inherits a linked wallet',async()=>{
 const a=await wallet(),account=(await currentAccount(request(a.cookies)))!,email=randomUUID()+'@example.invalid',id=randomUUID(),browser='a'.repeat(64),code='12345678';await pool().query("INSERT INTO identities(kind,value,account_id) VALUES('email',$1,$2)",[email,account.id]);
 await pool().query("INSERT INTO challenges(id,kind,value,secret_hash,browser_hash,purpose,expires_at) VALUES($1,'email',$2,$3,$4,'login',now()+interval '5 minutes')",[id,email,createHmac('sha256',process.env.AUTH_SECRET!).update(id+':'+code).digest('hex'),hash(browser)]);
 const result=await verifyChallenge(request('news-challenge='+browser),{id,proof:code}),cookies=[result.cookie,result.authenticationCookie!].map(pair).join('; ');assert.equal((await currentAccount(request(cookies)))!.id,account.id);assert.equal((await currentAccount(request(cookies)))!.role,'member');assert.equal((await currentAuthentication(request(cookies)))!.identity,email);
});

test('daily email reuses verified identity, requires consent, and updates one owned subscription without sending',async()=>{
 const {subscribeDailyEmail}=await import('../lib/subscriptions');
 const id=randomUUID(),other=randomUUID(),email='daily-'+randomUUID()+'@example.org';
 await pool().query('INSERT INTO accounts(id) VALUES($1),($2)',[id,other]);
 await pool().query("INSERT INTO identities(kind,value,account_id) VALUES('email',$1,$2)",[email,id]);
 const old=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY='synthetic-not-used-to-send';
 try {
  await assert.rejects(subscribeDailyEmail(id,{email,confirm:false}));
  await assert.rejects(subscribeDailyEmail(other,{email,confirm:true}),/Verify this email/);
  const first=await subscribeDailyEmail(id,{email,confirm:true});
  const again=await subscribeDailyEmail(id,{email,confirm:true});
  assert.equal(first.id,again.id);assert.equal(first.enabled,true);assert.equal(first.cadence,'daily');
  assert.equal(first.delivery_time,'12:00');assert.equal(first.time_zone,'UTC');
  assert.equal((await pool().query('SELECT count(*)::int n FROM news_subscriptions WHERE account_id=$1',[id])).rows[0].n,1);
  assert.equal((await pool().query('SELECT count(*)::int n FROM deliveries WHERE account_id=$1',[id])).rows[0].n,0);
  assert.equal((await pool().query('SELECT enabled FROM destinations WHERE account_id=$1',[id])).rows[0].enabled,true);
 } finally {if(old===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=old;}
});

test('public daily email verification activates delivery atomically without issuing or changing sign-in sessions',async()=>{
 const {verifyEmailSubscription,emailSubscriptionCookie}=await import('../lib/email-subscription');
 const old=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY='synthetic-not-used-to-send';
 const email='public-daily-'+randomUUID()+'@example.org',id=randomUUID(),browser='b'.repeat(64),code='87654321';
 const signature=createHmac('sha256',process.env.AUTH_SECRET!).update('daily-email:'+id+':'+code).digest('hex');
 const count=Number((await pool().query('SELECT count(*) n FROM sessions')).rows[0].n);
 await pool().query("INSERT INTO challenges(id,kind,value,secret_hash,browser_hash,purpose,expires_at) VALUES($1,'email',$2,$3,$4,'daily_email',now()+interval '5 minutes')",[id,email,signature,hash(browser)]);
 try {
  await assert.rejects(verifyChallenge(request('news-challenge='+browser),{id,proof:code}),/Verification expired/);
  await assert.rejects(verifyEmailSubscription(request(emailSubscriptionCookie+'=wrong'),{id,code}),/Verification expired/);
  await assert.rejects(verifyEmailSubscription(request(emailSubscriptionCookie+'='+browser),{id,code:'11111111'}),/incorrect/);
  assert.equal((await pool().query('SELECT attempts FROM challenges WHERE id=$1',[id])).rows[0].attempts,1);
  const result=await verifyEmailSubscription(request(emailSubscriptionCookie+'='+browser),{id,code});
  assert.equal(result.body.subscribed,true);assert.match(result.cookie,/Max-Age=0/);assert.equal('authenticationCookie' in result,false);
  assert.equal(Number((await pool().query('SELECT count(*) n FROM sessions')).rows[0].n),count);
  const rows=(await pool().query("SELECT s.* FROM news_subscriptions s JOIN destinations d ON d.id=s.destination_id WHERE d.kind='email' AND d.value=$1",[email])).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].enabled,true);assert.equal(rows[0].cadence,'daily');
  assert.equal((await pool().query('SELECT count(*)::int n FROM deliveries WHERE account_id=$1',[rows[0].account_id])).rows[0].n,0);
  await assert.rejects(verifyEmailSubscription(request(emailSubscriptionCookie+'='+browser),{id,code}),/Verification expired/);
  const nextId=randomUUID(),nextHash=createHmac('sha256',process.env.AUTH_SECRET!).update('daily-email:'+nextId+':'+code).digest('hex');
  await pool().query("INSERT INTO challenges(id,kind,value,secret_hash,browser_hash,purpose,expires_at,attempts) VALUES($1,'email',$2,$3,$4,'daily_email',now()-interval '1 second',0)",[nextId,email,nextHash,hash(browser)]);
  await assert.rejects(verifyEmailSubscription(request(emailSubscriptionCookie+'='+browser),{id:nextId,code}),/Verification expired/);
  await pool().query("UPDATE challenges SET expires_at=now()+interval '5 minutes',attempts=5 WHERE id=$1",[nextId]);
  await assert.rejects(verifyEmailSubscription(request(emailSubscriptionCookie+'='+browser),{id:nextId,code}),/Verification expired/);
  await pool().query('UPDATE challenges SET attempts=0 WHERE id=$1',[nextId]);
  await verifyEmailSubscription(request(emailSubscriptionCookie+'='+browser),{id:nextId,code});
  assert.equal((await pool().query("SELECT count(*)::int n FROM news_subscriptions s JOIN destinations d ON d.id=s.destination_id WHERE d.value=$1",[email])).rows[0].n,1);
  assert.equal(Number((await pool().query('SELECT count(*) n FROM sessions')).rows[0].n),count);
 }finally{if(old===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=old;}
});
