import test from 'node:test';
import assert from 'node:assert/strict';
import {emailSubscriptionStartSchema,emailSubscriptionVerifySchema} from '../lib/email-subscription';
test('public signup requires consent and accepts no account, target, schedule or verification overrides',()=>{
 for(const input of [{email:'reader@example.org'}, {email:'reader@example.org',confirm:false}, {email:'reader@example.org',confirm:true,accountId:'other'}, {email:'reader@example.org',confirm:true,kind:'wallet'}, {email:'bad',confirm:true}])assert.equal(emailSubscriptionStartSchema.safeParse(input).success,false);
 assert.equal(emailSubscriptionStartSchema.parse({email:'READER@example.org',confirm:true}).email,'reader@example.org');
 for(const code of ['1234','1234567x','123456789'])assert.equal(emailSubscriptionVerifySchema.safeParse({id:'00000000-0000-4000-8000-000000000001',code}).success,false);
});
