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
  const item = {
    id: "a".repeat(64),
    source_id: "private:" + randomUUID(),
    title: "Original",
    url: "https://example.org/private",
    excerpt: "Original source passage.",
    summary_kind: "excerpt",
  };
  const untouched = {
    ...item,
    id: "b".repeat(64),
    title: "Unchanged",
    excerpt: "x".repeat(10000),
  };
  const draft = {
    front: [item, untouched],
    feeds: [{ id: randomUUID(), items: [untouched] }],
    builtAt: "2026-09-23T00:00:00.000Z",
  };
  for (const id of [a, b]) {
    await pool().query("INSERT INTO accounts(id) VALUES($1)", [id]);
    await pool().query(
      "INSERT INTO newspapers(account_id,name,slug,draft,draft_revision,snapshot,published,auto_publish) VALUES($1,'Synthetic',$2,$3,4,$3,true,true)",
      [id, id, JSON.stringify(draft)],
    );
  }
  const key = async (id: string, scopes: string[]) =>
    (await createMcpToken(id, { name: "Synthetic", scopes, days: 7 })).token;
  const reader = await key(a, ["read"]),
    editor = await key(a, ["curate"]),
    other = await key(b, ["curate"]);
  const rpc = async (token: string, args: unknown) =>
    mcp(
      new Request("https://news.bittrees.org/api/mcp", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: randomUUID(),
          method: "tools/call",
          params: { name: "edit_preview_item", arguments: args },
        }),
      }),
    );
  const input = {
    revision: 4,
    itemId: item.id,
    title: "Reviewed headline",
    summary: "Owner-written summary, not a verified source passage.",
  };
  const row = async (id = a) =>
    (await pool().query("SELECT * FROM newspapers WHERE account_id=$1", [id]))
      .rows[0];
  const original = await row(),
    otherBefore = await row(b);
  assert.ok((await (await rpc(reader, input)).json()).error);
  assert.ok(
    (await (await rpc(editor, { ...input, accountId: b })).json()).result
      .isError,
  );
  assert.ok(
    (await (await rpc(editor, { ...input, itemId: "c".repeat(64) })).json())
      .result.isError,
  );
  assert.deepEqual(await row(), original);
  const simultaneous = await Promise.all([
    rpc(editor, input),
    rpc(editor, input),
  ]);
  const results = await Promise.all(simultaneous.map((r) => r.json()));
  assert.equal(results.filter((r) => !r.error && !r.result.isError).length, 1);
  const after = await row();
  assert.equal(after.draft_revision, 5);
  assert.deepEqual(after.draft.front[0], {
    ...item,
    original_title: item.title,
    title: input.title,
    summary: input.summary,
    user_edited: true,
    summary_kind: "user_edited",
  });
  assert.deepEqual(after.draft.front[1], untouched);
  assert.deepEqual(after.draft.feeds, draft.feeds);
  for (const field of Object.keys(original).filter(
    (k) => !["draft", "draft_revision"].includes(k),
  ))
    assert.deepEqual(after[field], original[field], field);
  assert.deepEqual(await row(b), otherBefore);
  assert.ok((await (await rpc(editor, input)).json()).result.isError);
  assert.ok(!(await (await rpc(other, input)).json()).result.isError); // Own newspaper only.
  await pool().query("DELETE FROM mcp_tokens WHERE account_id=$1", [a]);
  assert.equal((await rpc(editor, { ...input, revision: 5 })).status, 401);
  for (const table of [
    "newspaper_editions",
    "news_subscriptions",
    "deliveries",
    "public_job_claims",
    "public_job_events",
    "editor_jobs",
    "translations",
  ])
    assert.equal(
      Number((await pool().query(`SELECT count(*) n FROM ${table}`)).rows[0].n),
      0,
    );
  console.log(
    "Actual MCP reviewed story edit: curate-only, own account, strict arguments, one revision winner, exact text/provenance, unchanged long stories/feeds/published snapshot/schedules, revoked key denial and zero publication/delivery/processing effects pass.",
  );
} finally {
  await (globalThis as any).newsPool?.end();
  await control.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
  await control.end();
  delete (globalThis as any).newsPool;
}
