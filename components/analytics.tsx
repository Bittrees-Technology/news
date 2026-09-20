"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { call } from "@/lib/browser-api";
import { sourceName } from "@/lib/catalog";
import { factorNames, type Factor } from "@/lib/scoring";
import type { Edition } from "@/lib/model";
import type { SourceHealth } from "@/lib/source-health";
import {AnalyticsCoverage} from "./analytics-coverage";
import {ProcessingStatus} from "./processing-status";
import { Rankings } from "./rankings";

export function Analytics({ role }: { role: string }) {
  const [data, setData] = useState<{
    health: SourceHealth;
    edition: Edition | null;
  } | null>(null);
  const [error, setError] = useState("");
  const scores = ["admin", "super_admin"].includes(role);
  const staff = ["moderator", "editor", "admin", "super_admin"].includes(role);
  useEffect(() => {
    let active = true;
    call("analytics")
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      {scores&&<><AnalyticsCoverage key={role+"coverage"}/><ProcessingStatus key={role}/></>}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading analytics…</p>}
      {data && (
        <>
          <section className="panel">
            <h2>Site and source activity</h2>
            <p>
              {data.health.healthy} sources reachable ·{" "}
              {data.health.unavailable} unavailable · {data.health.unchecked}{" "}
              not checked
            </p>
            <p>
              {data.edition?.data.items.length ?? 0} stories in the latest
              edition ·{" "}
              {data.edition?.data.items.filter((i) => i.kind === "data")
                .length ?? 0}{" "}
              data items
            </p>
            {data.edition?.published_at && (
              <p>
                Edition published:{" "}
                {new Date(data.edition.published_at).toLocaleString()}
              </p>
            )}
            {data.health.checkedAt && (
              <p>
                Latest source check:{" "}
                {new Date(data.health.checkedAt).toLocaleString()}
              </p>
            )}
            {!!data.health.issues.length && (
              <details>
                <summary>Unavailable sources</summary>
                <ul>
                  {data.health.issues.map((i) => (
                    <li key={i.name}>
                      <a
                        href={i.homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {i.name}
                      </a>
                      : {i.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <Link href="/account/sources">Manage sources and feeds</Link>
          </section>
          <section className="panel">
            <h2>Article and data details</h2>
            <p>
              Source information and summary methods for the latest edition.
              {scores && " Scores are curation signals, not a fact-check."}
            </p>
            {!data.edition?.data.items.length && (
              <p>No published articles yet.</p>
            )}
            {data.edition?.data.items.map((i) => (
              <details key={i.id} className="score-detail">
                <summary>{i.title}</summary>
                <p>
                  <a href={i.url} target="_blank" rel="noopener noreferrer">
                    {sourceName(i.source_id)}
                  </a>{" "}
                  ·{" "}
                  {i.kind === "data"
                    ? "Data"
                    : i.kind === "podcast"
                      ? "Podcast"
                      : "Article"}
                </p>
                <p>
                  {i.summary_kind === "extractive"
                    ? "AI-selected source excerpt"
                    : i.summary_kind === "generated"
                      ? "Generated summary"
                      : "Publisher excerpt / data"}
                </p>
                {scores && i.ranking && (
                  <>
                    <p>
                      Article score {i.ranking.value.toFixed(1)} / 100 · Source
                      consistency {i.ranking.sourceScore.toFixed(0)} / 100
                    </p>
                    <ul>
                      {Object.entries(i.ranking.factors).map(([key, value]) => (
                        <li key={key}>
                          {factorNames[key as Factor]}: {value} / 100
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {staff && (
                  <p>
                    Article ID: <code>{i.id}</code> ·{" "}
                    <Link href="/account/editorial">
                      Open editorial review workspace
                    </Link>
                  </p>
                )}
              </details>
            ))}
          </section>
        </>
      )}
      <Rankings showHistory={scores} />
    </>
  );
}
