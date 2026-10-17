import { test } from "node:test";
import assert from "node:assert/strict";
import {
  roleFromSharedActions,
  canManageAccess,
  canScores,
  canReview,
  requireScores,
  scoreVisibility,
} from "../lib/roles";

test("scores are restricted to administrators, not editorial roles", () => {
  for (const role of [
    undefined,
    "member",
    "moderator",
    "editor",
    "super-admin",
    "unknown",
  ]) {
    assert.equal(canScores(role), false);
    assert.throws(() => requireScores(role));
  }
  for (const role of ["admin", "super_admin"])
    assert.doesNotThrow(() => requireScores(role));
  assert.equal(canReview("moderator"), true);
  assert.equal(canReview("editor"), true);
  assert.equal(canReview("member"), false);
});
test("score redaction covers nested editions and snapshots without mutating cached originals", () => {
  const data = {
    data: {
      items: [{ title: "Story", ranking: { value: 98 }, source_score: 90 }],
    },
    feeds: [{ items: [{ ranking: { value: 70 } }] }],
  };
  const clean = scoreVisibility(data, "member");
  assert.deepEqual(clean, {
    data: { items: [{ title: "Story" }] },
    feeds: [{ items: [{}] }],
  });
  assert.equal(data.data.items[0].ranking.value, 98);
  assert.deepEqual(scoreVisibility(data, "admin"), data);
});

test("project administration cannot acquire Superadmin staff-management authority", () => {
  const admin = roleFromSharedActions(['project.admin', 'role.editor']);
  assert.equal(admin, 'admin');
  assert.equal(canScores(admin), true);
  assert.equal(canManageAccess(admin), false);
  assert.equal(roleFromSharedActions(['project.admin', 'role.super-admin']), 'super_admin');
  assert.equal(canManageAccess(roleFromSharedActions(['role.super-admin'])), true);
  assert.equal(roleFromSharedActions(['tier.partner']), 'member');
  assert.equal(roleFromSharedActions([]), 'member');
});
