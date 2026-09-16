import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { Wallet } from "ethers";
import { pool } from "../lib/db";
import { defaults } from "../lib/model";
import { slugSchema } from "../lib/newspapers";
const base = process.env.TEST_ORIGIN || "http://127.0.0.1:3070";
const origin = process.env.APP_URL || base;
const accounts: string[] = [];
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
      "Content-Type": "application/json",
      Cookie: cookie,
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
  assert.equal(v.status, 200);
  const a = await req("account", undefined, v.cookie);
  accounts.push(a.data.account.id);
  return { id: a.data.account.id, cookie: v.cookie };
}
async function page(path: string, cookie = "") {
  const r = await fetch(base + path, { headers: { Cookie: cookie } });
  return { status: r.status, text: await r.text() };
}
try {
  const a = await login(),
    b = await login();
  const slug = "qa-paper-" + randomUUID().slice(0, 8);
  for (const value of [
    "account",
    "api",
    "../escape",
    "hello/world",
    "UPPER",
    "a--b",
  ])
    assert.equal(slugSchema.safeParse(value).success, false);
  assert.equal((await req("newspaper")).status, 401);
  assert.equal(
    (await req("newspaper", { name: "Reserved", slug: "account" }, a.cookie))
      .status,
    400,
  );
  const paper = {
    name: "Named QA Paper",
    slug,
    description: "QA front cover",
    published: false,
  };
  assert.equal((await req("newspaper", paper, a.cookie)).status, 200);
  assert.equal((await req("newspaper", paper, b.cookie)).status, 409);
  assert.equal((await page("/" + slug)).status, 404);
  assert.equal((await page("/" + slug, b.cookie)).status, 404);
  assert.ok((await page("/" + slug, a.cookie)).text.includes("Named QA Paper"));
  const id = createHash("sha256").update(randomUUID()).digest("hex");
  const secretTitle = "Private story " + randomUUID();
  await pool().query(
    "INSERT INTO items(id,source_id,topic,kind,title,url,excerpt,published_at,owner_id) VALUES($1,'private-fixture','Tech','article',$2,'https://example.invalid/private','Private evidence',now(),$3)",
    [id, secretTitle, a.id],
  );
  const source = (
    await pool().query(
      "SELECT source_id FROM items WHERE owner_id IS NULL ORDER BY published_at DESC LIMIT 1",
    )
  ).rows[0].source_id;
  await req("preferences", { ...defaults, sources: [source] }, a.cookie);
  assert.ok((await page("/" + slug, a.cookie)).text.includes(secretTitle));
  const feed = {
    name: "Custom science desk",
    slug: "science-desk",
    preferences: { ...defaults, topics: ["Tech"] },
  };
  assert.equal((await req("newspaper/feeds", feed, a.cookie)).status, 200);
  const settings = (await req("newspaper", undefined, a.cookie)).data;
  const f = settings.feeds[0];
  await req(
    "newspaper",
    { name: "Other QA Paper", slug: slug + "-other" },
    b.cookie,
  );
  assert.equal(
    (await req("newspaper/feeds", { ...feed, id: f.id }, b.cookie)).status,
    404,
  );
  assert.equal(
    (await req("newspaper/feeds", { id: f.id }, b.cookie, "DELETE")).status,
    404,
  );
  assert.equal((await page("/" + slug + "/science-desk")).status, 404);
  assert.ok(
    (await page("/" + slug + "/science-desk", a.cookie)).text.includes(
      "Custom science desk",
    ),
  );
  assert.equal(
    (await req("newspaper", { ...paper, published: true }, a.cookie)).status,
    200,
  );
  const pub = await page("/" + slug);
  assert.equal(pub.status, 200);
  assert.ok(pub.text.includes("Named QA Paper"));
  assert.ok(!pub.text.includes(secretTitle));
  assert.equal((await page("/" + slug + "/science-desk")).status, 200);
  assert.equal((await page("/" + slug + "/missing-feed")).status, 404);
  assert.equal(
    (await req("newspaper", { ...paper, published: false }, a.cookie)).status,
    200,
  );
  assert.equal((await page("/" + slug)).status, 404);
  assert.equal((await page("/" + slug + "/science-desk")).status, 404);
  const home = await page("/");
  assert.ok(!home.text.includes('href="/archive"'));
  assert.ok(!home.text.includes('href="/saved"'));
  for (const path of [
    "/account",
    "/account/topics",
    "/account/sources",
    "/account/delivery",
    "/account/settings",
  ])
    assert.equal((await page(path)).status, 200);
  console.log(
    "Passed: private by default, owner access, unique/reserved addresses, named feed routes, cross-account edit/delete rejection, publish/unpublish, private source exclusion, anonymous navigation, account routes. No messages sent.",
  );
} finally {
  if (accounts.length)
    await pool().query(
      "DELETE FROM ranking_history h WHERE h.owner_key=ANY($1::text[]) OR (h.owner_key='public' AND EXISTS(SELECT 1 FROM newspapers n WHERE n.account_id=ANY($1::uuid[]) AND (h.entity_id=n.slug OR left(h.entity_id,length(n.slug)+1)=n.slug||'/')))",
      [accounts],
    );
  await pool().query("DELETE FROM accounts WHERE id=ANY($1::uuid[])", [
    accounts,
  ]);
  await pool().end();
}
