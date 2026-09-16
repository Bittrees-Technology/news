import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { Wallet } from "ethers";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { pool } from "../lib/db";
import { publishPersonal, recordPersonalRankings } from "../lib/curation";
import { defaults } from "../lib/model";
const base = process.env.TEST_ORIGIN || "http://127.0.0.1:3070",
  origin = process.env.APP_URL || base;
const accounts: string[] = [],
  clients: Client[] = [];
async function req(
  path: string,
  data?: unknown,
  cookie = "",
  method = data ? "POST" : "GET",
) {
  const r = await fetch(base + "/api/" + path, {
    method,
    headers: {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
async function login() {
  const w = Wallet.createRandom();
  const c = await req("auth/start", {
    kind: "wallet",
    purpose: "login",
    value: w.address,
  });
  assert.equal(c.status, 200);
  const v = await req(
    "auth/verify",
    { id: c.data.id, proof: await w.signMessage(c.data.message) },
    c.cookie,
  );
  const a = await req("account", undefined, v.cookie);
  accounts.push(a.data.account.id);
  return { id: a.data.account.id, cookie: v.cookie };
}
async function connect(secret: string) {
  const client = new Client({ name: "TBN integration test", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(base + "/api/mcp"), {
      requestInit: { headers: { Authorization: "Bearer " + secret } },
    }),
  );
  clients.push(client);
  return client;
}
try {
  const a = await login(),
    b = await login();
  const slug = "qa-curation-" + randomUUID().slice(0, 8);
  assert.equal(
    (
      await req(
        "newspaper",
        { name: "Curation QA", slug, published: false },
        a.cookie,
      )
    ).status,
    200,
  );
  const read = (
    await req(
      "mcp/tokens",
      { name: "QA read", scopes: ["read"], days: 7 },
      a.cookie,
    )
  ).data;
  const reader = await connect(read.token);
  const readTools = (await reader.listTools()).tools.map((t) => t.name);
  assert.ok(readTools.includes("list_articles"));
  assert.ok(!readTools.includes("set_preferences"));
  assert.ok(!readTools.includes("publish_newspaper"));
  await assert.rejects(() =>
    reader.callTool({ name: "set_preferences", arguments: defaults }),
  );
  const write = (
    await req(
      "mcp/tokens",
      { name: "QA curator", scopes: ["read", "curate"], days: 7 },
      a.cookie,
    )
  ).data;
  const curator = await connect(write.token);
  assert.ok(
    (await curator.listTools()).tools.some((t) => t.name === "add_source"),
  );
  assert.equal(
    (
      await curator.callTool({
        name: "set_preferences",
        arguments: { ...defaults, interests: "science energy" },
      })
    ).isError,
    undefined,
  );
  assert.equal(
    (await req("account", undefined, b.cookie)).data.preferences.interests,
    "",
  );
  await assert.rejects(() =>
    curator.callTool({ name: "publish_newspaper", arguments: {} }),
  );
  const bad = await curator.callTool({
    name: "add_source",
    arguments: {
      name: "Internal",
      url: "https://127.0.0.1/feed",
      topic: "Tech",
    },
  });
  assert.equal(bad.isError, true);
  const privateId = createHash("sha256").update(randomUUID()).digest("hex");
  await pool().query(
    "INSERT INTO items(id,source_id,topic,kind,title,url,excerpt,published_at,owner_id) VALUES($1,'qa-private','Tech','article','Private curation example','https://example.invalid/secret','This passage belongs only to the other account.',now(),$2)",
    [privateId, b.id],
  );
  assert.equal(
    (
      await curator.callTool({
        name: "curate_summary",
        arguments: {
          itemId: privateId,
          summary: "This passage belongs only to the other account.",
        },
      })
    ).isError,
    true,
  );
  const item = (
    await pool().query(
      "SELECT id,excerpt FROM items WHERE owner_id IS NULL AND length(excerpt)>20 ORDER BY published_at DESC LIMIT 1",
    )
  ).rows[0];
  assert.equal(
    (
      await curator.callTool({
        name: "curate_summary",
        arguments: {
          itemId: item.id,
          summary: "Unsupported invented quote that the article never said.",
        },
      })
    ).isError,
    true,
  );
  assert.equal(
    (
      await curator.callTool({
        name: "curate_summary",
        arguments: { itemId: item.id, summary: item.excerpt.slice(0, 200) },
      })
    ).isError,
    undefined,
  );
  assert.equal(
    (
      await pool().query(
        "SELECT count(*)::int n FROM article_curation WHERE account_id=$1",
        [b.id],
      )
    ).rows[0].n,
    0,
  );
  await curator.callTool({
    name: "set_feed",
    arguments: {
      name: "Science desk",
      slug: "science-desk",
      preferences: defaults,
    },
  });
  await curator.callTool({ name: "refresh_rankings", arguments: {} });
  assert.ok(
    (await req("ranking", undefined, a.cookie)).data.history.some(
      (p: { kind: string }) => p.kind === "feed",
    ),
  );
  assert.deepEqual(await publishPersonal(a.id, true), { skipped: true });
  await req(
    "newspaper",
    {
      name: "Curation QA",
      slug,
      published: false,
      auto_publish: true,
      auto_cadence: "hourly",
    },
    a.cookie,
  );
  assert.deepEqual(await publishPersonal(a.id, true), { skipped: true });
  await pool().query(
    "UPDATE newspapers SET next_publish_at=now()-interval '1 minute' WHERE account_id=$1",
    [a.id],
  );
  assert.equal((await publishPersonal(a.id, true)).published, true);
  const publishKey = (
    await req(
      "mcp/tokens",
      { name: "QA publisher", scopes: ["read", "publish"], days: 7 },
      a.cookie,
    )
  ).data;
  const publisher = await connect(publishKey.token);
  assert.equal(
    (await publisher.callTool({ name: "publish_newspaper", arguments: {} }))
      .isError,
    undefined,
  );
  const connectionId = randomUUID();
  await pool().query(
    "INSERT INTO connections(id,account_id,name,url,topic,share_public) VALUES($1,$2,'QA source','https://example.invalid/feed','Tech',true)",
    [connectionId, a.id],
  );
  assert.equal(
    (
      await curator.callTool({
        name: "set_feed",
        arguments: {
          name: "Custom source desk",
          slug: "custom-source-desk",
          preferences: { ...defaults, sources: ["private:" + connectionId] },
        },
      })
    ).isError,
    undefined,
  );
  assert.equal(
    (
      await req(
        "preferences",
        { ...defaults, sources: ["private:" + connectionId] },
        b.cookie,
      )
    ).status,
    400,
  );
  const snap = (
    await pool().query("SELECT snapshot FROM newspapers WHERE account_id=$1", [
      a.id,
    ])
  ).rows[0].snapshot;
  const previousCount = snap.front.length;
  snap.front.push({
    ...snap.front[0],
    source_id: "private:" + connectionId,
    id: "qa-private-published",
  });
  await pool().query("UPDATE newspapers SET snapshot=$2 WHERE account_id=$1", [
    a.id,
    JSON.stringify(snap),
  ]);
  assert.equal(
    (
      await req(
        "connections/share",
        { id: connectionId, share: false },
        b.cookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await req(
        "connections/share",
        { id: connectionId, share: false },
        a.cookie,
      )
    ).status,
    200,
  );
  const pruned = (
    await pool().query("SELECT snapshot FROM newspapers WHERE account_id=$1", [
      a.id,
    ])
  ).rows[0].snapshot;
  assert.equal(pruned.front.length, previousCount);
  assert.ok(
    !pruned.front.some(
      (i: { source_id: string }) => i.source_id === "private:" + connectionId,
    ),
  );
  const before = (
    await pool().query(
      "SELECT snapshot,last_published_at FROM newspapers WHERE account_id=$1",
      [a.id],
    )
  ).rows[0];
  await pool().query("UPDATE accounts SET ranking=$2 WHERE id=$1", [
    a.id,
    JSON.stringify({ minScore: 100 }),
  ]);
  await assert.rejects(() => publishPersonal(a.id));
  const after = (
    await pool().query(
      "SELECT snapshot,last_published_at FROM newspapers WHERE account_id=$1",
      [a.id],
    )
  ).rows[0];
  assert.deepEqual(after, before);
  const keyList = (await req("mcp/tokens", undefined, a.cookie)).data.tokens;
  const id = keyList.find((k: { name: string }) => k.name === "QA curator").id;
  await req("mcp/tokens", { id }, b.cookie, "DELETE");
  assert.ok((await curator.listTools()).tools.length > 0);
  await req("mcp/tokens", { id }, a.cookie, "DELETE");
  await assert.rejects(() => curator.listTools());
  const noAuth = await fetch(base + "/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
  });
  assert.equal(noAuth.status, 401);
  console.log(
    "Passed: official MCP SDK handshake/tool listing, read/curate/publish scope boundaries, SSRF, cross-account isolation, grounded summaries, real ranking history, opt-in scheduled snapshots, last-edition retention, revocation. No messages sent.",
  );
} finally {
  for (const client of clients) await client.close().catch(() => {});
  if (accounts.length) {
    await pool().query(
      "DELETE FROM ranking_history WHERE owner_key=ANY($1::text[])",
      [accounts],
    );
    await pool().query("DELETE FROM accounts WHERE id=ANY($1::uuid[])", [
      accounts,
    ]);
  }
  await pool().end();
}
