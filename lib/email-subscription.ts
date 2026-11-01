import {createHmac, randomInt, randomUUID, timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {checkOrigin, cookie, hash, rateLimit, setCookie, token} from './auth';
import {pool, tx} from './db';
import {HttpError} from './model';
import {emailReady, sendEmail} from './mail';
import {dailyEmailDestination, saveSubscription} from './subscriptions';

export const emailSubscriptionCookie = process.env.NODE_ENV==='production' ? '__Host-news-email-subscription' : 'news-email-subscription';
export const emailSubscriptionStartSchema = z.object({email:z.email().max(254).transform(v=>v.toLowerCase()),confirm:z.literal(true)}).strict();
export const emailSubscriptionVerifySchema = z.object({id:z.uuid(),code:z.string().regex(/^\d{8}$/)}).strict();
function proofHash(id:string,code:string) {
  const secret=process.env.AUTH_SECRET;
  if(!secret || secret.length<32)throw new HttpError(503,'Email verification is unavailable.');
  return createHmac('sha256',secret).update('daily-email:'+id+':'+code).digest('hex');
}
export async function startEmailSubscription(r:Request,input:unknown) {
  const origin=checkOrigin(r),b=emailSubscriptionStartSchema.parse(input);
  if(!emailReady())throw new HttpError(503,'Email subscription is currently unavailable.');
  await rateLimit('challenge-ip:'+(r.headers.get('x-vercel-forwarded-for')||r.headers.get('x-forwarded-for')||'local'),30);
  // Share the existing per-address verification budget with sign-in.
  await rateLimit('challenge:email:'+b.email,5);
  const id=randomUUID(),browser=token(),code=String(randomInt(10000000,100000000));
  await pool().query("INSERT INTO challenges(id,kind,value,secret_hash,browser_hash,purpose,expires_at) VALUES($1,'email',$2,$3,$4,'daily_email',now()+interval '10 minutes')",[id,b.email,proofHash(id,code),hash(browser)]);
  try {
    await sendEmail(b.email,'TBN — Confirm your daily news email',`Your verification code is ${code}. It expires in ten minutes.\n\nEnter it at ${origin}/subscribe to subscribe to the daily Global news email at 12:00 UTC. Every daily email includes an unsubscribe link. This code does not sign you in.\n\nIf you did not request this, ignore this email.`,id);
  } catch(e) {await pool().query('DELETE FROM challenges WHERE id=$1',[id]);throw e;}
  return {body:{id},cookie:setCookie(emailSubscriptionCookie,browser,600)};
}
export async function verifyEmailSubscription(r:Request,input:unknown) {
  checkOrigin(r);
  const b=emailSubscriptionVerifySchema.parse(input),browser=cookie(r,emailSubscriptionCookie);
  const supplied=proofHash(b.id,b.code);
  const result=await tx(async db=>{
    const c=(await db.query('SELECT * FROM challenges WHERE id=$1 FOR UPDATE',[b.id])).rows[0];
    if(!browser || !c || c.kind!=='email' || c.purpose!=='daily_email' || c.consumed || new Date(c.expires_at)<new Date() || c.attempts>=5 || c.browser_hash!==hash(browser))return {error:'Verification expired. Please request a new code.'};
    await db.query('UPDATE challenges SET attempts=attempts+1 WHERE id=$1',[b.id]);
    if(c.secret_hash.length!==supplied.length || !timingSafeEqual(Buffer.from(c.secret_hash),Buffer.from(supplied)))return {error:'The code is incorrect.'};
    if(!emailReady())throw new HttpError(503,'Email subscription is currently unavailable.');
    // Coordinate with email login, but do not create or replace any session.
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['email:'+c.value]);
    let accountId=(await db.query("SELECT account_id FROM identities WHERE kind='email' AND value=$1",[c.value])).rows[0]?.account_id;
    if(!accountId) {
      accountId=randomUUID();
      await db.query('INSERT INTO accounts(id) VALUES($1)',[accountId]);
      await db.query("INSERT INTO identities(kind,value,account_id) VALUES('email',$1,$2)",[c.value,accountId]);
    }
    const destinationId=await dailyEmailDestination(db,accountId,c.value);
    await saveSubscription(accountId,{destinationId,target:'main',cadence:'daily',enabled:true,deliveryTime:'12:00',timeZone:'UTC',editionPreference:{scope:'global'}},db);
    await db.query('UPDATE challenges SET consumed=true WHERE id=$1',[b.id]);
    return {subscribed:true};
  });
  if(result.error)throw new HttpError(400,result.error);
  return {body:{subscribed:true},cookie:setCookie(emailSubscriptionCookie,'',0)};
}
