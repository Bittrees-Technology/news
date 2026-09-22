import {Pool} from 'pg';import assert from 'node:assert/strict';
import {api} from '../../lib/api';import {hash,sessionName,currentAccount} from '../../lib/auth';
const p=new Pool({connectionString:process.env.DATABASE_URL}),c=await p.connect();
(globalThis as any).newsPool={query:c.query.bind(c)};
const origin=process.env.APP_URL||'https://news.bittrees.org';
const account='00000000-0000-4000-8000-000000000003',member='00000000-0000-4000-8000-000000000004';
function request(path:string,token:string,body?:unknown){return new Request(origin+'/api/'+path,{method:body?'POST':'GET',headers:{cookie:`${sessionName}=${token}`,origin,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});}
try{
 await c.query('BEGIN');
 for(const t of ['accounts','identities','news_role_grants','sessions'])await c.query(`CREATE TEMP TABLE ${t} (LIKE public.${t} INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES) ON COMMIT DROP`);
 await c.query('INSERT INTO accounts(id) VALUES($1),($2)',[account,member]);
 await c.query("INSERT INTO identities(kind,value,account_id) VALUES('email','fixture@example.invalid',$1)",[account]);
 await c.query("INSERT INTO news_role_grants(kind,value,role) VALUES('email','fixture@example.invalid','super_admin')");
 await c.query("INSERT INTO sessions(hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour'),($3,$4,now()+interval '1 hour')",[hash('staff-fixture'),account,hash('member-fixture'),member]);
 assert.equal((await currentAccount(request('session','staff-fixture')))?.role,'super_admin');
 assert.equal((await api(request('session/role','staff-fixture',{role:'member'}))).status,200);
 assert.equal((await currentAccount(request('session','staff-fixture')))?.role,'member');
 for(const path of ['staff/roles','staff/reviews','staff/processing'])assert.equal((await api(request(path,'staff-fixture'))).status,403);
 assert.equal((await api(request('session/role','member-fixture',{role:'editor'}))).status,403);
 assert.equal((await api(request('session/role','staff-fixture',{role:'editor'}))).status,200);
 assert.equal((await currentAccount(request('session','staff-fixture')))?.role,'editor');
 assert.equal((await api(request('staff/roles','staff-fixture'))).status,403);
 await c.query('DELETE FROM news_role_grants');
 assert.equal((await currentAccount(request('session','staff-fixture')))?.role,'member');
 assert.equal((await api(request('session/role','staff-fixture',{role:'super_admin'}))).status,403);
 const badOrigin=request('session/role','staff-fixture',{role:'member'});badOrigin.headers.set('origin','https://evil.example');
 assert.equal((await api(badOrigin)).status,403);
 console.log('PASS: session role enforcement, member downgrade, escalation denial, revocation fallback and origin checks; rollback-only fixtures');
}finally{await c.query('ROLLBACK');c.release(true);await p.end();delete (globalThis as any).newsPool;}
