"use client";
import { useEffect, useState } from "react";
import Link from 'next/link';
import {EditionChoice} from './edition-choice';
import {globalEdition,type EditionPreference} from '@/lib/top-three';
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
    [deliveryTime,setDeliveryTime]=useState('12:00'),
    [timeZone,setTimeZone]=useState('UTC'),
    [editionPreference,setEditionPreference]=useState<EditionPreference>(globalEdition),
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
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC');
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
      <p>Choose a newspaper, destination and schedule for each digest.</p>
      <details className="settings-help"><summary>How delivery works</summary>
      <p>
        Subscribe to the main Bittrees newspaper, your personal edition, or a
        published newspaper or feed. Choose a delivery time and timezone. Deliveries queue on the next ten-minute dispatch cycle; arrival can take longer. Daily delivery sends one digest; weekly is on Monday and monthly on the first. Your main newspaper digest follows your Global, country/region or city choice.
      </p>
      </details>
      {message && <p role="status">{message}</p>}
      {!data ? (
        <p>Loading subscriptions…</p>
      ) : (
        <>
          {data.subscriptions.map((s) => (
            <div className="destination" key={s.id}>
              <strong>{s.name || "Unavailable newspaper"}</strong>
              <p>
                {s.value} · {s.cadence} · {s.delivery_time||'12:00'} {s.time_zone||'UTC'} · {s.edition_preference?.scope||'global'} ·{" "}
                {s.enabled
                  ? s.destination_enabled
                    ? "Active"
                    : "Destination paused"
                  : "Paused"}
              </p>
              <div className="button-row">
                <button disabled={busy} onClick={()=>{setChoice(s.target==='main'||s.target==='personal'?s.target:`${s.target}:${s.newspaper_slug}${s.feed_slug?'/'+s.feed_slug:''}`);setDestination(s.destination_id);setCadence(s.cadence);setDeliveryTime(s.delivery_time||'12:00');setTimeZone(s.time_zone||'UTC');setEditionPreference(s.edition_preference?.scope?s.edition_preference:globalEdition);setMessage('Edit this subscription in the form below, then save.');}}>Edit schedule and edition</button>
                <select
                  aria-label={"Frequency for " + s.name}
                  value={s.cadence}
                  disabled={busy}
                  onChange={(e) =>
                    void run(async () => {
                      await call("subscriptions", {
                        deliveryTime:s.delivery_time||'12:00',timeZone:s.time_zone||'UTC',editionPreference:s.edition_preference||globalEdition,
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
                        deliveryTime:s.delivery_time||'12:00',timeZone:s.time_zone||'UTC',editionPreference:s.edition_preference||globalEdition,
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
                    cadence,deliveryTime,timeZone,editionPreference,
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
              <label className="field">Delivery time<input type="time" required value={deliveryTime} onChange={e=>setDeliveryTime(e.target.value)}/></label>
              <label className="field">Timezone<input required maxLength={80} value={timeZone} onChange={e=>setTimeZone(e.target.value)} placeholder="Europe/Lisbon"/></label>
              {choice==='main'&&<EditionChoice value={editionPreference} onChange={setEditionPreference}/>}
              <p>Saving the same newspaper and destination updates its subscription.</p>
              <button className="primary" disabled={busy || !destination}>
                Save subscription
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
