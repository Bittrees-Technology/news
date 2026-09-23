/** Disposable local/CI schema only; no production tokens, content or jobs. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { pool, schema } from "../lib/db";
import { mcp, createMcpToken } from "../lib/mcp";
const target = new URL(process.env.NEWS_MCP_TEST_DATABASE_URL || "");
if (!["127.0.0.1", "localhost"].includes(target.hostname))
  throw Error("Use an isolated local PostgreSQL service.");
process.env.DATABASE_URL = target.toString();
const control = new Pool({ connectionString: target.toString(), max: 1 });
const name = "news_mcp_" + randomUUID().replaceAll("-", "");
try {
  await control.query(`CREATE SCHEMA ${name}`);
  (globalThis as any).newsPool = new Pool({
    connectionString: target.toString(),
    options: `-c search_path=${name}`,
    max: 3,
  });
  await pool().query(
    schema.replace("REVOKE ALL ON SCHEMA public FROM PUBLIC;", ""),
  );
  const a = randomUUID(),
    b = randomUUID();
  for (const id of [a, b])
    await pool().query("INSERT INTO accounts(id) VALUES($1)", [id]);
  const keyA = (
    await createMcpToken(a, { name: "Synthetic A", scopes: ["read"], days: 7 })
  ).token;
  const keyB = (
    await createMcpToken(b, {
      name: "Synthetic B",
      scopes: ["read", "curate", "publish", "delivery"],
      days: 30,
    })
  ).token;
  const rpc = async (key: string, method: string, params: any = {}) =>
    mcp(
      new Request("https://news.bittrees.org/api/mcp", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: randomUUID(),
          method,
          params,
        }),
      }),
    );
  const tool = async (key: string, args: any = {}) => {
    const r = await rpc(key, "tools/call", {
      name: "get_connection",
      arguments: args,
    });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.ok(!body.error && !body.result.isError);
    return JSON.parse(body.result.content[0].text);
  };
  const list = await (await rpc(keyA, "tools/list")).json();
  assert.ok(
    list.result.tools.find(
      (x: any) => x.name === "get_connection" && x.annotations.readOnlyHint,
    ),
  );
  assert.ok(
    !list.result.tools.some((x: any) =>
      ["publish_newspaper", "set_subscription", "curate_summary"].includes(
        x.name,
      ),
    ),
  );
  const before = (await pool().query("SELECT * FROM accounts ORDER BY id"))
    .rows;
  const ownA = await tool(keyA, {
    accountId: b,
    credentialId: randomUUID(),
    scopes: ["publish"],
    expiresAt: "2099-01-01T00:00:00Z",
  });
  const ownB = await tool(keyB);
  assert.equal(ownA.accountId, a);
  assert.equal(ownB.accountId, b);
  assert.notEqual(ownA.credentialId, ownB.credentialId);
  assert.deepEqual(ownA.scopes, ["read"]);
  assert.deepEqual(ownB.scopes, ["curate", "delivery", "publish", "read"]);
  assert.equal(ownA.contractVersion, "news-mcp-connection-v1");
  assert.ok(Date.parse(ownA.expiresAt) > Date.now());
  assert.deepEqual(Object.keys(ownA).sort(), [
    "accountId",
    "contractVersion",
    "credentialId",
    "expiresAt",
    "scopes",
  ]);
  assert.equal(JSON.stringify(ownA).includes(keyA), false);
  assert.deepEqual(
    (await pool().query("SELECT * FROM accounts ORDER BY id")).rows,
    before,
  );
  assert.ok(
    (
      await (
        await rpc(keyA, "tools/call", {
          name: "publish_newspaper",
          arguments: {},
        })
      ).json()
    ).error,
  );
  assert.ok(
    (
      await (
        await rpc(keyA, "tools/call", {
          name: "set_subscription",
          arguments: {},
        })
      ).json()
    ).error,
  );
  assert.deepEqual(
    (await pool().query("SELECT DISTINCT action FROM curation_audit")).rows,
    [{ action: "get_connection" }],
  );
  await pool().query(
    "UPDATE mcp_tokens SET expires_at=now()-interval '1 second' WHERE id=$1",
    [ownA.credentialId],
  );
  assert.equal(
    (await rpc(keyA, "tools/call", { name: "get_connection", arguments: {} }))
      .status,
    401,
  );
  await pool().query("DELETE FROM mcp_tokens WHERE id=$1", [ownB.credentialId]);
  assert.equal(
    (await rpc(keyB, "tools/call", { name: "get_connection", arguments: {} }))
      .status,
    401,
  );
  assert.equal(
    (
      await rpc("tbn_" + "0".repeat(64), "tools/call", {
        name: "get_connection",
        arguments: {},
      })
    ).status,
    401,
  );
  for (const table of [
    "public_job_claims",
    "public_job_events",
    "story_documents",
    "editor_jobs",
    "translations",
  ])
    assert.equal(
      Number(
        (await pool().query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n,
      ),
      0,
    );
  console.log(
    "Actual News MCP: own-credential projection, cross-account and scope isolation, expiry/revocation, secret exclusion and unchanged processing queues pass.",
  );
} finally {
  await (globalThis as any).newsPool?.end();
  await control.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
  await control.end();
  delete (globalThis as any).newsPool;
}
