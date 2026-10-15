import {randomUUID} from 'node:crypto';
import {createSsoClient} from '../shared/sso/client.mjs';
import {currentAccount,cookie,sessionName,hash,token,setCookie} from './auth';
import {pool,tx} from './db';
export async function sharedSignIn(req:Request){
 const env=process.env,origin=env.APP_URL||new URL(req.url).origin;
 return createSsoClient({clientId:'news',origin,issuer:env.BITTREES_SSO_ISSUER||'https://roles.bittrees.org',secret:env.BITTREES_SSO_CLIENT_SECRET,enabled:env.BITTREES_SSO_ENABLED==='1',adapter:{
  async current(r:Request){
   const account=await currentAccount(r,false);if(!account)return null;
   const key=cookie(r,sessionName),{rows}=await pool().query('SELECT i.value,s.expires_at FROM sessions s JOIN identities i ON i.account_id=s.account_id WHERE s.hash=$1 ORDER BY i.kind,i.value LIMIT 1',[hash(key)]);
   return rows[0]?{key,identity:rows[0].value,authTime:new Date(rows[0].expires_at).getTime()-79200000}:null;
  },
  async establish(identity:string,authTime:number){
   const key=token(),kind=identity.startsWith('0x')?'wallet':'email',expires=Math.min(Date.now()+79200000,authTime+604800000);
   await tx(async db=>{
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[kind+':'+identity]);
    let account=(await db.query('SELECT account_id FROM identities WHERE kind=$1 AND value=$2',[kind,identity])).rows[0]?.account_id;
    if(!account){account=randomUUID();await db.query('INSERT INTO accounts(id) VALUES($1)',[account]);await db.query('INSERT INTO identities(kind,value,account_id) VALUES($1,$2,$3)',[kind,identity,account]);}
    await db.query('INSERT INTO sessions(hash,account_id,expires_at) VALUES($1,$2,$3)',[hash(key),account,new Date(expires)]);
   });
   return {key,cookies:[setCookie(sessionName,key,Math.max(0,Math.floor((expires-Date.now())/1000)))]};
  }
 }})(req);
}
