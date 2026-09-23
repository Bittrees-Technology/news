/** Actual MCP + disposable PostgreSQL. No live keys, publication, delivery or processing. */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { pool, schema } from "../lib/db";
import { mcp, createMcpToken } from "../lib/mcp";
import { changeSourceSharing } from "../lib/curation";
const target = new URL(process.env.NEWS_MCP_TEST_DATABASE_URL || "");
if (!["127.0.0.1", "localhost"].includes(target.hostname))
  throw Error("Use a disposable local PostgreSQL service.");
process.env.DATABASE_URL = target.toString();
const control = new Pool({ connectionString: target.toString(), max: 2 }),
  namespace = "news_publication_" + randomUUID().replaceAll("-", "");
const rpc = async (token: string, name: string, args: unknown = {}) => {
  const response = await mcp(
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
        params: { name, arguments: args },
      }),
    }),
  );
  const body = await response.json();
  return {
    status: response.status,
    body,
    ok: response.ok && !body.error && !body.result?.isError,
    data:
      body.result?.content?.[0]?.text && !body.result.isError
        ? JSON.parse(body.result.content[0].text)
        : null,
  };
};
const call = async (token: string, name: string, args: unknown = {}) => {
  const r = await rpc(token, name, args);
  assert.equal(r.ok, true, JSON.stringify(r.body));
  return r.data;
};
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
async function seed(shared = true) {
  const account = randomUUID(),
    source = randomUUID(),
    feed = randomUUID();
  await pool().query("INSERT INTO accounts(id) VALUES($1)", [account]);
  await pool().query(
    "INSERT INTO connections(id,account_id,name,url,topic,share_public) VALUES($1,$2,'Synthetic source','https://example.org/feed','science',$3)",
    [source, account, shared],
  );
  const item = {
    id: hash(account),
    source_id: "private:" + source,
    title: "Private source headline",
    url: "https://example.org/" + account,
    excerpt: "The source excerpt for this synthetic account.",
    summary: "Owner summary",
    summary_kind: "user_edited",
    user_edited: true,
    original_title: "Original headline",
    topic: "science",
    kind: "article",
    published_at: "2026-09-23T00:00:00.000Z",
    owner_id: account,
    ranking: { value: 99 },
    source_context: "PRIVATE_DIAGNOSTIC",
    unknown_private_field: "DROP_UNKNOWN_FIELD",
  };
  await pool().query(
    "INSERT INTO items(id,source_id,title,url,excerpt,topic,kind,published_at,owner_id) VALUES($1,$2,$3,$4,$5,'science','article',$6,$7)",
    [
      item.id,
      item.source_id,
      item.title,
      item.url,
      item.excerpt,
      item.published_at,
      account,
    ],
  );
  const draft = {
    front: [item],
    feeds: [
      {
        id: feed,
        name: "Synthetic feed",
        slug: "science",
        items: [item],
        private_config: "OMIT_FEED_CONFIG",
      },
    ],
    builtAt: "2026-09-23T00:00:00.000Z",
    profile: { private_settings: "OMIT_PROFILE" },
  };
  await pool().query(
    "INSERT INTO newspapers(account_id,name,slug,description,draft,draft_revision,snapshot,publication_version,published,auto_publish,auto_cadence,next_publish_at) VALUES($1,'Synthetic newspaper',$2,'Description',$3,4,NULL,8,false,true,'hourly',now()+interval '3 hours')",
    [account, account, JSON.stringify(draft)],
  );
  await pool().query(
    "INSERT INTO newspaper_feeds(id,account_id,name,slug) VALUES($1,$2,'Synthetic feed','science')",
    [feed, account],
  );
  const keys: any = {};
  for (const [name, scopes] of [
    ["reader", ["read"]],
    ["curator", ["curate"]],
    ["writer", ["publish"]],
  ] as const)
    keys[name] = (
      await createMcpToken(account, { name, scopes: [...scopes], days: 7 })
    ).token;
  const writerId = (await call(keys.writer, "get_connection")).credentialId;
  return {
    account,
    source,
    feed,
    item,
    draft,
    keys,
    writerId,
    row: async () =>
      (
        await pool().query("SELECT * FROM newspapers WHERE account_id=$1", [
          account,
        ])
      ).rows[0],
    count: async () =>
      Number(
        (
          await pool().query(
            "SELECT count(*) n FROM newspaper_editions WHERE account_id=$1",
            [account],
          )
        ).rows[0].n,
      ),
    review: () => call(keys.writer, "get_publication_review"),
  };
}
const intent = (r: any, operationId = randomUUID()) => ({
  operationId,
  revision: r.revision,
  publicationVersion: r.publicationVersion,
  reviewDigest: r.reviewDigest,
  confirmed: true,
  audience: "public",
});
async function waitBlocked(locker: PoolClient) {
  const pid = Number(
    (await locker.query("SELECT pg_backend_pid() id")).rows[0].id,
  );
  for (let n = 0; n < 100; n++) {
    if (
      (
        await control.query(
          "SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid)) AND pid<>pg_backend_pid()",
          [pid],
        )
      ).rowCount
    )
      return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error(
    "Expected a live blocked database request before releasing the test lock.",
  );
}
try {
  await control.query(`CREATE SCHEMA ${namespace}`);
  (globalThis as any).newsPool = new Pool({
    connectionString: target.toString(),
    options: `-c search_path=${namespace}`,
    max: 8,
  });
  await pool().query(
    schema.replace("REVOKE ALL ON SCHEMA public FROM PUBLIC;", ""),
  );
  // Separate scope and confirmation; exact public payload, private metadata omission, concurrency and replay.
  const a = await seed(),
    b = await seed();
  const before = await a.row(),
    other = await b.row();
  const readOnly = await call(a.keys.reader, "get_publication_review");
  assert.equal(readOnly.eligibility.eligible, true);
  const review = await a.review(),
    request = intent(review);
  assert.equal(JSON.stringify(review).includes("PRIVATE_DIAGNOSTIC"), false);
  assert.equal(JSON.stringify(review).includes("DROP_UNKNOWN_FIELD"), false);
  assert.equal(JSON.stringify(review).includes("OMIT_PROFILE"), false);
  assert.equal(JSON.stringify(review).includes("OMIT_FEED_CONFIG"), false);
  assert.notEqual(readOnly.reviewDigest, review.reviewDigest); // Bound to the actual source credential.
  for (const token of [a.keys.reader, a.keys.curator])
    assert.equal(
      (await rpc(token, "publish_reviewed_preview", request)).ok,
      false,
    );
  for (const change of [
    { confirmed: false },
    { audience: "private" },
    { accountId: b.account },
    { snapshot: {} },
    { reviewDigest: "0".repeat(64) },
  ])
    assert.equal(
      (
        await rpc(a.keys.writer, "publish_reviewed_preview", {
          ...request,
          ...change,
        })
      ).ok,
      false,
    );
  assert.equal(await a.count(), 0);
  assert.deepEqual(await a.row(), before);
  const concurrent = await Promise.all([
    call(a.keys.writer, "publish_reviewed_preview", request),
    call(a.keys.writer, "publish_reviewed_preview", request),
  ]);
  assert.deepEqual(concurrent[0], concurrent[1]);
  assert.equal(await a.count(), 1);
  const receipt = concurrent[0],
    after = await a.row();
  assert.equal(receipt.historical, true);
  assert.equal(after.publication_version, 9);
  assert.deepEqual(after.snapshot, review.content.snapshot);
  assert.equal(after.snapshot._companionPublication, undefined);
  assert.equal(after.draft_revision, 4);
  assert.deepEqual(after.draft, before.draft);
  for (const k of Object.keys(before).filter(
    (k) =>
      ![
        "snapshot",
        "published",
        "last_published_at",
        "publication_version",
        "publish_error",
      ].includes(k),
  ))
    assert.deepEqual(after[k], before[k], k);
  assert.deepEqual(await b.row(), other);
  assert.equal(
    (
      await call(b.keys.reader, "get_publication_receipt", {
        operationId: request.operationId,
      })
    ).receipt,
    null,
  );
  assert.deepEqual(
    (
      await call(a.keys.reader, "get_publication_receipt", {
        operationId: request.operationId,
      })
    ).receipt,
    receipt,
  );
  assert.equal(
    (
      await rpc(a.keys.writer, "publish_reviewed_preview", {
        ...request,
        reviewDigest: "f".repeat(64),
      })
    ).ok,
    false,
  );
  assert.equal(await a.count(), 1);
  // Hiding source material after publication must never be reversed by replaying a successful operation.
  await changeSourceSharing(a.account, a.source, false);
  const hidden = await a.row();
  assert.equal(hidden.snapshot.front.length, 0);
  assert.deepEqual(
    await call(a.keys.writer, "publish_reviewed_preview", request),
    receipt,
  );
  assert.deepEqual(await a.row(), hidden);
  assert.equal(await a.count(), 1);
  // Foreign operation-ID collision rolls back without revealing or replacing its receipt.
  const collision = intent(await b.review(), request.operationId);
  assert.equal(
    (await rpc(b.keys.writer, "publish_reviewed_preview", collision)).ok,
    false,
  );
  assert.deepEqual(await b.row(), other);
  assert.equal(await b.count(), 0);
  // Each relevant mutation invalidates a previously reviewed intent.
  for (const kind of [
    "draft",
    "same-revision-text",
    "name",
    "feed",
    "version",
    "scheduled-snapshot",
    "sharing",
    "excerpt",
    "url",
    "scopes",
    "deleted-item",
  ] as const) {
    const f = await seed(),
      r = await f.review(),
      i = intent(r);
    if (kind === "draft")
      await pool().query(
        "UPDATE newspapers SET draft_revision=draft_revision+1 WHERE account_id=$1",
        [f.account],
      );
    if (kind === "same-revision-text")
      await pool().query(
        "UPDATE newspapers SET draft=jsonb_set(draft,'{front,0,title}','\"Changed\"') WHERE account_id=$1",
        [f.account],
      );
    if (kind === "name")
      await pool().query(
        "UPDATE newspapers SET name='Renamed' WHERE account_id=$1",
        [f.account],
      );
    if (kind === "feed")
      await pool().query(
        "UPDATE newspaper_feeds SET name='Renamed feed' WHERE account_id=$1",
        [f.account],
      );
    if (kind === "version")
      await pool().query(
        "UPDATE newspapers SET publication_version=publication_version+1 WHERE account_id=$1",
        [f.account],
      );
    if (kind === "scheduled-snapshot")
      await pool().query(
        "UPDATE newspapers SET snapshot=draft,published=true,last_published_at=now() WHERE account_id=$1",
        [f.account],
      );
    if (kind === "sharing")
      await changeSourceSharing(f.account, f.source, false);
    if (kind === "excerpt")
      await pool().query(
        "UPDATE items SET excerpt='Changed source evidence' WHERE id=$1",
        [f.item.id],
      );
    if (kind === "url")
      await pool().query(
        "UPDATE items SET url='https://example.org/changed' WHERE id=$1",
        [f.item.id],
      );
    if (kind === "scopes")
      await pool().query(
        "UPDATE mcp_tokens SET scopes=ARRAY['read','publish','delivery'] WHERE id=$1",
        [f.writerId],
      );
    if (kind === "deleted-item")
      await pool().query("DELETE FROM items WHERE id=$1", [f.item.id]);
    const state = await f.row();
    assert.equal(
      (await rpc(f.keys.writer, "publish_reviewed_preview", i)).ok,
      false,
      kind,
    );
    assert.equal(await f.count(), 0, kind);
    assert.deepEqual(await f.row(), state, kind);
  }
  const privateOnly = await seed(false),
    blocked = await privateOnly.review();
  assert.equal(blocked.eligibility.eligible, false);
  assert.deepEqual(blocked.eligibility.blockedItemIds, [privateOnly.item.id]);
  assert.equal(
    (
      await rpc(
        privateOnly.keys.writer,
        "publish_reviewed_preview",
        intent(blocked),
      )
    ).ok,
    false,
  );
  assert.equal(await privateOnly.count(), 0);
  // A copied foreign private story never becomes publishable through an own-account review.
  const foreign = await seed();
  await pool().query(
    "UPDATE newspapers SET draft=jsonb_set(draft,'{front}',$2) WHERE account_id=$1",
    [foreign.account, JSON.stringify([b.item])],
  );
  const foreignReview = await foreign.review();
  assert.equal(foreignReview.eligibility.eligible, false);
  assert.ok(foreignReview.eligibility.blockedItemIds.includes(b.item.id));
  assert.equal(
    (
      await rpc(
        foreign.keys.writer,
        "publish_reviewed_preview",
        intent(foreignReview),
      )
    ).ok,
    false,
  );
  assert.equal(await foreign.count(), 0);
  // Removing only publication permission retains read access but cannot reuse its old review.
  const downgraded = await seed(),
    downgradedIntent = intent(await downgraded.review());
  await pool().query("UPDATE mcp_tokens SET scopes=ARRAY['read'] WHERE id=$1", [
    downgraded.writerId,
  ]);
  assert.equal(
    (
      await rpc(
        downgraded.keys.writer,
        "publish_reviewed_preview",
        downgradedIntent,
      )
    ).ok,
    false,
  );
  assert.equal(await downgraded.count(), 0);
  // Revocation committed while the MCP request waits must defeat the stale outer authentication result.
  const revoked = await seed(),
    revokedIntent = intent(await revoked.review()),
    lock = await pool().connect();
  try {
    await lock.query("BEGIN");
    await lock.query("DELETE FROM mcp_tokens WHERE id=$1", [revoked.writerId]);
    const pending = rpc(
      revoked.keys.writer,
      "publish_reviewed_preview",
      revokedIntent,
    );
    await waitBlocked(lock);
    await lock.query("COMMIT");
    assert.equal((await pending).ok, false);
    assert.equal(await revoked.count(), 0);
  } finally {
    await lock.query("ROLLBACK");
    lock.release();
  }
  // Sharing revocation has the same lock order and wins before publication eligibility is checked.
  const sharing = await seed(),
    sharingIntent = intent(await sharing.review()),
    shareLock = await pool().connect();
  try {
    await shareLock.query("BEGIN");
    await shareLock.query(
      "UPDATE connections SET share_public=false WHERE id=$1",
      [sharing.source],
    );
    const pending = rpc(
      sharing.keys.writer,
      "publish_reviewed_preview",
      sharingIntent,
    );
    await waitBlocked(shareLock);
    await shareLock.query("COMMIT");
    assert.equal((await pending).ok, false);
    assert.equal(await sharing.count(), 0);
  } finally {
    await shareLock.query("ROLLBACK");
    shareLock.release();
  }
  // A key that expires while waiting for the newspaper lock cannot commit publication.
  const expiring = await seed();
  await pool().query(
    "UPDATE mcp_tokens SET expires_at=clock_timestamp()+interval '1.5 seconds' WHERE id=$1",
    [expiring.writerId],
  );
  const expiresIntent = intent(await expiring.review()),
    expiryLock = await pool().connect();
  try {
    await expiryLock.query("BEGIN");
    await expiryLock.query(
      "SELECT account_id FROM newspapers WHERE account_id=$1 FOR UPDATE",
      [expiring.account],
    );
    const pending = rpc(
      expiring.keys.writer,
      "publish_reviewed_preview",
      expiresIntent,
    );
    await waitBlocked(expiryLock);
    while (
      (
        await control.query(
          `SELECT expires_at>clock_timestamp() active FROM ${namespace}.mcp_tokens WHERE id=$1`,
          [expiring.writerId],
        )
      ).rows[0].active
    )
      await new Promise((r) => setTimeout(r, 25));
    await expiryLock.query("COMMIT");
    assert.equal((await pending).ok, false);
    assert.equal(await expiring.count(), 0);
  } finally {
    await expiryLock.query("ROLLBACK");
    expiryLock.release();
  }
  // Failure between edition insertion and newspaper update rolls both back.
  const rollback = await seed(),
    rollbackIntent = intent(await rollback.review()),
    rollbackBefore = await rollback.row();
  await pool().query(
    `CREATE FUNCTION reject_publication() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.account_id='${rollback.account}'::uuid AND NEW.published THEN RAISE EXCEPTION 'synthetic update failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_publication BEFORE UPDATE ON newspapers FOR EACH ROW EXECUTE FUNCTION reject_publication()`,
  );
  assert.equal(
    (
      await rpc(
        rollback.keys.writer,
        "publish_reviewed_preview",
        rollbackIntent,
      )
    ).ok,
    false,
  );
  assert.equal(await rollback.count(), 0);
  assert.deepEqual(await rollback.row(), rollbackBefore);
  await pool().query(
    "DROP TRIGGER reject_publication ON newspapers; DROP FUNCTION reject_publication()",
  );
  // A real post-commit audit failure loses the response but leaves a reconcilable durable receipt.
  const uncertain = await seed(),
    uncertainIntent = intent(await uncertain.review());
  await pool().query(
    "CREATE FUNCTION lose_publication_response() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='publish_reviewed_preview' THEN RAISE EXCEPTION 'synthetic post-commit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER lose_publication_response BEFORE INSERT ON curation_audit FOR EACH ROW EXECUTE FUNCTION lose_publication_response()",
  );
  const lost = await rpc(
    uncertain.keys.writer,
    "publish_reviewed_preview",
    uncertainIntent,
  );
  assert.equal(lost.ok, false);
  assert.equal(await uncertain.count(), 1);
  const resolved = (
    await call(uncertain.keys.reader, "get_publication_receipt", {
      operationId: uncertainIntent.operationId,
    })
  ).receipt;
  assert.equal(resolved.reviewDigest, uncertainIntent.reviewDigest);
  await pool().query(
    "DROP TRIGGER lose_publication_response ON curation_audit; DROP FUNCTION lose_publication_response()",
  );
  assert.deepEqual(
    await call(
      uncertain.keys.writer,
      "publish_reviewed_preview",
      uncertainIntent,
    ),
    resolved,
  );
  assert.equal(await uncertain.count(), 1);
  await pool().query("DELETE FROM mcp_tokens WHERE id=$1", [
    uncertain.writerId,
  ]);
  assert.equal(
    (
      await rpc(uncertain.keys.writer, "get_publication_receipt", {
        operationId: uncertainIntent.operationId,
      })
    ).status,
    401,
  );
  for (const table of [
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
    "Actual reviewed publication: exact public payload, scope/account separation, private/removed/changed source denial, stale content/navigation/authority denial, concurrent single effect, stable historical receipts, no resurrection after sharing withdrawal, real lock-wait revocation/expiry, atomic rollback and post-commit response-loss reconciliation pass. Schedules unchanged; no deliveries, subscriptions, model or processing jobs.",
  );
} finally {
  await (globalThis as any).newsPool?.end();
  await control.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`);
  await control.end();
  delete (globalThis as any).newsPool;
}
