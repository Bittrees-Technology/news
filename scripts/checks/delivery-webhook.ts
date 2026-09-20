import {Pool} from 'pg';import {randomBytes} from 'node:crypto';import {Webhook} from 'svix';import assert from 'node:assert/strict';import {emailEvent} from '../../lib/webhook';
const p=new Pool({connectionString:process.env.DATABASE_URL}),c=await p.connect(),old=process.env.RESEND_WEBHOOK_SECRET;
process.env.RESEND_WEBHOOK_SECRET='whsec_'+randomBytes(32).toString('base64');const signer=new Webhook(process.env.RESEND_WEBHOOK_SECRET);
(globalThis as any).newsPool={query:c.query.bind(c),connect:async()=>({query:(sql:string,args?:any[])=>c.query(sql==='BEGIN'?'SAVEPOINT event_test':sql==='COMMIT'?'RELEASE SAVEPOINT event_test':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT event_test':sql,args),release:()=>{}})};
try{
 await c.query('BEGIN');
 await c.query('CREATE TEMP TABLE delivery_events(event_id text PRIMARY KEY,provider_id text,event_type text,status text,occurred_at timestamptz,received_at timestamptz DEFAULT now()) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE deliveries(provider_id text,destination_id text) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE destinations(id text,value text,kind text,enabled boolean,revision int) ON COMMIT DROP');
 await c.query('CREATE TEMP TABLE suppressions(value text PRIMARY KEY,reason text) ON COMMIT DROP');
 await c.query("INSERT INTO deliveries VALUES('test-provider','dest');INSERT INTO destinations VALUES('dest','test@example.invalid','email',true,1)");
 const send=(id:string,type:string,valid=true)=>{const now=new Date(),body=JSON.stringify({type,created_at:now.toISOString(),data:{email_id:'test-provider'}});return emailEvent(new Request('https://example.invalid',{method:'POST',body,headers:{'svix-id':id,'svix-timestamp':String(Math.floor(now.getTime()/1000)),'svix-signature':valid?signer.sign(id,now,body):'v1,invalid'}}));};
 await assert.rejects(send('bad','email.delivered',false));
 await send('event-delivered','email.delivered');await send('event-bounce','email.bounced');await send('event-bounce','email.bounced');await send('event-open','email.opened');
 assert.equal((await c.query('SELECT count(*)::int n FROM delivery_events')).rows[0].n,2);
 assert.equal((await c.query('SELECT revision FROM destinations')).rows[0].revision,2);
 console.log('Signed webhook verification, replay idempotency, suppression and ignored opens passed.');
}finally{await c.query('ROLLBACK');c.release();await p.end();if(old===undefined)delete process.env.RESEND_WEBHOOK_SECRET;else process.env.RESEND_WEBHOOK_SECRET=old;delete (globalThis as any).newsPool;}
