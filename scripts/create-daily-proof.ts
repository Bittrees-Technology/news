/** Explicit acceptance account with no login identity, subscribers or delivery destinations. */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { pool } from "../lib/db";
import { createMcpToken } from "../lib/mcp";
import { defaults } from "../lib/model";
import { defaultRanking } from "../lib/scoring";
import { sources } from "../lib/catalog";
if (process.env.NEWS_CREATE_DAILY_PROOF !== "1")
  throw Error(
    "Set NEWS_CREATE_DAILY_PROOF=1 to create a live disposable MCP proof.",
  );
const account = randomUUID(),
  date = new Date().toISOString().slice(0, 10),
  events: any[] = [];
const client = new Client({
  name: "TBN newspaper acceptance",
  version: "1.0.0",
});
try {
  await pool().query("INSERT INTO accounts(id) VALUES($1)", [account]);
  const credential = await createMcpToken(account, {
    name: "One-run daily proof",
    scopes: ["read", "curate"],
    days: 7,
  });
  await client.connect(
    new StreamableHTTPClientTransport(
      new URL("https://news.bittrees.org/api/mcp"),
      {
        requestInit: {
          headers: { Authorization: "Bearer " + credential.token },
        },
      },
    ),
  );
  const advertised = await client.listTools();
  events.push({
    action: "initialize_and_list_tools",
    passed: true,
    tools: advertised.tools.map((t) => t.name),
  });
  async function tool(name: string, args: any = {}) {
    const r = await client.callTool({ name, arguments: args });
    assert.ok(!r.isError, JSON.stringify(r));
    const text = (r.content as any[]).find((c) => c.type === "text")?.text;
    events.push({ action: name, passed: true });
    return JSON.parse(text);
  }
  await tool("set_newspaper", {
    name: "The Bittrees Daily",
    slug: "daily-proof-" + account.slice(0, 8),
    description:
      "Technology, Ethereum, science and Portugal. A morning edition curated from linked sources.",
  });
  await tool("set_preferences", {
    ...defaults,
    topics: ["Tech", "AI", "Blockchain", "Science", "Portugal"],
    interests:
      "Ethereum open source artificial intelligence Portugal research governance",
    length: 12,
  });
  const source = sources.find((s) => s.id === "simon-willison")!;
  const added = await tool("add_source", {
    name: "Proof: " + source.name,
    url: source.url,
    topic: source.topic,
  });
  assert.ok(added.items > 0);
  await tool("refresh_source", { id: added.id });
  await tool("set_feed", {
    name: "Technology & Ethereum",
    slug: "technology-ethereum",
    preferences: {
      ...defaults,
      topics: ["Tech", "AI", "Blockchain"],
      length: 8,
    },
  });
  await tool("set_feed", {
    name: "Science & Portugal",
    slug: "science-portugal",
    preferences: { ...defaults, topics: ["Science", "Portugal"], length: 8 },
  });
  await tool("set_ranking", {
    ...defaultRanking,
    maxPerSource: 2,
    maxAgeDays: 3,
  });
  const settings = await tool("get_newspaper");
  assert.equal(settings.preferences.length, 12);
  const delivery = await tool("get_delivery");
  assert.equal(delivery.destinations.length, 0);
  let preview = await tool("generate_newspaper");
  assert.ok(preview.draft.front.length > 0);
  const items = preview.draft.front
    .filter(
      (i: any) =>
        !i.source_id.startsWith("private:") &&
        !(i.summary || i.excerpt).includes("Article URL:"),
    )
    .slice(0, 10);
  assert.ok(items.length >= 4);
  // Exercise editable form data without inventing reporting: reorder only, retaining sourced text.
  if (items.length > 2) [items[1], items[2]] = [items[2], items[1]];
  preview = await tool("edit_preview", {
    revision: preview.draft_revision,
    items: items.map((i: any) => ({
      id: i.id,
      title: i.title,
      summary: i.summary || i.excerpt,
    })),
  });
  const checked = await tool("get_preview");
  assert.equal(checked.draft_revision, preview.draft_revision);
  assert.ok(
    (
      await pool().query(
        "SELECT validated_at FROM mcp_tokens WHERE account_id=$1",
        [account],
      )
    ).rows[0].validated_at,
  );
  const output = {
    name: checked.name,
    description: checked.description,
    date: checked.draft.builtAt,
    items: checked.draft.front,
    proof: {
      date,
      transport: "MCP Streamable HTTP",
      endpoint: "https://news.bittrees.org/api/mcp",
      steps: events.map((e) => e.action),
      delivery: "Paused: no destination or subscription created",
      note: "Demonstration edition, not an automatic subscription. Story dates are preserved.",
    },
  };
  await mkdir("public/examples", { recursive: true });
  await writeFile(
    `public/examples/bittrees-daily-${date}.json`,
    JSON.stringify(output, null, 2),
  );
  await writeFile(
    "docs/newspaper-mcp-proof.json",
    JSON.stringify(
      {
        date,
        passed: true,
        events,
        articleCount: output.items.length,
        emailsSent: 0,
        fixtureRemoved: true,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: true,
      articleCount: output.items.length,
      steps: events.map((e) => e.action),
      example: `/examples/daily-${date}`,
      emailsSent: 0,
    }),
  );
} finally {
  await client.close().catch(() => {});
  await pool().query("DELETE FROM accounts WHERE id=$1", [account]);
  await pool().end();
}
