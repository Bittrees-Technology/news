import {
  withTranslations,
  claimTranslation,
  saveTranslation,
  translationResultSchema,
  translationStatus,
} from "./translation";
import { validatePreferences } from "./newspapers";
import { mcp, createMcpToken } from "./mcp";
import { rankingSchema } from "./scoring";
import {
  historyFor,
  accountCandidates,
  rankedItems,
  sourceScores,
} from "./ranking";
import {
  addPersonalSource,
  changeSourceSharing,
  publishPersonal,
  recordPersonalRankings,
  personalScheduler,
} from "./curation";
import { newspaperSettings, saveNewspaper, saveFeed } from "./newspapers";
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
    if (path === "mcp") return mcp(r);
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
      const scored = await sourceScores();
      return json({
        sources: sources.map((s) => ({
          ...s,
          ...statuses.find((d) => d.id === s.id),
          source_score: scored.scores[s.id] ?? null,
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
      if (path === "jobs/personal") return json(await personalScheduler());
      if (path === "jobs/prepare") return json(await prepare());
      if (path === "jobs/publish") return json(await publish());
      if (path === "jobs/deliver")
        return json({ ...(await queueDigests()), ...(await dispatchEmails()) });
      if (path === "jobs/dispatch") return json(await dispatchEmails());
    }
    if (path === "translations/status" && method === "POST") {
      checkOrigin(r);
      const b = z
        .object({ keys: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(100) })
        .parse(await body(r));
      return json(await translationStatus(b.keys));
    }
    if (path === "editor/translation/claim" && method === "POST") {
      authorizeBearer(r, "EDITOR_SECRET");
      return json(await claimTranslation());
    }
    if (path === "editor/translation/result" && method === "POST") {
      authorizeBearer(r, "EDITOR_SECRET");
      return json(
        await saveTranslation(translationResultSchema.parse(await body(r))),
      );
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
    if (path === "session" && method === "GET") {
      const a = await currentAccount(r, false);
      return json({
        account: a ? { id: a.id } : null,
        emailReady: emailReady(),
      });
    }
    if (path === "account" && method === "GET") {
      const a = await currentAccount(r, false);
      if (!a) return json({ account: null, emailReady: emailReady() });
      const [
        identities,
        destinations,
        connections,
        deliveries,
        walletAvailable,
      ] = await Promise.all([
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
        walletReady(),
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
        walletReady: walletAvailable,
      });
    }
    const a = await currentAccount(r);
    if (method !== "GET") checkOrigin(r);
    if (path === "ranking" && method === "GET")
      return json({
        profile: rankingSchema.parse(
          (
            await pool().query("SELECT ranking FROM accounts WHERE id=$1", [
              a!.id,
            ])
          ).rows[0].ranking,
        ),
        history: await historyFor(a!.id),
      });
    if (path === "ranking" && method === "POST") {
      const b = rankingSchema.parse(await body(r));
      await pool().query("UPDATE accounts SET ranking=$2 WHERE id=$1", [
        a!.id,
        JSON.stringify(b),
      ]);
      return json({ ok: true });
    }
    if (path === "ranking/refresh" && method === "POST") {
      await rateLimit("personal-refresh:" + a!.id, 5);
      await recordPersonalRankings(a!.id);
      return json({ ok: true });
    }
    if (path === "newspaper/publish" && method === "POST")
      return json(await publishPersonal(a!.id));
    if (path === "connections/share" && method === "POST") {
      const b = z
        .object({ id: z.uuid(), share: z.boolean() })
        .parse(await body(r));
      return json(await changeSourceSharing(a!.id, b.id, b.share));
    }
    if (path === "mcp/tokens" && method === "GET")
      return json({
        tokens: (
          await pool().query(
            "SELECT id,name,scopes,expires_at,last_used_at FROM mcp_tokens WHERE account_id=$1 ORDER BY created_at DESC",
            [a!.id],
          )
        ).rows,
        audit: (
          await pool().query(
            "SELECT action,status,created_at FROM curation_audit WHERE account_id=$1 ORDER BY created_at DESC LIMIT 30",
            [a!.id],
          )
        ).rows,
      });
    if (path === "mcp/tokens" && method === "POST")
      return json(await createMcpToken(a!.id, await body(r)));
    if (path === "mcp/tokens" && method === "DELETE") {
      const b = z.object({ id: z.uuid() }).parse(await body(r));
      await pool().query(
        "DELETE FROM mcp_tokens WHERE id=$1 AND account_id=$2",
        [b.id, a!.id],
      );
      return json({ ok: true });
    }
    if (path === "newspaper" && method === "GET")
      return json(await newspaperSettings(a!.id));
    if (path === "newspaper" && method === "POST")
      return json(await saveNewspaper(a!.id, await body(r)));
    if (path === "newspaper/feeds" && method === "POST")
      return json(await saveFeed(a!.id, await body(r)));
    if (path === "newspaper/feeds" && method === "DELETE") {
      const b = z.object({ id: z.uuid() }).parse(await body(r));
      const result = await pool().query(
        "DELETE FROM newspaper_feeds WHERE id=$1 AND account_id=$2 RETURNING id",
        [b.id, a!.id],
      );
      if (!result.rowCount) throw new HttpError(404, "Feed not found");
      return json({ ok: true });
    }
    if (path === "preferences" && method === "POST") {
      const p = preferencesSchema.parse(await body(r));
      await validatePreferences(p, a!.id);
      await pool().query("UPDATE accounts SET preferences=$2 WHERE id=$1", [
        a!.id,
        JSON.stringify(p),
      ]);
      return json({ ok: true });
    }
    if (path === "feed" && method === "GET") {
      const c = await accountCandidates(a!.id);
      return json(
        await withTranslations(
          await rankedItems(c.items, c.preferences, c.profile, a!.id),
        ),
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
        await withTranslations(
          (
            await pool().query(
              "SELECT i.* FROM reading r JOIN items i ON i.id=r.item_id WHERE r.account_id=$1 AND r.saved=true AND (i.owner_id IS NULL OR i.owner_id=$1) ORDER BY i.published_at DESC LIMIT 500",
              [a!.id],
            )
          ).rows,
        ),
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
      await rateLimit("feed:" + a!.id, 5);
      return json(await addPersonalSource(a!.id, await body(r)));
    }
    if (path === "connections" && method === "DELETE") {
      const b = z.object({ id: z.uuid() }).parse(await body(r));
      return json(await changeSourceSharing(a!.id, b.id, false, true));
    }
    if (path === "account" && method === "DELETE") {
      await pool().query("DELETE FROM ranking_history WHERE owner_key=$1", [
        a!.id,
      ]);
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
