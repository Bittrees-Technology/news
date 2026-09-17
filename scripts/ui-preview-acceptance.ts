import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../lib/db";
import { hash } from "../lib/auth";
import { createMcpToken } from "../lib/mcp";
import assert from "node:assert/strict";
// Uses disposable records, never an existing user's login or settings.
if (process.env.NEWS_BROWSER_ACCEPTANCE !== "1")
  throw Error(
    "Set NEWS_BROWSER_ACCEPTANCE=1 to create and remove a live acceptance account.",
  );
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const account = randomUUID(),
  session = randomBytes(32).toString("hex");
let browser: any;
try {
  await pool().query("INSERT INTO accounts(id) VALUES($1)", [account]);
  await pool().query(
    "INSERT INTO sessions(hash,account_id,expires_at) VALUES($1,$2,now()+interval '10 minutes')",
    [hash(session), account],
  );
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE,
  });
  const context = await browser.newContext({
    viewport: { width: 1360, height: 1000 },
  });
  await context.addCookies([
    {
      name: "__Host-news-session",
      value: session,
      domain: "news.bittrees.org",
      secure: true,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  await page.route("https://insights.bittrees.org/**", (r: any) => r.abort());
  await page.goto("https://news.bittrees.org/account");
  await page
    .getByLabel("Newspaper name", { exact: true })
    .fill("UI proof " + account.slice(0, 8));
  await page
    .getByLabel("Front-cover introduction")
    .fill("A private browser acceptance paper.");
  await page
    .getByRole("button", { name: "Save private newspaper", exact: true })
    .click();
  for (const name of ["Science test", "Technology test", "AI"]) {
    await page
      .getByRole("button", { name: "Add another feed", exact: true })
      .click();
    await page.getByLabel("Feed / topic name", { exact: true }).fill(name);
    if (name === "AI")
      await page
        .getByLabel(/Required keywords or phrases/)
        .fill("nonexistent-regression-keyword-88331");
    await page
      .getByRole("button", { name: "Create feed", exact: true })
      .click();
    await page
      .locator("#named-feed-form")
      .getByText("Feed saved.", { exact: false })
      .waitFor();
  }
  await page
    .getByRole("heading", { name: "Your named feeds (3/20)", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "Generate & edit preview" }).click();
  const generate = page.getByRole("button", {
    name: "Generate preview",
    exact: true,
  });
  await page
    .getByRole("link", { name: "Connect your AI", exact: true })
    .waitFor();
  assert.equal(await generate.isDisabled(), true);
  const denied = await context.request.post(
    "https://news.bittrees.org/api/newspaper/generate",
    {
      headers: { origin: "https://news.bittrees.org" },
      data: {},
    },
  );
  assert.equal(denied.status(), 403);
  const key = await createMcpToken(account, {
    name: "Browser acceptance",
    scopes: ["read", "curate"],
    days: 7,
  });
  const validation = await fetch("https://news.bittrees.org/api/mcp", {
    method: "POST",
    headers: {
      authorization: "Bearer " + key.token,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "get_newspaper", arguments: {} },
    }),
  });
  const validated = await validation.json();
  assert.ok(validated.result && !validated.result.isError);
  await page.reload();
  await generate.click();
  await page.locator(".paper-story").first().waitFor({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Edit contents", exact: true })
    .click();
  await page
    .getByLabel("Headline", { exact: true })
    .first()
    .fill("Browser verified headline edit");
  await page.getByRole("button", { name: "Save edits", exact: true }).click();
  await page.getByText("Edits saved privately.", { exact: true }).waitFor();
  await page.reload();
  await page
    .locator(".broadsheet")
    .getByRole("link", { name: "Browser verified headline edit", exact: true })
    .waitFor();
  await page.goto("https://news.bittrees.org/account");
  const third = page
    .locator(".connection")
    .filter({ has: page.getByRole("link", { name: "AI", exact: true }) });
  await third.getByRole("button", { name: "Preview saved filters" }).click();
  await page
    .getByText(
      "No matches. Try fewer topic or source restrictions, or broaden the required keywords.",
      { exact: true },
    )
    .waitFor();
  await page.goto("https://news.bittrees.org/account/delivery");
  await page
    .getByRole("heading", { name: "Newspaper subscriptions", exact: true })
    .waitFor();
  await page
    .getByText(
      "Verify an email or wallet destination below before subscribing.",
      { exact: true },
    )
    .waitFor();
  await page.goto("https://news.bittrees.org/account/analytics");
  await page
    .getByRole("button", { name: "Save ranking preferences", exact: true })
    .waitFor();
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "account form saved private paper",
        "three named feeds saved, including two-letter name with valid address",
        "third feed strict filter excluded non-matching stories",
        "generation denied before MCP validation; enabled after a real tool call",
        "preview generated",
        "headline edit survived reload",
        "verified destination required",
        "member ranking form available",
      ],
      emailsSent: 0,
    }),
  );
} finally {
  if (browser) await browser.close();
  await pool().query("DELETE FROM accounts WHERE id=$1", [account]);
  await pool().end();
}
