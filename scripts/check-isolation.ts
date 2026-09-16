import { Wallet } from "ethers";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { pool } from "../lib/db";
import { queueDigests } from "../lib/delivery";
const base = process.env.TEST_ORIGIN || "http://127.0.0.1:3070";
const origin = process.env.APP_URL || base;
async function req(
  path: string,
  body?: unknown,
  session = "",
  method = body ? "POST" : "GET",
) {
  const r = await fetch(base + "/api/" + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: session,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
async function login() {
  const wallet = Wallet.createRandom(),
    c = await req("auth/start", {
      kind: "wallet",
      value: wallet.address,
      purpose: "login",
    });
  assert.equal(c.status, 200);
  const proof = await wallet.signMessage(c.data.message);
  const result = await req("auth/verify", { id: c.data.id, proof }, c.cookie);
  assert.equal(result.status, 200);
  assert.equal(
    (await req("auth/verify", { id: c.data.id, proof }, c.cookie)).status,
    400,
  );
  const a = await req("account", undefined, result.cookie);
  return { id: a.data.account.id, cookie: result.cookie };
}
const accounts: { id: string; cookie: string }[] = [];
try {
  const a = await login(),
    b = await login();
  accounts.push(a, b);
  const itemId = "a".repeat(63) + "b";
  await pool().query(
    "INSERT INTO items(id,source_id,topic,kind,title,url,excerpt,published_at,owner_id) VALUES($1,'private:test','World','article','Private isolation fixture','https://example.org/isolation','Private to the disposable test account',now(),$2) ON CONFLICT DO NOTHING",
    [itemId, a.id],
  );
  assert.equal(
    (
      await req(
        "reading",
        { id: itemId, field: "saved", value: true },
        b.cookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await req(
        "reading",
        { id: itemId, field: "saved", value: true },
        a.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await req("saved", undefined, b.cookie)).data.some(
      (i: { id: string }) => i.id === itemId,
    ),
    false,
  );
  assert.equal(
    (
      await req(
        "connections",
        {
          name: "SSRF fixture",
          topic: "Tech",
          url: "https://127.0.0.1/private",
        },
        a.cookie,
      )
    ).status,
    503,
  );
  const dest = randomUUID();
  await pool().query(
    "INSERT INTO destinations(id,account_id,kind,value,enabled,unsubscribe_hash) VALUES($1,$2,'email','test-only@example.invalid',true,'fixture')",
    [dest, a.id],
  );
  assert.equal(
    (
      await req(
        "destinations",
        { id: dest, enabled: false, cadence: "daily" },
        b.cookie,
      )
    ).status,
    404,
  );
  const d = await queueDigests();
  const count1 = Number(
    (
      await pool().query(
        "SELECT count(*) FROM deliveries WHERE destination_id=$1",
        [dest],
      )
    ).rows[0].count,
  );
  await queueDigests();
  const count2 = Number(
    (
      await pool().query(
        "SELECT count(*) FROM deliveries WHERE destination_id=$1",
        [dest],
      )
    ).rows[0].count,
  );
  assert.equal(count1, count2);
  assert.equal(
    (
      await req(
        "destinations",
        { id: dest, enabled: false, cadence: "daily" },
        a.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    Number(
      (
        await pool().query(
          "SELECT count(*) FROM deliveries WHERE destination_id=$1 AND status='pending'",
          [dest],
        )
      ).rows[0].count,
    ),
    0,
  );
  console.log(
    "Passed: separate accounts, replay rejection, private-item isolation, SSRF blocking, destination ownership, idempotent queue, pause cancellation. No messages dispatched.",
  );
} finally {
  for (const a of accounts)
    await pool().query("DELETE FROM accounts WHERE id=$1", [a.id]);
  await pool().end();
}
