import {issueSessionProof} from '../shared/sso/session-proof.mjs';
import {randomUUID} from 'node:crypto';
import {createSsoClient} from '../shared/sso/client.mjs';
import {currentAccount,currentAuthentication,authenticationCookieName,cookie,sessionName,hash,token,setCookie} from './auth';
import {pool,tx} from './db';
export async function sharedSignIn(req:Request){
 const env=process.env,origin=env.APP_URL||new URL(req.url).origin;
 const local=await currentAccount(req,false);
 if(local&&!await currentAuthentication(req)){
  const u=new URL(req.url),headers={'Cache-Control':'private, no-store'};
  if(u.origin!==origin||req.method!=='GET')return Response.json({error:'Unexpected sign-in request'},{status:403,headers});
  if(u.pathname.endsWith('/status'))return Response.json({configured:env.BITTREES_SSO_ENABLED==='1'&&Boolean(env.BITTREES_SSO_CLIENT_SECRET&&env.BITTREES_SSO_CLIENT_SECRET.length>=32),action:null,reauthenticationRequired:true},{headers});
  if(u.pathname.endsWith('/profile'))return Response.json({error:'Sign in again to use shared identity'},{status:401,headers});
  return new Response(null,{status:303,headers:{...headers,Location:origin+'/'}});
 }
 return createSsoClient({clientId:'news',origin,issuer:env.BITTREES_SSO_ISSUER||'https://roles.bittrees.org',secret:env.BITTREES_SSO_CLIENT_SECRET,enabled:env.BITTREES_SSO_ENABLED==='1',adapter:{
  async current(r:Request){
   const authentication=await currentAuthentication(r);if(!authentication)return null;
   return {key:cookie(r,sessionName),identity:authentication.identity,authTime:authentication.authTime};
  },
  async establish(identity:string,authTime:number){
   const key=token(),kind=identity.startsWith('0x')?'wallet':'email',expires=Math.min(Date.now()+79200000,authTime+604800000);
   const proof=issueSessionProof({clientId:'news',session:key,identity,authTime},env.AUTH_SECRET);
   await tx(async db=>{
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[kind+':'+identity]);
    let account=(await db.query('SELECT account_id FROM identities WHERE kind=$1 AND value=$2',[kind,identity])).rows[0]?.account_id;
    if(!account){account=randomUUID();await db.query('INSERT INTO accounts(id) VALUES($1)',[account]);await db.query('INSERT INTO identities(kind,value,account_id) VALUES($1,$2,$3)',[kind,identity,account]);}
    await db.query('INSERT INTO sessions(hash,account_id,expires_at) VALUES($1,$2,$3)',[hash(key),account,new Date(expires)]);
   });
   return {key,cookies:[setCookie(sessionName,key,Math.max(0,Math.floor((expires-Date.now())/1000))),setCookie(authenticationCookieName,proof,Math.max(0,Math.floor((expires-Date.now())/1000)))]};
  }
 }})(req);
}
