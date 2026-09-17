"use client";
import { useEffect, useState } from "react";
import { call, cachedData } from "@/lib/browser-api";
import {
  defaultRanking,
  factorNames,
  type Factor,
  type RankingProfile,
} from "@/lib/scoring";
type Point = {
  owner_key: string;
  kind: string;
  entity_id: string;
  name: string;
  bucket: string;
  score: number;
  position: number;
  samples: number;
  config: unknown;
};
export function Rankings({ showHistory = true }: { showHistory?: boolean }) {
  const [profile, setProfile] = useState<RankingProfile>(
      () => cachedData("ranking")?.profile ?? defaultRanking,
    ),
    [history, setHistory] = useState<Point[]>(
      () => cachedData("ranking")?.history ?? [],
    ),
    [entity, setEntity] = useState(""),
    [kind, setKind] = useState("source"),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const d = await call("ranking");
    setProfile(d.profile);
    setHistory(d.history);
  }
  useEffect(() => {
    load().catch((e) => setStatus(e.message));
  }, []);
  const options = [
    ...new Map(
      history
        .filter((p) => p.kind === kind)
        .map((p) => [p.owner_key + "|" + p.entity_id, p]),
    ).entries(),
  ];
  const chosen = options.some(([key]) => key === entity)
    ? entity
    : options[0]?.[0];
  const points = history
    .filter(
      (p) => p.kind === kind && p.owner_key + "|" + p.entity_id === chosen,
    )
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
  const chartX = (p: Point) => {
    const first = new Date(points[0]?.bucket || 0).getTime(),
      last = new Date(points.at(-1)?.bucket || 0).getTime();
    return first === last
      ? 320
      : 40 + ((new Date(p.bucket).getTime() - first) / (last - first)) * 575;
  };
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {status && (
        <p className="notice" role="status">
          {status}
        </p>
      )}
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await call("ranking", profile);
            setStatus(
              "Ranking preferences saved. Drafts use them immediately; published editions use them at the next publication.",
            );
          });
        }}
      >
        <h2>How your stories are ranked</h2>
        <p>
          Scores run from 0 to 100. Weights are normalized, so they do not need
          to add to 100. These signals help curate a reading list; they do not
          establish factual accuracy.
        </p>
        <div className="form-grid">
          {Object.entries(factorNames).map(([key, label]) => (
            <label className="field" key={key}>
              {label}: {profile.weights[key as Factor]}
              <input
                type="range"
                min={0}
                max={100}
                value={profile.weights[key as Factor]}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    weights: {
                      ...profile.weights,
                      [key]: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
        <details>
          <summary>What the scores measure</summary>
          <p>
            Freshness uses a 48-hour half-life. Interest match counts your
            interest terms found in the title and excerpt. Source consistency is
            its successful collection percentage over the last 30 days (50 for
            an unobserved source). Evidence support rewards summaries matching
            source passages; it does not verify the publisher’s claims.
            Completeness checks the title, link, timestamp and excerpt length.
          </p>
        </details>
        <h3>Choose eligible articles</h3>
        <div className="form-grid">
          <label className="field">
            Minimum score
            <input
              type="number"
              min={0}
              max={100}
              value={profile.minScore}
              onChange={(e) =>
                setProfile({ ...profile, minScore: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            Maximum age in days
            <input
              type="number"
              min={1}
              max={90}
              value={profile.maxAgeDays}
              onChange={(e) =>
                setProfile({ ...profile, maxAgeDays: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            Maximum articles per source
            <input
              type="number"
              min={1}
              max={100}
              value={profile.maxPerSource}
              onChange={(e) =>
                setProfile({ ...profile, maxPerSource: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <div className="checks">
          {(["article", "podcast", "data"] as const).map((k) => (
            <label key={k}>
              <input
                type="checkbox"
                checked={profile.kinds.includes(k)}
                onChange={() =>
                  setProfile({
                    ...profile,
                    kinds: profile.kinds.includes(k)
                      ? profile.kinds.filter((v) => v !== k)
                      : [...profile.kinds, k],
                  })
                }
              />
              {k === "article"
                ? "News & research"
                : k === "podcast"
                  ? "Podcasts"
                  : "Data"}
            </label>
          ))}
        </div>
        <p className="muted">
          Leave all content types unchecked to include all.
        </p>
        <label className="check-line">
          <input
            type="checkbox"
            checked={profile.requireSummary}
            onChange={(e) =>
              setProfile({ ...profile, requireSummary: e.target.checked })
            }
          />
          Only articles with summaries
        </label>
        <label className="check-line">
          <input
            type="checkbox"
            checked={profile.deduplicate}
            onChange={(e) =>
              setProfile({ ...profile, deduplicate: e.target.checked })
            }
          />
          Remove repeated headlines
        </label>
        <button className="primary" disabled={busy}>
          Save ranking preferences
        </button>
      </form>
      {showHistory && (
        <section className="panel">
          <h2>Rankings over time</h2>
          <p>
            The latest recorded score per day is shown. No earlier history is
            invented. Newspaper/feed scores average their selected articles;
            public rankings may compare different owner-selected weights.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await call("ranking/refresh", {});
                await load();
                setStatus("Current scores recorded.");
              })
            }
          >
            Refresh my scores
          </button>
          <div className="form-grid">
            <label className="field">
              Compare
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setEntity("");
                }}
              >
                <option value="source">Sources</option>
                <option value="newspaper">Newspapers</option>
                <option value="feed">Named feeds</option>
              </select>
            </label>
            <label className="field">
              Show history for
              <select
                value={chosen || ""}
                onChange={(e) => setEntity(e.target.value)}
              >
                {!options.length && (
                  <option value="">No observations yet</option>
                )}
                {options.map(([key, p]) => (
                  <option key={key} value={key}>
                    {p.name} (
                    {p.owner_key === "public"
                      ? "public comparison"
                      : "your ranking"}
                    )
                  </option>
                ))}
              </select>
            </label>
          </div>
          {points.length ? (
            <>
              <svg
                viewBox="0 0 640 180"
                role="img"
                aria-label="Score history from 0 to 100"
                className="ranking-chart"
              >
                <title>Observed scores over time</title>
                {[0, 50, 100].map((v) => (
                  <g key={v}>
                    <line
                      x1="35"
                      x2="625"
                      y1={160 - v * 1.4}
                      y2={160 - v * 1.4}
                      stroke="var(--rule)"
                    />
                    <text
                      x="0"
                      y={165 - v * 1.4}
                      fill="currentColor"
                      fontSize="12"
                    >
                      {v}
                    </text>
                  </g>
                ))}
                <polyline
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  points={points
                    .map((p, n) => `${chartX(p)},${160 - p.score * 1.4}`)
                    .join(" ")}
                />
                {points.map((p, n) => (
                  <circle
                    key={p.bucket}
                    cx={chartX(p)}
                    cy={160 - p.score * 1.4}
                    r="3"
                    fill="var(--accent)"
                  >
                    <title>
                      {new Date(p.bucket).toISOString()}: {p.score}
                    </title>
                  </circle>
                ))}
              </svg>
              <div className="history-table">
                <table>
                  <thead>
                    <tr>
                      <th>Recorded hour (UTC)</th>
                      <th>Score</th>
                      <th>Position</th>
                      <th>Samples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points
                      .slice(-30)
                      .reverse()
                      .map((p) => (
                        <tr key={p.bucket}>
                          <td>
                            {new Date(p.bucket)
                              .toISOString()
                              .slice(0, 16)
                              .replace("T", " ")}
                          </td>
                          <td>{p.score.toFixed(1)}</td>
                          <td>#{p.position}</td>
                          <td>{p.samples}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p>
              No history for this category yet. Name your newspaper and refresh
              your scores to begin.
            </p>
          )}
        </section>
      )}
    </>
  );
}
