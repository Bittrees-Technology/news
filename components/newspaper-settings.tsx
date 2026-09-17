"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { call, cachedData } from "@/lib/browser-api";
import { topics, sources } from "@/lib/catalog";
import { defaults, type Preferences } from "@/lib/model";
type Paper = {
  name: string;
  slug: string;
  description: string;
  published: boolean;
  auto_publish: boolean;
  auto_cadence: string;
  next_publish_at?: string;
  last_published_at?: string;
  publish_error?: string;
};
type Feed = {
  id?: string;
  name: string;
  slug: string;
  preferences: Preferences;
};
const slugify = (v: string) =>
  v
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/, "");
const freshFeed = (): Feed => ({
  name: "",
  slug: "",
  preferences: { ...defaults, topics: [], sources: [], blocked: [] },
});
export function NewspaperSettings({
  connections = [],
}: {
  connections?: { id: string; name: string }[];
}) {
  const availableSources = [
    ...sources,
    ...connections.map((c) => ({
      id: "private:" + c.id,
      name: c.name + " (your source)",
    })),
  ];
  const [paper, setPaper] = useState<Paper>(
    () =>
      cachedData("newspaper")?.newspaper ?? {
        name: "",
        slug: "",
        description: "",
        published: false,
        auto_publish: false,
        auto_cadence: "daily",
      },
  );
  const [exists, setExists] = useState(
      () => !!cachedData("newspaper")?.newspaper,
    ),
    [loaded, setLoaded] = useState(() => !!cachedData("newspaper")),
    [feeds, setFeeds] = useState<Feed[]>(
      () => cachedData("newspaper")?.feeds ?? [],
    ),
    [feed, setFeed] = useState<Feed>(freshFeed),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const d = await call("newspaper");
    if (d.newspaper) {
      setPaper(d.newspaper);
      setExists(true);
    }
    setFeeds(d.feeds);
    setLoaded(true);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function savePaper(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      await call("newspaper", paper);
      await load();
      setMessage(
        paper.published
          ? "Your newspaper is published."
          : paper.auto_publish
            ? "Automatic public publication enabled."
            : "Your newspaper is saved privately.",
      );
    });
  }
  if (!loaded)
    return <p role="status">{message || "Loading your newspaper…"}</p>;
  return (
    <>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <form className="panel" onSubmit={savePaper}>
        <h2>{exists ? "Your front cover" : "Name your newspaper"}</h2>
        <label className="field">
          Newspaper name
          <input
            required
            minLength={2}
            maxLength={100}
            value={paper.name}
            onChange={(e) =>
              setPaper({
                ...paper,
                name: e.target.value,
                ...(!exists ? { slug: slugify(e.target.value) } : {}),
              })
            }
            placeholder="e.g. The Riverside Review"
          />
        </label>
        <label className="field">
          Newspaper address
          <input
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            minLength={3}
            maxLength={60}
            readOnly={exists}
            value={paper.slug}
            onChange={(e) => setPaper({ ...paper, slug: e.target.value })}
          />
          <span className="muted">
            news.bittrees.org/{paper.slug || "your-newspaper"}
            {exists ? " · Your address is permanent." : ""}
          </span>
        </label>
        <label className="field">
          Front-cover introduction
          <textarea
            maxLength={300}
            value={paper.description}
            onChange={(e) =>
              setPaper({ ...paper, description: e.target.value })
            }
            placeholder="What is your newspaper about?"
          />
        </label>
        <label className="field">
          Visibility
          <select
            value={paper.published ? "public" : "private"}
            onChange={(e) =>
              setPaper({
                ...paper,
                published: e.target.value === "public",
                ...(e.target.value === "private"
                  ? { auto_publish: false }
                  : {}),
              })
            }
          >
            <option value="private">Private — only you</option>
            <option value="public">Public — anyone with the address</option>
          </select>
        </label>
        <p className="muted">
          Publishing shares your newspaper name, introduction and curated public
          stories. Your sign-in details, interests, forwarding addresses and
          personal RSS connections stay private unless you explicitly allow
          their stories to be shared in Sources & feeds.
        </p>
        <label className="check-line">
          <input
            type="checkbox"
            checked={paper.auto_publish}
            onChange={(e) =>
              setPaper({ ...paper, auto_publish: e.target.checked })
            }
          />
          Automatically publish new editions publicly
        </label>
        <p className="muted">
          Enabling this gives permission to publish this newspaper at its next
          scheduled refresh, even if it is private now. Switch it off to stop
          scheduled publishing. Automatic jobs run every 15 minutes and retain
          the last edition if preparation fails.
        </p>
        {paper.auto_publish && (
          <label className="field">
            Publication schedule (UTC)
            <select
              value={paper.auto_cadence}
              onChange={(e) =>
                setPaper({ ...paper, auto_cadence: e.target.value })
              }
            >
              <option value="daily">Daily, after 11:57</option>
              <option value="three_daily">After 07:57, 11:57 and 19:57</option>
              <option value="hourly">Hourly</option>
            </select>
          </label>
        )}
        {paper.next_publish_at && (
          <p>
            Next scheduled refresh:{" "}
            {new Date(paper.next_publish_at).toLocaleString("en-GB", {
              timeZone: "UTC",
            })}{" "}
            UTC
          </p>
        )}
        {paper.publish_error && <p className="notice">{paper.publish_error}</p>}
        <div className="button-row">
          <button className="primary" disabled={busy}>
            {busy
              ? "Saving…"
              : paper.published
                ? "Save & publish newspaper"
                : paper.auto_publish
                  ? "Save & enable automatic publication"
                  : "Save private newspaper"}
          </button>
          {exists && (
            <>
              <Link href="/account/preview">Generate & edit preview</Link>
              <Link href={"/" + paper.slug}>Open front cover</Link>
            </>
          )}
        </div>
      </form>
      {exists && (
        <section className="panel">
          <h2>Your named feeds</h2>
          <p>
            Give each section a custom name, such as “Local futures” or “Science
            desk”. Each gets its own page and follows your newspaper’s
            visibility.
          </p>
          {feeds.map((f) => (
            <div className="connection" key={f.id}>
              <Link href={`/${paper.slug}/${f.slug}`}>{f.name}</Link>
              <p className="muted">
                news.bittrees.org/{paper.slug}/{f.slug}
              </p>
              <div className="button-row">
                <button
                  onClick={() => {
                    setFeed(f);
                    setMessage("Editing " + f.name);
                  }}
                >
                  Edit feed
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await call("newspaper/feeds", { id: f.id }, "DELETE");
                      if (feed.id === f.id) setFeed(freshFeed());
                      await load();
                      setMessage("Feed removed.");
                    })
                  }
                >
                  Remove feed
                </button>
              </div>
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await call("newspaper/feeds", feed);
                setFeed(freshFeed());
                await load();
                setMessage("Feed saved.");
              });
            }}
          >
            <h3>{feed.id ? "Edit feed" : "Create a feed"}</h3>
            <label className="field">
              Feed / topic name
              <input
                required
                minLength={2}
                maxLength={100}
                value={feed.name}
                onChange={(e) =>
                  setFeed({
                    ...feed,
                    name: e.target.value,
                    ...(!feed.id ? { slug: slugify(e.target.value) } : {}),
                  })
                }
                placeholder="e.g. Science desk"
              />
            </label>
            <label className="field">
              Feed address
              <input
                required
                minLength={3}
                maxLength={60}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                readOnly={!!feed.id}
                value={feed.slug}
                onChange={(e) => setFeed({ ...feed, slug: e.target.value })}
              />
              <span className="muted">
                news.bittrees.org/{paper.slug}/{feed.slug || "feed-name"}
              </span>
            </label>
            <fieldset>
              <legend>Include topics</legend>
              <p className="muted">
                Leave empty to include all topics. Feed filters are independent
                of your front-cover preferences.
              </p>
              <div className="checks">
                {topics.map((t) => (
                  <label key={t}>
                    <input
                      type="checkbox"
                      checked={feed.preferences.topics.includes(t)}
                      onChange={() =>
                        setFeed({
                          ...feed,
                          preferences: {
                            ...feed.preferences,
                            topics: feed.preferences.topics.includes(t)
                              ? feed.preferences.topics.filter((x) => x !== t)
                              : [...feed.preferences.topics, t],
                          },
                        })
                      }
                    />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field">
              Interests to prioritize
              <textarea
                maxLength={1000}
                value={feed.preferences.interests}
                onChange={(e) =>
                  setFeed({
                    ...feed,
                    preferences: {
                      ...feed.preferences,
                      interests: e.target.value,
                    },
                  })
                }
              />
            </label>
            <details>
              <summary>Choose sources for this feed</summary>
              <p className="muted">Leave empty to include all sources.</p>
              <div className="source-picker">
                {availableSources.map((s) => (
                  <label className="source-option" key={s.id}>
                    <input
                      type="checkbox"
                      checked={feed.preferences.sources.includes(s.id)}
                      onChange={() =>
                        setFeed({
                          ...feed,
                          preferences: {
                            ...feed.preferences,
                            sources: feed.preferences.sources.includes(s.id)
                              ? feed.preferences.sources.filter(
                                  (x) => x !== s.id,
                                )
                              : [...feed.preferences.sources, s.id],
                          },
                        })
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </details>
            <div className="button-row">
              <button disabled={busy} className="primary">
                Save feed
              </button>
              {feed.id && (
                <button type="button" onClick={() => setFeed(freshFeed())}>
                  Cancel editing
                </button>
              )}
            </div>
          </form>
        </section>
      )}
      <p>
        <Link href="/examples/daily-2026-09-17">
          View the daily newspaper example
        </Link>
      </p>
      <p>
        Choose the stories on your front cover in{" "}
        <Link href="/account/topics">Topics & interests</Link> and{" "}
        <Link href="/account/sources">Sources & feeds</Link>.
      </p>
    </>
  );
}
