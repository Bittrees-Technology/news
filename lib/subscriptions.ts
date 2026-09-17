import { z } from "zod";
import { pool, tx } from "./db";
import { HttpError, periodFor, type Item } from "./model";
import { emailReady } from "./mail";
import { walletReady } from "./wallet";
import { buildPersonalEdition } from "./curation";
import { latestEdition } from "./publish";

export const subscriptionSchema = z.object({
  id: z.uuid().optional(),
  destinationId: z.uuid(),
  target: z.enum(["main", "personal", "newspaper", "feed"]),
  newspaperSlug: z.string().max(60).optional(),
  feedSlug: z.string().max(60).optional(),
  cadence: z.enum(["daily", "weekly", "monthly"]),
  enabled: z.boolean().default(false),
});
export async function subscriptionTarget(
  accountId: string,
  b: z.infer<typeof subscriptionSchema>,
) {
  if (b.target === "main")
    return { key: "main", name: "The Bittrees News", owner: null, feed: null };
  if (b.target === "personal")
    return {
      key: "personal",
      name: "My personal newspaper",
      owner: accountId,
      feed: null,
    };
  const p = (
    await pool().query(
      "SELECT account_id,name,slug,published FROM newspapers WHERE slug=$1 AND (published=true OR account_id=$2)",
      [b.newspaperSlug, accountId],
    )
  ).rows[0];
  if (!p) throw new HttpError(404, "Published newspaper not found.");
  if (b.target === "newspaper")
    return {
      key: "paper:" + p.account_id,
      name: p.name,
      owner: p.account_id,
      feed: null,
    };
  const f = (
    await pool().query(
      "SELECT id,name FROM newspaper_feeds WHERE account_id=$1 AND slug=$2",
      [p.account_id, b.feedSlug],
    )
  ).rows[0];
  if (!f) throw new HttpError(404, "Feed not found.");
  return {
    key: "feed:" + f.id,
    name: p.name + " / " + f.name,
    owner: p.account_id,
    feed: f.id,
  };
}
export async function saveSubscription(accountId: string, input: unknown) {
  const b = subscriptionSchema.parse(input);
  if (b.id && !b.enabled)
    return tx(async (d) => {
      const r = await d.query(
        "UPDATE news_subscriptions SET enabled=false,cadence=$3,revision=revision+1 WHERE id=$1 AND account_id=$2 RETURNING *",
        [b.id, accountId, b.cadence],
      );
      if (!r.rowCount) throw new HttpError(404, "Subscription not found.");
      await d.query(
        "UPDATE deliveries SET status='cancelled',error='Subscription paused' WHERE subscription_id=$1 AND status='pending'",
        [b.id],
      );
      return r.rows[0];
    });
  const target = await subscriptionTarget(accountId, b);
  return tx(async (d) => {
    await d.query("SELECT id FROM accounts WHERE id=$1 FOR UPDATE", [
      accountId,
    ]);
    const dest = (
      await d.query(
        "SELECT * FROM destinations WHERE id=$1 AND account_id=$2 FOR UPDATE",
        [b.destinationId, accountId],
      )
    ).rows[0];
    if (!dest?.verified_at)
      throw new HttpError(
        404,
        "Choose one of your verified delivery destinations.",
      );
    if (
      b.enabled &&
      (dest.kind === "email"
        ? !emailReady()
        : !dest.reachable || !(await walletReady()))
    )
      throw new HttpError(
        409,
        "Delivery is not available for this destination yet.",
      );
    if (
      b.id &&
      !(
        await d.query(
          "SELECT 1 FROM news_subscriptions WHERE id=$1 AND account_id=$2",
          [b.id, accountId],
        )
      ).rowCount
    )
      throw new HttpError(404, "Subscription not found.");
    const existing = (
      await d.query(
        "SELECT id FROM news_subscriptions WHERE account_id=$1 AND destination_id=$2 AND target_key=$3",
        [accountId, b.destinationId, target.key],
      )
    ).rows[0];
    if (
      !b.id &&
      !existing &&
      Number(
        (
          await d.query(
            "SELECT count(*) FROM news_subscriptions WHERE account_id=$1",
            [accountId],
          )
        ).rows[0].count,
      ) >= 50
    )
      throw new HttpError(400, "You can have up to 50 subscriptions.");
    const values = [
      accountId,
      b.destinationId,
      b.target,
      target.key,
      target.owner,
      target.feed,
      b.cadence,
      b.enabled,
    ];
    const result = b.id
      ? await d.query(
          "UPDATE news_subscriptions SET destination_id=$2,target=$3,target_key=$4,newspaper_owner=$5,feed_id=$6,cadence=$7,enabled=$8,revision=revision+1 WHERE account_id=$1 AND id=$9 RETURNING *",
          [...values, b.id],
        )
      : await d.query(
          "INSERT INTO news_subscriptions(account_id,destination_id,target,target_key,newspaper_owner,feed_id,cadence,enabled) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(account_id,destination_id,target_key) DO UPDATE SET cadence=$7,enabled=$8,revision=news_subscriptions.revision+1 RETURNING *",
          values,
        );
    const row = result.rows[0];
    await d.query(
      "UPDATE deliveries SET status='cancelled',error='Subscription changed' WHERE subscription_id=$1 AND status='pending'",
      [row.id],
    );
    // Explicit subscription activation enables its already-verified destination.
    if (b.enabled && !dest.enabled)
      await d.query(
        "UPDATE destinations SET enabled=true,revision=revision+1 WHERE id=$1",
        [dest.id],
      );
    return { ...row, name: target.name };
  });
}
export async function deliverySettings(accountId: string) {
  const destinations = (
    await pool().query(
      "SELECT id,kind,value,enabled,reachable,verified_at FROM destinations WHERE account_id=$1 ORDER BY value",
      [accountId],
    )
  ).rows;
  const subscriptions = (
    await pool().query(
      "SELECT s.*,d.value,d.enabled AS destination_enabled,n.slug AS newspaper_slug,f.slug AS feed_slug,CASE WHEN s.target='main' THEN 'The Bittrees News' WHEN s.target='personal' THEN 'My personal newspaper' WHEN s.target='feed' THEN n.name||' / '||f.name ELSE n.name END AS name FROM news_subscriptions s JOIN destinations d ON d.id=s.destination_id LEFT JOIN newspapers n ON n.account_id=s.newspaper_owner LEFT JOIN newspaper_feeds f ON f.id=s.feed_id WHERE s.account_id=$1 ORDER BY s.created_at",
      [accountId],
    )
  ).rows;
  const papers = (
    await pool().query(
      "SELECT n.name,n.slug,json_agg(json_build_object('name',f.name,'slug',f.slug)) FILTER(WHERE f.id IS NOT NULL) AS feeds FROM newspapers n LEFT JOIN newspaper_feeds f ON f.account_id=n.account_id WHERE n.published=true OR n.account_id=$1 GROUP BY n.account_id ORDER BY n.name LIMIT 200",
      [accountId],
    )
  ).rows;
  return { destinations, subscriptions, papers };
}
export async function subscriptionContent(
  s: any,
  at = new Date(),
): Promise<{
  name: string;
  items: Item[];
  period: NonNullable<ReturnType<typeof periodFor>>;
} | null> {
  const period = periodFor(s.cadence, at);
  if (!period) return null;
  if (s.target === "main") {
    const editions = (
      await pool().query(
        "SELECT data FROM editions WHERE published_at IS NOT NULL AND publish_at >= $1 AND publish_at < $2 ORDER BY publish_at DESC LIMIT 100",
        [period.start, period.end],
      )
    ).rows;
    const items = [
      ...new Map<string, Item>(
        editions
          .flatMap((e) => e.data.items)
          .map((i: Item) => [i.id, i] as [string, Item]),
      ).values(),
    ];
    return { name: "The Bittrees News", items: items.slice(0, 50), period };
  }
  if (s.target === "personal") {
    const e = await buildPersonalEdition(s.account_id);
    return {
      name: "My personal newspaper",
      items: e.front
        .filter(
          (i) =>
            new Date(i.published_at) >= period.start &&
            new Date(i.published_at) < period.end,
        )
        .slice(0, 50),
      period,
    };
  }
  const p = (
    await pool().query(
      "SELECT * FROM newspapers WHERE account_id=$1 AND (published=true OR account_id=$2)",
      [s.newspaper_owner, s.account_id],
    )
  ).rows[0];
  if (!p) return null;
  const snapshots = (
    await pool().query(
      "SELECT snapshot FROM newspaper_editions WHERE account_id=$1 AND published_at >= $2 AND published_at < $3 ORDER BY published_at DESC LIMIT 1000",
      [p.account_id, period.start, period.end],
    )
  ).rows;
  const editions = snapshots.map((r) => r.snapshot);
  if (
    !editions.length &&
    p.snapshot &&
    new Date(p.last_published_at) >= period.start &&
    new Date(p.last_published_at) < period.end
  )
    editions.push(p.snapshot);
  if (!p.published && p.account_id === s.account_id)
    editions.push(await buildPersonalEdition(s.account_id));
  const feed = s.feed_id
    ? (
        await pool().query(
          "SELECT name FROM newspaper_feeds WHERE id=$1 AND account_id=$2",
          [s.feed_id, p.account_id],
        )
      ).rows[0]
    : null;
  if (s.target === "feed" && !feed) return null;
  const selected = editions.flatMap((e) =>
    s.target === "feed"
      ? e.feeds.find((f: any) => f.id === s.feed_id)?.items || []
      : e.front,
  );
  // Recheck source sharing against current ownership, even for historical snapshots.
  const ids = selected.map((i: Item) => i.id);
  const allowed = new Set(
    (
      await pool().query(
        "SELECT i.id FROM items i WHERE i.id=ANY($1::text[]) AND (i.owner_id IS NULL OR i.owner_id=$2 OR EXISTS(SELECT 1 FROM connections c WHERE c.account_id=i.owner_id AND 'private:'||c.id::text=i.source_id AND c.share_public=true))",
        [ids, s.account_id],
      )
    ).rows.map((r) => r.id),
  );
  return {
    name: p.name + (feed ? " / " + feed.name : ""),
    items: [
      ...new Map<string, Item>(
        selected
          .filter((i: Item) => allowed.has(i.id))
          .map((i: Item) => [i.id, i] as [string, Item]),
      ).values(),
    ].slice(0, 50),
    period,
  };
}
export async function subscriptionStillAllowed(
  id: string,
  revision: number,
  db: any = pool(),
) {
  return !!(
    await db.query(
      "SELECT 1 FROM news_subscriptions s LEFT JOIN newspapers n ON n.account_id=s.newspaper_owner LEFT JOIN newspaper_feeds f ON f.id=s.feed_id WHERE s.id=$1 AND s.enabled=true AND s.revision=$2 AND (s.target IN ('main','personal') OR ((n.published=true OR n.account_id=s.account_id) AND (s.target!='feed' OR f.id IS NOT NULL)))",
      [id, revision],
    )
  ).rowCount;
}
