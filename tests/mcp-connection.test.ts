import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { connectionMetadata } from "../lib/mcp-connection";
test("connection metadata includes only authenticated IDs, declared scopes and expiry", () => {
  const id = randomUUID(),
    account = randomUUID(),
    expires = new Date("2030-01-01T00:00:00Z");
  const result = connectionMetadata({
    id,
    account_id: account,
    expires_at: expires,
    scopes: ["read", "curate"],
    hash: "SECRET_HASH",
    token: "SECRET_KEY",
    email: "PRIVATE_EMAIL",
    wallet: "PRIVATE_WALLET",
  });
  assert.deepEqual(result, {
    contractVersion: "news-mcp-connection-v1",
    credentialId: id,
    accountId: account,
    scopes: ["curate", "read"],
    expiresAt: expires.toISOString(),
  });
  assert.throws(() =>
    connectionMetadata({
      ...result,
      id,
      account_id: account,
      expires_at: new Date("invalid"),
    }),
  );
  assert.throws(() =>
    connectionMetadata({
      id,
      account_id: account,
      expires_at: expires,
      scopes: ["admin"],
    }),
  );
});
