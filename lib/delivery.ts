import { newspaperEmail, compactSummary, digestArticles } from "./newspaper-email";
import { subscriptionContent, subscriptionStillAllowed } from "./subscriptions";
import { rankingSchema } from "./scoring";
import { rankedItems } from "./ranking";
import { randomUUID, createHmac } from "node:crypto";
import { pool, tx } from "./db";
import { periodFor, preferencesSchema, selectItems, type Item } from "./model";
import { sendEmail } from "./mail";
import { hash } from "./auth";
export function unsubscribeToken(id: string) {
  return createHmac("sha256", process.env.AUTH_SECRET!)
    .update("unsubscribe:" + id)
    .digest("hex");
}
export async function queueDigests(now = new Date()) {
  const dests = (
    await pool().query(
      "SELECT d.*,a.preferences,a.ranking FROM destinations d JOIN accounts a ON a.id=d.account_id WHERE d.enabled=true AND (d.kind='email' OR d.reachable=true) AND NOT EXISTS(SELECT 1 FROM news_subscriptions s WHERE s.destination_id=d.id) LIMIT 1000",
    )
  ).rows;
  let queued = 0;
  for (const d of dests) {
    const period = periodFor(d.cadence, now);
    if (!period) continue;
    const all = (
      await pool().query(
        "SELECT i.*,c.summary AS curated_summary FROM items i LEFT JOIN article_curation c ON c.item_id=i.id AND c.account_id=$1 WHERE (i.owner_id IS NULL OR i.owner_id=$1) AND COALESCE(c.excluded,false)=false AND i.published_at>=$2 AND i.published_at<$3 ORDER BY i.published_at DESC LIMIT 2000",
        [d.account_id, period.start, period.end],
      )
    ).rows.map(({ curated_summary, ...i }) =>
      curated_summary
        ? { ...i, summary: curated_summary, summary_kind: "extractive" }
        : i,
    ) as Item[];
    const prefs = preferencesSchema.parse(d.preferences);
    const selected = await rankedItems(
      d.kind === "email" ? all.filter(i => i.kind === "article") : all,
      prefs,
      rankingSchema.parse(d.ranking),
      d.account_id,
      d.kind === "email" ? 3 : prefs.length,
    );
    if (!selected.length) continue;
    const unsubscribe = `${process.env.APP_URL}/unsubscribe?id=${d.id}&token=${unsubscribeToken(d.id)}`;
    const date = period.end.toISOString().slice(0, 10);
    const readMore = `${process.env.APP_URL}/`;
    const text =
      `TBN · The Bittrees News — ${d.cadence} edition\n${period.start.toISOString().slice(0, 10)} to ${date} (UTC)\n\n` +
      selected
        .map(
          (i) =>
            `${i.title}\n${d.kind === "email" ? compactSummary(i.summary || i.excerpt) : i.summary || i.excerpt}\n${i.url}`,
        )
        .join("\n\n") +
      `\n\nRead more: ${readMore}\nManage your sources: ${process.env.APP_URL}/account\nPause these deliveries: ${unsubscribe}`;
    const r = await pool().query(
      "INSERT INTO deliveries(id,account_id,destination_id,revision,period,payload) SELECT $1,$2,id,revision,$3,$4 FROM destinations WHERE id=$5 AND enabled=true AND revision=$6 ON CONFLICT(destination_id,period) DO NOTHING RETURNING id",
      [
        randomUUID(),
        d.account_id,
        period.key,
        JSON.stringify({
          subject: `TBN · ${d.cadence} · ${date}`,
          ...(d.kind === "email" ? {html: newspaperEmail("The Bittrees News", selected, date, unsubscribe, readMore)} : {}),
          text,
          unsubscribe,
          itemIds: selected.map((i) => i.id),
        }),
        d.id,
        d.revision,
      ],
    );
    queued += r.rowCount || 0;
  }
  queued += await queueSubscriptions(now);
  return { queued };
}
export async function queueSubscriptions(now = new Date()) {
  const subscriptions = (
    await pool().query(
      "SELECT s.*,d.kind,a.preferences,a.ranking,d.revision AS destination_revision FROM news_subscriptions s JOIN destinations d ON d.id=s.destination_id JOIN accounts a ON a.id=s.account_id WHERE s.enabled=true AND d.enabled=true AND (d.kind='email' OR d.reachable=true) ORDER BY s.created_at LIMIT 1000",
    )
  ).rows;
  let queued = 0;
  for (const s of subscriptions) {
    const edition = await subscriptionContent(s, now);
    if (!edition?.items.length) continue;
    const email = s.kind === "email";
    const prefs = preferencesSchema.parse(s.preferences);
    const profile = rankingSchema.parse(s.ranking);
    const selected = email ? digestArticles(edition.items, prefs, profile, now) : edition.items;
    if (!selected.length) continue;
    const readMore = new URL(edition.readMorePath, process.env.APP_URL).href;
    const unsubscribe = `${process.env.APP_URL}/unsubscribe?id=${s.id}&token=${unsubscribeToken(s.id)}`;
    const text =
      `${edition.name} — ${s.cadence} edition\n${edition.period.start.toISOString().slice(0, 10)} to ${edition.period.end.toISOString().slice(0, 10)} (UTC)\n\n` +
      selected
        .map(
          (i) =>
            `${i.title}\n${email ? compactSummary(i.summary || i.excerpt) : i.summary || i.excerpt}\n${i.user_edited ? "Edited by the newspaper owner.\n" : ""}${i.url}`,
        )
        .join("\n\n") +
      `\n\nRead more: ${readMore}\nManage subscriptions: ${process.env.APP_URL}/account/delivery\nPause this subscription: ${unsubscribe}`;
    const result = await pool().query(
      "INSERT INTO deliveries(id,account_id,destination_id,revision,period,payload,subscription_id,subscription_revision) SELECT gen_random_uuid(),s.account_id,d.id,d.revision,$3,$4,s.id,s.revision FROM news_subscriptions s JOIN destinations d ON d.id=s.destination_id WHERE s.id=$1 AND s.revision=$2 AND s.enabled=true AND d.enabled=true ON CONFLICT(destination_id,period) DO NOTHING RETURNING id",
      [
        s.id,
        s.revision,
        `subscription:${s.id}:${edition.period.key}`,
        JSON.stringify({
          subject: `${edition.name} · ${s.cadence} · ${edition.period.end.toISOString().slice(0, 10)}`,
          text,
          unsubscribe,
          itemIds: selected.map((i) => i.id),
          html: newspaperEmail(
            edition.name,
            selected,
            edition.period.end.toISOString().slice(0, 10),
            unsubscribe,
            readMore,
          ),
        }),
      ],
    );
    queued += result.rowCount || 0;
  }
  return queued;
}
export async function deliveryAuthorized(q: any, db: any = pool()) {
  if (!q.subscription_id) return true;
  if (
    !(await subscriptionStillAllowed(
      q.subscription_id,
      q.subscription_revision,
      db,
    ))
  )
    return false;
  const ids: string[] = q.payload.itemIds || [];
  const n = (
    await db.query(
      "SELECT count(*)::int n FROM items i WHERE i.id=ANY($1::text[]) AND (i.owner_id IS NULL OR i.owner_id=$2 OR EXISTS(SELECT 1 FROM connections c WHERE c.account_id=i.owner_id AND 'private:'||c.id::text=i.source_id AND c.share_public=true))",
      [ids, q.account_id],
    )
  ).rows[0].n;
  return n === new Set(ids).size;
}
export async function claimDelivery(kind: string) {
  return tx(async (db) => {
    const r = await db.query(
      "SELECT q.*,d.value,d.kind,d.enabled,d.revision AS current_revision FROM deliveries q JOIN destinations d ON d.id=q.destination_id WHERE q.status='pending' AND d.kind=$1 ORDER BY q.created_at FOR UPDATE OF q,d SKIP LOCKED LIMIT 1",
      [kind],
    );
    const q = r.rows[0];
    if (!q) return null;
    const suppressed =
      q.kind === "email" &&
      (await db.query("SELECT 1 FROM suppressions WHERE value=$1", [q.value]))
        .rowCount;
    if (
      !q.enabled ||
      q.revision !== q.current_revision ||
      suppressed ||
      !(await deliveryAuthorized(q, db))
    ) {
      await db.query(
        "UPDATE deliveries SET status='cancelled',error='Destination changed or delivery paused' WHERE id=$1",
        [q.id],
      );
      return null;
    }
    await db.query("UPDATE deliveries SET status='sending' WHERE id=$1", [
      q.id,
    ]);
    return q;
  });
}
export async function dispatchEmails() {
  let sent = 0;
  for (let n = 0; n < 20; n++) {
    const q = await claimDelivery("email");
    if (!q) break;
    try {
      const valid = (
        await pool().query(
          "SELECT 1 FROM destinations WHERE id=$1 AND enabled=true AND revision=$2",
          [q.destination_id, q.revision],
        )
      ).rowCount;
      if (!valid || !(await deliveryAuthorized(q))) {
        await pool().query(
          "UPDATE deliveries SET status='cancelled' WHERE id=$1",
          [q.id],
        );
        continue;
      }
      const provider = await sendEmail(
        q.value,
        q.payload.subject,
        q.payload.text,
        q.id,
        q.payload.unsubscribe,
        q.payload.html,
      );
      await pool().query(
        "UPDATE deliveries SET status='sent',sent_at=now(),provider_id=$2 WHERE id=$1",
        [q.id, provider],
      );
      sent++;
    } catch {
      await pool().query(
        "UPDATE deliveries SET status='uncertain',error='Provider acceptance could not be confirmed. Automatic resend paused.' WHERE id=$1",
        [q.id],
      );
    }
  }
  return { sent };
}
export async function unsubscribe(id: string, proof: string) {
  if (!proof || hash(proof) !== hash(unsubscribeToken(id))) return false;
  await tx(async (d) => {
    const sub = await d.query(
      "UPDATE news_subscriptions SET enabled=false,revision=revision+1 WHERE id=$1 RETURNING id",
      [id],
    );
    if (sub.rowCount) {
      await d.query(
        "UPDATE deliveries SET status='cancelled' WHERE subscription_id=$1 AND status='pending'",
        [id],
      );
      return;
    }
    await d.query(
      "UPDATE destinations SET enabled=false,revision=revision+1 WHERE id=$1",
      [id],
    );
    await d.query(
      "UPDATE deliveries SET status='cancelled' WHERE destination_id=$1 AND status='pending'",
      [id],
    );
  });
  return true;
}
