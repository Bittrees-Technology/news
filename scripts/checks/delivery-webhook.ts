import {Pool} from 'pg';
import {randomBytes, randomUUID} from 'node:crypto';
import {Webhook} from 'svix';
import assert from 'node:assert/strict';
import {emailEvent} from '../../lib/webhook';
import {accountDeliveryHistory} from '../../lib/delivery-history';
import {deliveryHistoryLabel} from '../../lib/delivery-events';

const p = new Pool({connectionString: process.env.DATABASE_URL});
const c = await p.connect();
const old = process.env.RESEND_WEBHOOK_SECRET;
process.env.RESEND_WEBHOOK_SECRET = 'whsec_'+randomBytes(32).toString('base64');
const signer = new Webhook(process.env.RESEND_WEBHOOK_SECRET);
(globalThis as any).newsPool = {query:c.query.bind(c),connect:async()=>({
  query:(sql:string,args?:any[])=>c.query(sql==='BEGIN'?'SAVEPOINT event_test':sql==='COMMIT'?'RELEASE SAVEPOINT event_test':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT event_test':sql,args),
  release:()=>{},
})};
const tagId = randomUUID();
const at = '2026-01-01T12:00:00.000Z';
function send(id:string,type:string,providerId:string,options:{time?:string,tag?:string,valid?:boolean}={}) {
  const now = new Date();
  const body = JSON.stringify({type,created_at:options.time || at,data:{email_id:providerId,
    ...(options.tag ? {tags:{news_delivery_id:options.tag}} : {})}});
  return emailEvent(new Request('https://example.invalid',{method:'POST',body,headers:{
    'svix-id':id,'svix-timestamp':String(Math.floor(now.getTime()/1000)),
    'svix-signature':options.valid===false?'v1,invalid':signer.sign(id,now,body),
  }}));
}
try {
  await c.query('BEGIN');
  await c.query(`CREATE TEMP TABLE delivery_events(event_id text PRIMARY KEY,provider_id text,event_type text,status text,occurred_at timestamptz,received_at timestamptz DEFAULT now()) ON COMMIT DROP;
    CREATE TEMP TABLE deliveries(id uuid PRIMARY KEY,account_id text,destination_id text,period text DEFAULT 'daily',status text,created_at timestamptz DEFAULT now(),sent_at timestamptz,error text,provider_id text) ON COMMIT DROP;
    CREATE TEMP TABLE destinations(id text,value text,kind text,enabled boolean,revision int) ON COMMIT DROP;
    CREATE TEMP TABLE suppressions(value text PRIMARY KEY,reason text) ON COMMIT DROP;
    INSERT INTO destinations VALUES('dest','test@example.invalid','email',true,1),('wallet','wallet-test','wallet',true,1)`);
  await c.query(`INSERT INTO deliveries(id,account_id,destination_id,status,provider_id) VALUES
    ($1,'a','dest','sent','known'),($2,'b','dest','sending',NULL),($3,'c','wallet','sent','wallet-provider')`,
    [randomUUID(),tagId,randomUUID()]);
  const history = async (account:string) => {
    const {rows} = await accountDeliveryHistory(account);
    assert.equal(rows.length,1);
    const row=rows[0];
    return {label:deliveryHistoryLabel(row.kind,row.status,row.provider_status),time:row.provider_status_at?.toISOString()};
  };
  assert.deepEqual(await history('a'),{label:'Accepted by Resend',time:undefined});
  await assert.rejects(send('invalid','email.delivered','known',{valid:false}));
  await send('unrelated','email.delivered','other-app');
  await send('wallet','email.delivered','wallet-provider');
  await send('wrong-tag','email.delivered','other-app',{tag:randomUUID()});
  await send('open','email.opened','known');
  assert.equal((await c.query('SELECT COUNT(*)::int n FROM delivery_events')).rows[0].n,0);
  await send('delivered','email.delivered','known');
  await send('delivered','email.delivered','known');
  await send('late-arrival','email.sent','known',{time:'2026-01-01T11:59:59.000Z'});
  assert.deepEqual(await history('a'),{label:'Delivered to mail server',time:at});
  assert.equal((await history('b')).label,'sending');
  await send('early-delivery','email.delivered','early',{tag:tagId});
  await send('conflicting-tag','email.delivered','different',{tag:tagId});
  assert.deepEqual(await history('b'),{label:'Delivered to mail server',time:at});
  assert.equal((await history('c')).label,'sent');
  assert.equal((await accountDeliveryHistory('missing')).rowCount,0);
  await send('bounce','email.bounced','known');
  await send('bounce','email.bounced','known');
  assert.equal((await history('a')).label,'Bounced');
  assert.equal((await c.query('SELECT COUNT(*)::int n FROM delivery_events')).rows[0].n,4);
  assert.equal((await c.query("SELECT revision FROM destinations WHERE id='dest'")).rows[0].revision,2);
  console.log('Delivery history passed: signed receipts, account isolation, delayed arrival, early delivery, duplicate and unrelated events, and suppression.');
} finally {
  await c.query('ROLLBACK');
  c.release(); await p.end();
  if (old===undefined) delete process.env.RESEND_WEBHOOK_SECRET; else process.env.RESEND_WEBHOOK_SECRET=old;
  delete (globalThis as any).newsPool;
}
