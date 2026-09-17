/** Disposable schema: no production account mutations and no email dispatch. */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { Pool } from "pg";
import { pool, schema } from "../lib/db";
import { mcp, createMcpToken } from "../lib/mcp";
import { sources, topics } from "../lib/catalog";
import { defaults } from "../lib/model";
import { defaultRanking } from "../lib/scoring";
import {
  queueSubscriptions,
  claimDelivery,
  unsubscribe,
  unsubscribeToken,
} from "../lib/delivery";
import { api } from "../lib/api";
import { generateDraft, generationReady } from "../lib/drafts";
const direct = new URL(process.env.DATABASE_URL!);
direct.hostname = direct.hostname.replace("-pooler", "");
const control = new Pool({ connectionString: direct.toString(), max: 1 });
const name = "news_acceptance_" + randomUUID().replaceAll("-", "");
let checks = 0;
try {
  await control.query(`CREATE SCHEMA ${name}`);
  (globalThis as any).newsPool = new Pool({
    connectionString: direct.toString(),
    options: `-c search_path=${name}`,
    max: 5,
  });
  await pool().query(
    schema.replace("REVOKE ALL ON SCHEMA public FROM PUBLIC;", ""),
  );
  const author = randomUUID(),
    subscriber = randomUUID(),
    stranger = randomUUID();
  for (const id of [author, subscriber, stranger])
    await pool().query("INSERT INTO accounts(id) VALUES($1)", [id]);
  const itemId = createHash("sha256").update(name).digest("hex");
  await pool().query(
    "INSERT INTO items(id,source_id,topic,kind,title,url,excerpt,published_at) VALUES($1,$2,$3,'article','Verified fixture headline','https://example.org/report','This fixture is source material used only to validate the newspaper workflow.',now()-interval '1 hour')",
    [itemId, sources[0].id, topics[0]],
  );
  await pool().query(
    "INSERT INTO sources(id,status,checked_at) VALUES($1,'healthy',now())",
    [sources[0].id],
  );
  assert.equal(await generationReady(author), false);
  await assert.rejects(generateDraft(author), /Connect and validate/);
  const ownerKey = (
    await createMcpToken(author, {
      name: "Acceptance owner",
      scopes: ["read", "curate", "publish"],
      days: 7,
    })
  ).token;
  const subscriberKey = (
    await createMcpToken(subscriber, {
      name: "Acceptance subscriptions",
      scopes: ["read", "delivery"],
      days: 7,
    })
  ).token;
  const readKey = (
    await createMcpToken(stranger, {
      name: "Read only",
      scopes: ["read"],
      days: 7,
    })
  ).token;
  async function rpc(key: string, method: string, params: any = {}) {
    const r = await mcp(
      new Request("https://news.bittrees.org/api/mcp", {
        method: "POST",
        headers: {
          authorization: "Bearer " + key,
          "content-type": "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++checks, method, params }),
      }),
    );
    return r.json();
  }
  async function tool(key: string, name: string, args: any = {}) {
    const r = await rpc(key, "tools/call", { name, arguments: args });
    assert.ok(!r.error && !r.result?.isError, JSON.stringify(r));
    return JSON.parse(r.result.content[0].text);
  }
  assert.ok(
    (await rpc(ownerKey, "initialize", { protocolVersion: "2025-11-25" }))
      .result.serverInfo,
  );
  const listed = (await rpc(ownerKey, "tools/list")).result.tools.map(
    (t: any) => t.name,
  );
  assert.ok(
    listed.includes("generate_newspaper") &&
      !listed.includes("set_subscription") &&
      !listed.includes("ranking_history"),
  );
  assert.equal(
    await generationReady(author),
    false,
    "Creating/listing a key does not validate it",
  );
  await assert.rejects(generateDraft(author), /Connect and validate/);
  await tool(ownerKey, "set_newspaper", {
    name: "Acceptance Daily",
    slug: "acceptance-daily",
    description: "A disposable integration test.",
  });
  await tool(ownerKey, "set_preferences", {
    ...defaults,
    topics: [topics[0]],
    sources: [sources[0].id],
    interests: "fixture source material",
  });
  await tool(ownerKey, "set_feed", {
    name: "Test desk",
    slug: "test-desk",
    preferences: defaults,
  });
  await tool(ownerKey, "set_feed", {
    name: "Second feed",
    slug: "second-feed",
    preferences: { ...defaults, requiredKeywords: "no matching fixture" },
  });
  await tool(ownerKey, "set_feed", {
    name: "Third feed",
    slug: "third-feed",
    preferences: { ...defaults, requiredKeywords: "Verified fixture" },
  });
  await tool(ownerKey, "set_ranking", defaultRanking);
  const settings = await tool(ownerKey, "get_newspaper");
  assert.equal(settings.preferences.interests, "fixture source material");
  assert.ok(settings.rankingProfile.weights);
  let draft = await tool(ownerKey, "generate_newspaper");
  assert.equal(draft.draft.front.length, 1);
  assert.equal(draft.draft.feeds.length, 3);
  assert.equal(
    draft.draft.feeds.find((f: any) => f.slug === "second-feed").items.length,
    0,
  );
  assert.equal(
    draft.draft.feeds.find((f: any) => f.slug === "third-feed").items.length,
    1,
  );

  assert.ok(!draft.draft.front[0].ranking);
  const stale = draft.draft_revision;
  draft = await tool(ownerKey, "edit_preview", {
    revision: stale,
    items: [
      {
        id: itemId,
        title: "Editor revised headline",
        summary: "An explicitly edited summary for acceptance testing.",
      },
    ],
  });
  assert.ok(draft.draft.front[0].user_edited);
  assert.equal(draft.draft.front[0].url, "https://example.org/report");
  assert.ok(
    (
      await rpc(ownerKey, "tools/call", {
        name: "edit_preview",
        arguments: {
          revision: stale,
          items: [{ id: itemId, title: "Stale", summary: "" }],
        },
      })
    ).result.isError,
  );
  assert.ok(
    (await rpc(readKey, "tools/call", { name: "edit_preview", arguments: {} }))
      .error,
  );
  await tool(ownerKey, "publish_preview", { revision: draft.draft_revision });
  assert.equal(
    (await pool().query("SELECT count(*)::int n FROM newspaper_editions"))
      .rows[0].n,
    1,
  );
  const dest = randomUUID(),
    foreignDest = randomUUID();
  for (const [id, account] of [
    [dest, subscriber],
    [foreignDest, stranger],
  ])
    await pool().query(
      "INSERT INTO destinations(id,account_id,kind,value,reachable,unsubscribe_hash) VALUES($1,$2,'email','fixture@example.invalid',true,'fixture')",
      [id, account],
    );
  // Only readiness is set; dispatch is never called.
  const previousKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "fixture-not-a-real-key";
  for (const [target, extra] of [
    ["main", {}],
    ["newspaper", { newspaperSlug: "acceptance-daily" }],
    ["feed", { newspaperSlug: "acceptance-daily", feedSlug: "test-desk" }],
  ] as const)
    await tool(subscriberKey, "set_subscription", {
      destinationId: dest,
      target,
      ...extra,
      cadence: "daily",
      enabled: true,
    });
  assert.ok(
    (
      await rpc(subscriberKey, "tools/call", {
        name: "set_subscription",
        arguments: {
          destinationId: foreignDest,
          target: "main",
          cadence: "daily",
          enabled: true,
        },
      })
    ).result.isError,
  );
  const e = (
    await pool().query("SELECT snapshot FROM newspapers WHERE account_id=$1", [
      author,
    ])
  ).rows[0].snapshot;
  await pool().query(
    "INSERT INTO editions(id,publish_at,published_at,brief,data) VALUES('fixture',now(),now(),'fixture',$1)",
    [JSON.stringify({ items: e.front })],
  );
  const at = new Date();
  at.setUTCHours(12, 0, 0, 0);
  assert.equal(await queueSubscriptions(at), 3);
  assert.equal(await queueSubscriptions(at), 0);
  const subs = (await tool(subscriberKey, "get_delivery")).subscriptions;
  assert.equal(subs.length, 3);
  const main = subs.find((s: any) => s.target === "main");
  await unsubscribe(main.id, unsubscribeToken(main.id));
  assert.equal(
    (
      await pool().query("SELECT enabled FROM news_subscriptions WHERE id=$1", [
        main.id,
      ])
    ).rows[0].enabled,
    false,
  );
  const walletJob = (
    await pool().query(
      "SELECT q.id FROM deliveries q JOIN news_subscriptions s ON s.id=q.subscription_id WHERE s.target='newspaper' LIMIT 1",
    )
  ).rows[0].id;
  await pool().query("UPDATE deliveries SET status='sending' WHERE id=$1", [
    walletJob,
  ]);
  await pool().query("UPDATE destinations SET kind='wallet' WHERE id=$1", [
    dest,
  ]);
  const oldWorkerSecret = process.env.WORKER_SECRET;
  process.env.WORKER_SECRET = "isolated-acceptance-worker-secret";
  async function validateWorker() {
    return (
      await api(
        new Request("https://news.bittrees.org/api/worker/validate", {
          method: "POST",
          headers: {
            authorization: "Bearer " + process.env.WORKER_SECRET,
            "content-type": "application/json",
          },
          body: JSON.stringify({ id: walletJob }),
        }),
      )
    ).json();
  }
  assert.equal((await validateWorker()).valid, true);
  await pool().query(
    "UPDATE newspapers SET published=false WHERE account_id=$1",
    [author],
  );
  assert.equal((await validateWorker()).valid, false);
  if (oldWorkerSecret === undefined) delete process.env.WORKER_SECRET;
  else process.env.WORKER_SECRET = oldWorkerSecret;
  await pool().query("UPDATE destinations SET kind='email' WHERE id=$1", [
    dest,
  ]);
  await pool().query("UPDATE deliveries SET status='pending' WHERE id=$1", [
    walletJob,
  ]);
  assert.equal(await claimDelivery("email"), null);
  assert.equal(await claimDelivery("email"), null);
  const paper = subs.find((s: any) => s.target === "newspaper");
  await tool(subscriberKey, "set_subscription", {
    id: paper.id,
    destinationId: dest,
    target: "newspaper",
    newspaperSlug: "acceptance-daily",
    cadence: "weekly",
    enabled: false,
  });
  assert.equal(
    (
      await pool().query("SELECT enabled FROM news_subscriptions WHERE id=$1", [
        paper.id,
      ])
    ).rows[0].enabled,
    false,
  );
  for (const cadence of ["weekly", "monthly"] as const) {
    await tool(subscriberKey, "set_subscription", {
      id: main.id,
      destinationId: dest,
      target: "main",
      cadence,
      enabled: true,
    });
    const date = new Date(at);
    if (cadence === "weekly") {
      while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
    } else {
      date.setUTCMonth(date.getUTCMonth() + 1, 1);
    }
    assert.equal(
      await queueSubscriptions(date),
      1,
      cadence + " digest should queue",
    );
    assert.equal(await queueSubscriptions(date), 0);
  }
  assert.ok(
    (await rpc(readKey, "tools/call", { name: "get_preview", arguments: {} }))
      .result.isError,
  );
  const privateSource = randomUUID(),
    privateItem = createHash("sha256")
      .update(name + "private")
      .digest("hex");
  await pool().query(
    "INSERT INTO connections(id,account_id,name,url,topic,status) VALUES($1,$2,'Private fixture','https://example.org/private-feed',$3,'healthy')",
    [privateSource, author, topics[0]],
  );
  await pool().query(
    "INSERT INTO items(id,source_id,topic,kind,title,url,excerpt,published_at,owner_id) VALUES($1,$2,$3,'article','Private fixture','https://example.org/private','Private unshared source excerpt for isolation testing.',now(),$4)",
    [privateItem, "private:" + privateSource, topics[0], author],
  );
  await tool(ownerKey, "set_preferences", defaults);
  const privateDraft = await tool(ownerKey, "generate_newspaper");
  assert.ok(privateDraft.draft.front.some((i: any) => i.id === privateItem));
  assert.ok(
    (
      await rpc(ownerKey, "tools/call", {
        name: "publish_preview",
        arguments: { revision: privateDraft.draft_revision },
      })
    ).result.isError,
  );
  const validated = (
    await pool().query(
      "SELECT validated_at FROM mcp_tokens WHERE account_id=$1",
      [author],
    )
  ).rows[0];
  assert.ok(validated.validated_at);
  await pool().query(
    "UPDATE mcp_tokens SET validated_at=now() WHERE account_id=$1",
    [stranger],
  );
  assert.equal(
    await generationReady(stranger),
    false,
    "Read-only validation cannot enable generation",
  );
  await pool().query(
    "UPDATE mcp_tokens SET expires_at=now()-interval '1 second' WHERE account_id=$1",
    [author],
  );
  assert.equal(await generationReady(author), false);
  await assert.rejects(generateDraft(author), /Connect and validate/);
  await pool().query("DELETE FROM mcp_tokens WHERE account_id=$1", [author]);
  assert.equal(await generationReady(author), false);
  await assert.rejects(generateDraft(author), /Connect and validate/);

  assert.equal(
    (
      await mcp(
        new Request("https://news.bittrees.org/api/mcp", {
          method: "POST",
          headers: {
            authorization: "Bearer " + ownerKey,
            "content-type": "application/json",
          },
          body: "{}",
        }),
      )
    ).status,
    401,
  );
  if (previousKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = previousKey;
  assert.equal(
    (await api(new Request("https://news.bittrees.org/api/newspaper/draft")))
      .status,
    401,
  );
  console.log(
    JSON.stringify({
      passed: true,
      mcpRequests: checks,
      checks: [
        "member-owned settings and ranking",
        "scope-filtered tool discovery",
        "source-grounded preview generation",
        "revision-safe edits",
        "publication snapshot",
        "main/newspaper/feed subscriptions",
        "foreign destination denied",
        "duplicate queue prevented",
        "unsubscribe",
        "private publication blocked at dispatch",
        "pause unavailable newspaper",
        "validated connection and revocation",
        "signed-out API denied",
      ],
      emailsSent: 0,
    }),
  );
} finally {
  if ((globalThis as any).newsPool) await pool().end();
  await control.query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
  await control.end();
  delete (globalThis as any).newsPool;
}
