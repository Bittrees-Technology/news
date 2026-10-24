/** Disposable PostgreSQL only; never sends mail or invokes models. */
import {Pool} from 'pg';
import {saveAccountPreferences} from '../lib/account-preferences';
import {defaults} from '../lib/model';
import assert from 'node:assert/strict';
import {schema,pool} from '../lib/db';
import {saveSubscription,subscriptionSchema} from '../lib/subscriptions';
async function main(){
 const target=new URL(process.env.NEWS_MCP_TEST_DATABASE_URL||'');
 if(!['127.0.0.1','localhost'].includes(target.hostname))throw Error('Disposable local database required');
 process.env.DATABASE_URL=target.toString();
 const admin=new Pool({connectionString:target.toString()});
 const namespace='regional_'+crypto.randomUUID().replaceAll('-','');
 await admin.query(`CREATE SCHEMA ${namespace}`);
 (globalThis as any).newsPool=new Pool({connectionString:target.toString(),options:`-c search_path=${namespace}`,max:3});
 process.env.RESEND_API_KEY='synthetic-not-used';process.env.RESEND_FROM='synthetic@example.invalid';
 try {
 await pool().query(schema.replace('REVOKE ALL ON SCHEMA public FROM PUBLIC;',''));

 const a=(await pool().query('INSERT INTO accounts(id) VALUES(gen_random_uuid()) RETURNING id')).rows[0].id;
 const b=(await pool().query('INSERT INTO accounts(id) VALUES(gen_random_uuid()) RETURNING id')).rows[0].id;
 const destination=(await pool().query("INSERT INTO destinations(id,account_id,kind,value,verified_at,unsubscribe_hash) VALUES(gen_random_uuid(),$1,'email','synthetic@example.invalid',now(),'synthetic-hash') RETURNING id",[a])).rows[0].id;
 const input={destinationId:destination,target:'main',cadence:'daily',enabled:true,deliveryTime:'08:30',timeZone:'Europe/Lisbon',editionPreference:{scope:'city',country:'PT',city:'Lisbon'}};
 const sub=await saveSubscription(a,input);assert.equal(sub.delivery_time,'08:30');assert.equal(sub.edition_preference.city,'Lisbon');
 const again=await saveSubscription(a,{...input,deliveryTime:'09:45'});assert.equal(again.id,sub.id);assert.equal(again.delivery_time,'09:45');
 await assert.rejects(saveSubscription(b,{...input,id:sub.id}));
 await saveAccountPreferences(a,{...defaults,interests:'climate'});
 const preserved=(await pool().query('SELECT preferences FROM accounts WHERE id=$1',[a])).rows[0].preferences;assert.equal(preserved.deliverySubscriptions[sub.id].deliveryTime,'09:45');assert.equal(preserved.interests,'climate');
 assert.equal(subscriptionSchema.safeParse({...input,timeZone:'bad'}).success,false);
 const count=(await pool().query('SELECT count(*)::int n FROM news_subscriptions')).rows[0].n;assert.equal(count,1);
 console.log('PASS: existing preferences without migration; saved city/time/timezone; destination upsert; cross-account denial; invalid zone. No sends or production connection.');
 } finally {await pool().end();await admin.query(`DROP SCHEMA ${namespace} CASCADE`);await admin.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
