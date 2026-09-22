import test from 'node:test';import assert from 'node:assert/strict';
import {availableRoles,effectiveRole} from '../lib/active-role';
import {canApprove,canScores,canManageAccess} from '../lib/permissions';
test('staff can enter member or inherited lower roles without elevating member accounts',()=>{
 assert.deepEqual(availableRoles('member'),['member']);assert.deepEqual(availableRoles('editor'),['member','moderator','editor']);assert.equal(availableRoles('super_admin').length,5);
 assert.equal(effectiveRole('super_admin','member'),'member');assert.equal(effectiveRole('member','super_admin'),'member');assert.equal(effectiveRole('unknown',null),'member');
 assert.equal(effectiveRole('editor','admin'),'member');assert.equal(effectiveRole('super_admin',null),'super_admin');
 for(const check of [canApprove,canScores,canManageAccess])assert.equal(check(effectiveRole('super_admin','member')),false);
 assert.equal(canApprove('moderator'),false);
});
