import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,verify} from 'node:crypto';import {feedAuthorized,signRoleFeed} from '../lib/roles-feed';
test('Private roles feed requires a distinct bearer and signs only wallet grants',()=>{
 assert.equal(feedAuthorized(null,'a'.repeat(64)),false);assert.equal(feedAuthorized('Bearer '+'b'.repeat(64),'a'.repeat(64)),false);assert.equal(feedAuthorized('Bearer '+'a'.repeat(64),'a'.repeat(64)),true);
 const keys=generateKeyPairSync('ed25519'),pem=keys.privateKey.export({type:'pkcs8',format:'pem'}).toString();
 const r=signRoleFeed([{value:'0x'+'a'.repeat(40),role:'super_admin'}],pem);
 assert(verify(null,Buffer.from(JSON.stringify(r.data)),keys.publicKey,Buffer.from(r.signature,'base64')));assert.match(r.data.coverageNote,/Email-only/);
 assert.throws(()=>signRoleFeed([{value:'email@example.com',role:'admin'}],pem));
});
