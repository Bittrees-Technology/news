import test from "node:test";
import assert from "node:assert/strict";
import { canAccountSection, canApprove, canManageAccess, canReview, canScores } from "../lib/permissions";
test("role permissions keep access administration and editorial powers distinct", () => {
  for (const [role, review, approve, scores, access] of [
    ["member", false, false, false, false],
    ["moderator", true, false, false, false],
    ["editor", true, true, false, false],
    ["admin", true, true, true, false],
    ["super_admin", true, true, true, true],
    ["unknown", false, false, false, false],
  ] as const) {
    assert.equal(canReview(role), review);
    assert.equal(canApprove(role), approve);
    assert.equal(canScores(role), scores);
    assert.equal(canManageAccess(role), access);
    assert.equal(canAccountSection("access", role), access);
    assert.equal(canAccountSection("editorial", role), review);
    assert.equal(canAccountSection("settings", role), true);
  }
});
