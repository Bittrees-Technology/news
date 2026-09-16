import { test } from "node:test";
import assert from "node:assert/strict";
import { BrowserApi, SupersededRequest } from "../lib/browser-api";
const response = (value: unknown, status = 200) =>
  Response.json(value, { status });
test("source scores are discarded on logout and role changes", async () => {
  let role = "admin";
  const api = new BrowserApi(async (url) => response(String(url).endsWith("sources") ? {source_score:90} : {account:{id:"same",role}}));
  await api.request("account");
  await api.request("sources");
  role="member";
  api.invalidate(["account"]);
  await api.request("account");
  assert.equal(api.peek("sources"),undefined);
  await api.request("sources");
  api.reset();
  assert.equal(api.peek("sources"),undefined);
});
test("deduplicates simultaneous reads and reuses account data until expiry", async () => {
  let calls = 0,
    now = 0;
  const api = new BrowserApi(
    async () => {
      calls++;
      return response({ account: { id: "a" } });
    },
    undefined,
    () => now,
  );
  await Promise.all([api.request("account"), api.request("account")]);
  await api.request("account");
  assert.equal(calls, 1);
  now = 60_001;
  await api.request("account");
  assert.equal(calls, 2);
});
test("saving preferences invalidates dependent data but keeps public sources", async () => {
  let calls = 0;
  const api = new BrowserApi(async () => {
    calls++;
    return response({ account: { id: "a" } });
  });
  for (const path of ["account", "newspaper", "ranking", "sources"])
    await api.request(path);
  await api.request("preferences", { topics: ["Science"] });
  assert.equal(api.peek("account"), undefined);
  assert.equal(api.peek("newspaper"), undefined);
  assert.equal(api.peek("ranking"), undefined);
  await api.request("sources");
  assert.equal(calls, 5);
});
test("old in-flight responses cannot restore private data after sign-out", async () => {
  let finish!: (value: Response) => void;
  const api = new BrowserApi(
    async () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = api.request("account");
  api.reset();
  finish(response({ account: { id: "old" } }));
  await assert.rejects(pending, SupersededRequest);
  assert.equal(api.peek("account"), undefined);
});
test("a write supersedes an in-flight read", async () => {
  let finish!: (value: Response) => void;
  const api = new BrowserApi(async (_url, init) =>
    init?.method === "GET"
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : response({ ok: true }),
  );
  const pending = api.request("newspaper");
  await api.request("newspaper", { name: "New name" });
  finish(response({ newspaper: { name: "Old name" } }));
  await assert.rejects(pending, SupersededRequest);
  assert.equal(api.peek("newspaper"), undefined);
});
test("session identity changes discard prior account data", async () => {
  let now = 0,
    identity = "a";
  const api = new BrowserApi(
    async () => response({ account: { id: identity } }),
    undefined,
    () => now,
  );
  await api.request("account");
  identity = "b";
  now = 30_001;
  await api.request("session");
  assert.equal(api.peek("account"), undefined);
  assert.equal(api.peek("session").account.id, "b");
  assert.equal(api.getGeneration(), 1);
});
test("authorization failures clear private state; mutation secrets are never cached", async () => {
  let status = 200,
    changes = 0;
  const api = new BrowserApi(
    async () =>
      response(
        { account: { id: "a" }, token: "one-time", error: "Unauthorized" },
        status,
      ),
    () => changes++,
  );
  await api.request("account");
  await api.request("mcp/tokens", { name: "AI" });
  assert.equal(api.peek("mcp/tokens"), undefined);
  status = 401;
  await assert.rejects(api.request("ranking"), /Unauthorized/);
  assert.equal(api.peek("account"), undefined);
  assert.equal(changes, 1);
});
test("unsuccessful writes preserve valid cached data", async () => {
  const api = new BrowserApi(async (_url, init) =>
    init?.method === "GET"
      ? response({ account: { id: "a" } })
      : response({ error: "Invalid" }, 400),
  );
  await api.request("account");
  await assert.rejects(api.request("preferences", {}), /Invalid/);
  assert.equal(api.peek("account").account.id, "a");
});
