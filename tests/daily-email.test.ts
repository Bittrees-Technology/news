import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyEmailSchema, dailyEmailDestination} from '../lib/subscriptions';

test('daily email requires explicit consent and accepts no account or schedule overrides',()=>{
  for(const input of [{email:'reader@example.org'}, {email:'reader@example.org',confirm:false}, {email:'reader@example.org',confirm:true,accountId:'other'}, {email:'invalid',confirm:true}])
    assert.equal(dailyEmailSchema.safeParse(input).success,false);
  assert.equal(dailyEmailSchema.parse({email:'Reader@example.org',confirm:true}).email,'reader@example.org');
});
test('an email absent from the current account verified records cannot create a destination',async()=>{
  let calls=0;
  const db={query:async(sql:string,args:unknown[])=>{
    calls++;assert.match(sql,/account_id=\$1/);assert.match(sql,/verified_at IS NOT NULL/);
    assert.deepEqual(args,['current-account','someone@example.org']);return {rows:[]};
  }};
  await assert.rejects(dailyEmailDestination(db as any,'current-account','someone@example.org'),/Verify this email/);
  assert.equal(calls,1);
});
test('a verified email creates only a paused destination before normal subscription activation',async()=>{
  const calls:{sql:string,args:unknown[]}[]=[];
  const db={query:async(sql:string,args:unknown[])=>{calls.push({sql,args});return {rows:calls.length===1?[{value:'reader@example.org'}]:[{id:'destination'}]};}};
  assert.equal(await dailyEmailDestination(db as any,'account','reader@example.org'),'destination');
  assert.equal(calls[1].args[1],'account');
  assert.equal(calls[1].args[2],'reader@example.org');
  assert.doesNotMatch(calls[1].sql,/SET enabled|enabled.*true/i);
});
