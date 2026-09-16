import { walletReady } from "./wallet";
import { emailEvent } from "./webhook";
import {
  claimEditor,
  saveEditorResult,
  editorResultSchema,
} from "./editor-worker";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool, tx } from "./db";
import {
  HttpError,
  preferencesSchema,
  defaults,
  nextDelivery,
  selectItems,
  type Item,
} from "./model";
import {
  startChallenge,
  verifyChallenge,
  authorizeBearer,
  currentAccount,
  checkOrigin,
  hash,
  cookie,
  sessionName,
  setCookie,
  rateLimit,
} from "./auth";
import { sources, topics } from "./catalog";
import { emailReady } from "./mail";
import { safeFetch } from "./safe-fetch";
import { fetchSource, storeItems } from "./collect";
import { latestEdition, prepare, publish } from "./publish";
import {
  queueDigests,
  dispatchEmails,
  claimDelivery,
  unsubscribe,
} from "./delivery";
export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
async function body(r: Request) {
  const text = await r.text();
  if (text.length > 20000) throw new HttpError(413, "Request too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}
export async function api(r: Request) {
  try {
    const url = new URL(r.url),
      path = url.pathname.replace(/^\/api\//, ""),
      method = r.method;
    if (path === "email/events" && method === "POST")
      return json(await emailEvent(r));
    if (path === "health") {
      const edition = await latestEdition();
      return json({
        ok: true,
        publishedAt: edition?.published_at || null,
        sourceCount: sources.length,
        email: emailReady(),
        walletMessaging: await walletReady(),
        publicationTimes: ["07:57", "11:57", "19:57"],
        timezone: "UTC",
      });
    }
    if (path === "sources" && method === "GET") {
      const statuses = (await pool().query("SELECT * FROM sources")).rows;
      return json({
        sources: sources.map((s) => ({
          ...s,
          ...statuses.find((d) => d.id === s.id),
        })),
        topics,
      });
    }
    if (path === "edition" && method === "GET")
      return json(await latestEdition(url.searchParams.get("id") || undefined));
    if (path === "editions" && method === "GET")
      return json(
        (
          await pool().query(
            "SELECT id,publish_at,published_at FROM editions WHERE published_at IS NOT NULL ORDER BY publish_at DESC LIMIT 100",
          )
        ).rows,
      );
    if (path.startsWith("jobs/")) {
      authorizeBearer(r, "CRON_SECRET");
      if (path === "jobs/prepare") return json(await prepare());
      if (path === "jobs/publish") return json(await publish());
      if (path === "jobs/deliver")
        return json({ ...(await queueDigests()), ...(await dispatchEmails()) });
      if (path === "jobs/dispatch") return json(await dispatchEmails());
    }
    if (path === "editor/claim" && method === "POST") {
      authorizeBearer(r, "EDITOR_SECRET");
      return json(await claimEditor());
    }
    if (path === "editor/result" && method === "POST") {
      authorizeBearer(r, "EDITOR_SECRET");
      return json(
        await saveEditorResult(editorResultSchema.parse(await body(r))),
      );
    }
    if (path === "worker/validate" && method === "POST") {
      authorizeBearer(r, "WORKER_SECRET");
      const b = z.object({ id: z.uuid() }).parse(await body(r));
      return json({
        valid: !!(
          await pool().query(
            "SELECT 1 FROM deliveries q JOIN destinations d ON d.id=q.destination_id WHERE q.id=$1 AND q.status='sending' AND d.enabled=true AND d.reachable=true AND q.revision=d.revision",
            [b.id],
          )
        ).rowCount,
      });
    }
    if (path === "worker/claim" && method === "POST") {
      authorizeBearer(r, "WORKER_SECRET");
      return json(await claimDelivery("wallet"));
    }
    if (path === "worker/ack" && method === "POST") {
      authorizeBearer(r, "WORKER_SECRET");
      const b = z
        .object({
          id: z.uuid(),
          status: z.enum(["sent", "uncertain", "failed"]),
          providerId: z.string().max(200).optional(),
        })
        .parse(await body(r));
      await pool().query(
        "UPDATE deliveries SET status=$2,provider_id=$3,sent_at=CASE WHEN $2='sent' THEN now() ELSE NULL END WHERE id=$1 AND status='sending'",
        [b.id, b.status, b.providerId],
      );
      return json({ ok: true });
    }
    if (path === "worker/state" && method === "POST") {
      authorizeBearer(r, "WORKER_SECRET");
      const b = z
        .object({
          sender: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
          ready: z.boolean(),
        })
        .parse(await body(r));
      if (
        b.sender.toLowerCase() !==
        process.env.XMTP_SENDER_ADDRESS?.toLowerCase()
      )
        throw new HttpError(403, "Sender mismatch");
      await pool().query(
        "INSERT INTO worker_state(id,data) VALUES('xmtp',$1) ON CONFLICT(id) DO UPDATE SET updated_at=now(),data=$1",
        [JSON.stringify(b)],
      );
      return json({ ok: true });
    }
    if (path === "worker/destinations" && method === "GET") {
      authorizeBearer(r, "WORKER_SECRET");
      return json(
        (
          await pool().query(
            "SELECT id,value FROM destinations WHERE kind='wallet' LIMIT 1000",
          )
        ).rows,
      );
    }
    if (path === "worker/reachability" && method === "POST") {
      authorizeBearer(r, "WORKER_SECRET");
      const b = z
        .object({ id: z.uuid(), reachable: z.boolean() })
        .parse(await body(r));
      await pool().query(
        "UPDATE destinations SET reachable=$2 WHERE id=$1 AND kind='wallet'",
        [b.id, b.reachable],
      );
      return json({ ok: true });
    }
    if (path === "unsubscribe" && method === "POST") {
      const b = url.searchParams.size
        ? Object.fromEntries(url.searchParams)
        : await body(r);
      const d = z
        .object({ id: z.uuid(), token: z.string().length(64) })
        .parse(b);
      return json({ ok: await unsubscribe(d.id, d.token) });
    }
    if (path === "auth/start" && method === "POST") {
      const b = z
        .object({
          kind: z.enum(["email", "wallet"]),
          value: z.string().max(254),
          purpose: z.enum(["login", "link", "destination"]).default("login"),
          chainId: z.number().int().positive().max(100000000).optional(),
        })
        .parse(await body(r));
      const v = await startChallenge(r, b);
      return json(v.body, 200, { "Set-Cookie": v.cookie });
    }
    if (path === "auth/verify" && method === "POST") {
      const b = z
        .object({ id: z.uuid(), proof: z.string().min(1).max(2000) })
        .parse(await body(r));
      const v = await verifyChallenge(r, b);
      return json(v.body, 200, { "Set-Cookie": v.cookie });
    }
    if (path === "auth/logout" && method === "POST") {
      checkOrigin(r);
      await pool().query("DELETE FROM sessions WHERE hash=$1", [
        hash(cookie(r, sessionName)),
      ]);
      return json({ ok: true }, 200, {
        "Set-Cookie": setCookie(sessionName, "", 0),
      });
    }
    if (path === "account" && method === "GET") {
      const a = await currentAccount(r, false);
      if (!a) return json({ account: null, emailReady: emailReady() });
      const [identities, destinations, connections, deliveries] =
        await Promise.all([
          pool().query(
            "SELECT kind,value,verified_at FROM identities WHERE account_id=$1",
            [a.id],
          ),
          pool().query(
            "SELECT id,kind,value,enabled,cadence,reachable FROM destinations WHERE account_id=$1",
            [a.id],
          ),
          pool().query("SELECT * FROM connections WHERE account_id=$1", [a.id]),
          pool().query(
            "SELECT q.id,q.period,q.status,q.created_at,q.sent_at,q.error,d.kind,d.value FROM deliveries q JOIN destinations d ON d.id=q.destination_id WHERE q.account_id=$1 ORDER BY q.created_at DESC LIMIT 30",
            [a.id],
          ),
        ]);
      return json({
        account: { id: a.id },
        preferences: preferencesSchema.parse(a.preferences),
        identities: identities.rows,
        destinations: destinations.rows.map((d) => ({
          ...d,
          nextDelivery: d.enabled ? nextDelivery(d.cadence) : null,
        })),
        connections: connections.rows,
        deliveries: deliveries.rows,
        emailReady: emailReady(),
        walletReady: await walletReady(),
      });
    }
    const a = await currentAccount(r);
    if (method !== "GET") checkOrigin(r);
    if (path === "preferences" && method === "POST") {
      const p = preferencesSchema.parse(await body(r));
      if (
        p.topics.some((t) => !topics.includes(t)) ||
        p.sources.some((id) => !sources.some((s) => s.id === id))
      )
        throw new HttpError(400, "Unknown source or topic");
      await pool().query("UPDATE accounts SET preferences=$2 WHERE id=$1", [
        a!.id,
        JSON.stringify(p),
      ]);
      return json({ ok: true });
    }
    if (path === "feed" && method === "GET") {
      const rows = (
        await pool().query(
          "SELECT * FROM items WHERE (owner_id IS NULL OR owner_id=$1) AND published_at>now()-interval '14 days' ORDER BY published_at DESC LIMIT 1000",
          [a!.id],
        )
      ).rows;
      return json(
        selectItems(rows, preferencesSchema.parse(a!.preferences), 100),
      );
    }
    if (path === "reading" && method === "GET")
      return json(
        (
          await pool().query(
            "SELECT item_id,is_read,saved FROM reading WHERE account_id=$1",
            [a!.id],
          )
        ).rows,
      );
    if (path === "saved" && method === "GET")
      return json(
        (
          await pool().query(
            "SELECT i.* FROM reading r JOIN items i ON i.id=r.item_id WHERE r.account_id=$1 AND r.saved=true AND (i.owner_id IS NULL OR i.owner_id=$1) ORDER BY i.published_at DESC LIMIT 500",
            [a!.id],
          )
        ).rows,
      );
    if (path === "reading" && method === "POST") {
      const b = z
        .object({
          id: z.string().length(64),
          field: z.enum(["is_read", "saved"]),
          value: z.boolean(),
        })
        .parse(await body(r));
      const allowed = (
        await pool().query(
          "SELECT 1 FROM items WHERE id=$1 AND (owner_id IS NULL OR owner_id=$2)",
          [b.id, a!.id],
        )
      ).rowCount;
      if (!allowed) throw new HttpError(404, "Story not found");
      await pool().query(
        `INSERT INTO reading(account_id,item_id,${b.field}) VALUES($1,$2,$3) ON CONFLICT(account_id,item_id) DO UPDATE SET ${b.field}=$3`,
        [a!.id, b.id, b.value],
      );
      return json({ ok: true });
    }
    if (path === "destinations" && method === "POST") {
      const b = z
        .object({
          id: z.uuid(),
          enabled: z.boolean(),
          cadence: z.enum(["daily", "weekly", "monthly"]),
        })
        .parse(await body(r));
      await tx(async (d) => {
        const dest = (
          await d.query(
            "SELECT * FROM destinations WHERE id=$1 AND account_id=$2 FOR UPDATE",
            [b.id, a!.id],
          )
        ).rows[0];
        if (!dest) throw new HttpError(404, "Destination not found");
        if (
          b.enabled &&
          dest.kind === "wallet" &&
          (!(await walletReady()) || !dest.reachable)
        )
          throw new HttpError(
            409,
            "Wallet delivery awaits sender activation and an available XMTP inbox.",
          );
        if (b.enabled && dest.kind === "email" && !emailReady())
          throw new HttpError(409, "Email delivery is unavailable");
        await d.query(
          "UPDATE destinations SET enabled=$3,cadence=$4,revision=revision+1 WHERE id=$1 AND account_id=$2",
          [b.id, a!.id, b.enabled, b.cadence],
        );
        await d.query(
          "UPDATE deliveries SET status='cancelled' WHERE destination_id=$1 AND status='pending'",
          [b.id],
        );
      });
      return json({ ok: true });
    }
    if (path === "destinations" && method === "DELETE") {
      const b = z.object({ id: z.uuid() }).parse(await body(r));
      await pool().query(
        "DELETE FROM destinations WHERE id=$1 AND account_id=$2",
        [b.id, a!.id],
      );
      return json({ ok: true });
    }
    if (path === "connections" && method === "POST") {
      const b = z
        .object({
          name: z.string().min(1).max(100),
          url: z.url().max(2000),
          topic: z.string().max(60),
        })
        .parse(await body(r));
      if (!topics.includes(b.topic)) throw new HttpError(400, "Unknown topic");
      await rateLimit("feed:" + a!.id, 5);
      if (
        Number(
          (
            await pool().query(
              "SELECT count(*) FROM connections WHERE account_id=$1",
              [a!.id],
            )
          ).rows[0].count,
        ) >= 10
      )
        throw new HttpError(400, "You can add up to ten personal feeds.");
      const id = randomUUID();
      const items = await fetchSource(
        {
          id: "private:" + id,
          name: b.name,
          url: b.url,
          homepage: b.url,
          topic: b.topic,
          kind: "rss",
          type: "article",
        },
        a!.id,
      );
      await pool().query(
        "INSERT INTO connections(id,account_id,name,url,topic,status,checked_at) VALUES($1,$2,$3,$4,$5,'healthy',now())",
        [id, a!.id, b.name, b.url, b.topic],
      );
      await storeItems(items);
      return json({ ok: true });
    }
    if (path === "connections" && method === "DELETE") {
      const b = z.object({ id: z.uuid() }).parse(await body(r));
      await tx(async (d) => {
        await d.query("DELETE FROM connections WHERE id=$1 AND account_id=$2", [
          b.id,
          a!.id,
        ]);
        await d.query("DELETE FROM items WHERE source_id=$1 AND owner_id=$2", [
          "private:" + b.id,
          a!.id,
        ]);
      });
      return json({ ok: true });
    }
    if (path === "account" && method === "DELETE") {
      await pool().query("DELETE FROM accounts WHERE id=$1", [a!.id]);
      return json({ ok: true }, 200, {
        "Set-Cookie": setCookie(sessionName, "", 0),
      });
    }
    throw new HttpError(404, "Not found");
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: "Please check the supplied fields." }, 400);
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(
      "[news]",
      e instanceof Error ? e.message : "Unexpected error",
    );
    return json(
      { error: "This operation could not be completed. Please try again." },
      503,
    );
  }
}
