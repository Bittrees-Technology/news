import test from 'node:test';
import assert from 'node:assert/strict';
import {accountDeletionSchema} from '../lib/account-deletion';
test('account deletion rejects legacy, partial and accidental confirmation payloads',()=>{
 for(const input of [{},null,{confirmation:'DELETE MY ACCOUNT'},{confirmation:'delete my account',acknowledge:true},{confirmation:'DELETE MY ACCOUNT ',acknowledge:true},{confirmation:'DELETE MY ACCOUNT',acknowledge:false},{confirmation:'DELETE MY ACCOUNT',acknowledge:'true'},{confirmation:'DELETE MY ACCOUNT',acknowledge:true,accountId:'another-account'}])assert.equal(accountDeletionSchema.safeParse(input).success,false);
 assert.deepEqual(accountDeletionSchema.parse({confirmation:'DELETE MY ACCOUNT',acknowledge:true}),{confirmation:'DELETE MY ACCOUNT',acknowledge:true});
});
