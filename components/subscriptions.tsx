"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { call } from "@/lib/browser-api";
type Data = {
  destinations: { id: string; value: string; enabled: boolean }[];
  subscriptions: any[];
  papers: {
    name: string;
    slug: string;
    feeds: { name: string; slug: string }[] | null;
  }[];
};
export function Subscriptions({
  destinationVersion,
  onChange,
}: {
  destinationVersion: string;
  onChange: () => Promise<void>;
}) {
  const [data, setData] = useState<Data | null>(null),
    [choice, setChoice] = useState("main"),
    [destination, setDestination] = useState(""),
    [cadence, setCadence] = useState("daily"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const d = await call("subscriptions");
    setData(d);
    setDestination((old) =>
      d.destinations.some((x: any) => x.id === old)
        ? old
        : d.destinations[0]?.id || "",
    );
  }
  useEffect(() => {
    const q = new URLSearchParams(window.location.search),
      paper = q.get("paper"),
      feed = q.get("feed");
    if (paper) setChoice(feed ? `feed:${paper}/${feed}` : `newspaper:${paper}`);
    load().catch((e) => setMessage(e.message));
  }, [destinationVersion]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await load();
      await onChange();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function target(value: string) {
    const [kind, path] = value.split(":"),
      [newspaperSlug, feedSlug] = (path || "").split("/");
    return { target: kind, newspaperSlug, feedSlug };
  }
  return (
    <section className="panel">
      <h2>Newspaper subscriptions</h2>
      <p>
        Subscribe to the main Bittrees newspaper, your personal edition, or a
        published newspaper or feed. Daily delivery is after 12:00 UTC; weekly
        on Monday; monthly on the first. Weekly and monthly deliveries collect
        editions from the preceding period.
      </p>
      {message && <p role="status">{message}</p>}
      {!data ? (
        <p>Loading subscriptions…</p>
      ) : (
        <>
          {data.subscriptions.map((s) => (
            <div className="destination" key={s.id}>
              <strong>{s.name || "Unavailable newspaper"}</strong>
              <p>
                {s.value} · {s.cadence} ·{" "}
                {s.enabled
                  ? s.destination_enabled
                    ? "Active"
                    : "Destination paused"
                  : "Paused"}
              </p>
              <div className="button-row">
                <select
                  aria-label={"Frequency for " + s.name}
                  value={s.cadence}
                  disabled={busy}
                  onChange={(e) =>
                    void run(async () => {
                      await call("subscriptions", {
                        id: s.id,
                        destinationId: s.destination_id,
                        target: s.target,
                        newspaperSlug: s.newspaper_slug || undefined,
                        feedSlug: s.feed_slug || undefined,
                        cadence: e.target.value,
                        enabled: s.enabled,
                      });
                      setMessage("Frequency saved.");
                    })
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await call("subscriptions", {
                        id: s.id,
                        destinationId: s.destination_id,
                        target: s.target,
                        newspaperSlug: s.newspaper_slug || undefined,
                        feedSlug: s.feed_slug || undefined,
                        cadence: s.cadence,
                        enabled: !s.enabled,
                      });
                      setMessage(
                        s.enabled
                          ? "Subscription paused."
                          : "Subscription enabled.",
                      );
                    })
                  }
                >
                  {s.enabled ? "Pause subscription" : "Enable subscription"}
                </button>
              </div>
            </div>
          ))}
          {!data.destinations.length ? (
            <p>
              Verify an email or wallet destination below before subscribing.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await call("subscriptions", {
                    ...target(choice),
                    destinationId: destination,
                    cadence,
                    enabled: true,
                  });
                  setMessage(
                    "Subscribed. Delivery begins at the next scheduled edition.",
                  );
                });
              }}
            >
              <div className="form-grid">
                <label className="field">
                  Newspaper or feed
                  <select
                    value={choice}
                    onChange={(e) => setChoice(e.target.value)}
                  >
                    <option value="main">The Bittrees News</option>
                    <option value="personal">My personal newspaper</option>
                    {data.papers.flatMap((p) => [
                      <option key={p.slug} value={"newspaper:" + p.slug}>
                        {p.name}
                      </option>,
                      ...(p.feeds || []).map((f) => (
                        <option
                          key={p.slug + "/" + f.slug}
                          value={`feed:${p.slug}/${f.slug}`}
                        >
                          {p.name} / {f.name}
                        </option>
                      )),
                    ])}
                  </select>
                </label>
                <label className="field">
                  Deliver to
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  >
                    {data.destinations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Frequency
                  <select
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
              </div>
              <button className="primary" disabled={busy || !destination}>
                Subscribe
              </button>
            </form>
          )}
          <p>
            <Link href="/account/preview">Preview your own newspaper</Link>
          </p>
        </>
      )}
    </section>
  );
}
