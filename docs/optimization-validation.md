# Analytics optimization implementation and validation

Started 20 September 2026. Each numbered step is committed to the existing main branch and deployed separately, with unit tests, production build and public health verification. No ranking-weight replacement or model promotion is implied. Seven-day shadow results and live provider-event receipt require observation and are reported separately from implementation.

## 1 — Separate ranking signals

Implemented explicit feed-availability/feedback, excerpt-match heuristic and metadata-completeness labels. Admin coverage lists 30-day observation counts and raw availability; editorial reliability is explicitly unrated. Existing ranking weights stay unchanged. Evidence rubric: check every claim against supplied evidence; distinguish source claims from established facts; preserve names, numbers, dates, attribution and uncertainty; reject invented continuation or sponsor-derived claims; mark missing/partial evidence. The frozen 42-case-per-model review remains the recorded quality baseline (see processing-rollout-status); both configurations fail promotion. Automated lexical match is not rubric validation.

## 2 — Observation, release and retrieval dates

Added compatible columns before deployment. World Bank annual items carry their observation year, a separate retrieval timestamp and an explicitly unknown release date. Their chronology uses observation-period end, with zero freshness when release date is unknown. Retrieval text no longer changes evidence every day. Unit regression checks repeated retrieval cannot increase freshness. Existing items are corrected with the next World Bank fetch; saved historical edition snapshots are not rewritten.

## 3 — Collection observations and overdue alerts

Both successful (including unchanged) and failed public checks now atomically update source state and insert an observation from the accepted lease update. Cleared/reclaimed lease retries cannot insert duplicates. Ranking reads no longer manufacture public observations. Analytics flags overdue polling after an additional source interval beyond its due time (two intervals from the prior normal check), respecting explicit retry backoff, and shows the oldest check. Unit tests cover normal, overdue and backed-off cases. Alerts are in-app, not email notifications.

## 4 — Seven-day diversity shadow

One idempotent comparison per published edition records existing leading IDs versus a publisher-diverse candidate with conservative title-similarity deduplication. Records include distinct publisher families, heuristic event clusters, geographic mentions and unknown regions. It runs after collection sampling, not in reader navigation. No live ordering, weights or saved filters change. Regression verifies publisher/event diversification without mutation. Seven-day observation is PENDING from first recorded comparison; this is not a validated geographic classifier or a promoted reranker.

## 5 — Bounded signed-in engagement

Added authenticated, same-origin, rate-limited impression/source-click ingestion for public items only. Daily account/article/event uniqueness prevents refresh inflation; account deletion cascades and five-minute maintenance enforces 30-day retention. No guest events, text, destination URLs or wallet details are stored. UI records visible-card impressions after one second and explicit source clicks; it does not reorder articles. Admin aggregates require five readers and twenty views before presenting a view-to-source rate. Privacy page documents collection. Schema tests reject unknown event kinds and extra payloads. Fixed the shadow collector to observe only the current edition, avoiding backfilling historical snapshots as fresh observations.

## 6 — Stage timing instrumentation

Added worker-authorized, lease-bound, idempotent timings and seven-day median/p95/sample counts with 30-day retention. Briefing stages separate model generation, JSON validation, IPFS add and persistence; translation splits text generation from language validation/preparation. Queue age includes deferrals; unknown historical briefing enqueue times stay unknown. Generation explicitly includes cache/load/transport rather than inventing separate cold-load figures. Compatible API deploy precedes worker rollout. Publication does not wait for timing reports. Cold-load isolation remains an observability limitation until a managed-model configuration passes quality gates.
- Worker timing instrumentation deployed after API readiness; only the two News processing workers restarted. Ten existing worker tests passed; model and unrelated services remain active. A restart may defer an interrupted claim until lease expiry, which is bounded and rejects stale completions.

## 7 — Backlog fairness

Public briefing and translation schedulers persist independent claim counters. Nine selection turns retain current-day/score priority; every tenth reserves oldest eligible work. Briefings already generated retain archive-first priority to avoid repeating inference. Backoff, retry limits, lease isolation and public/private boundaries are unchanged. Clock aging no longer depends solely on publisher dates. This reserves opportunities, not a completion-time guarantee when model capacity is unavailable. Publication remains independent; seven-day impact monitoring is pending.
- Step 7 PostgreSQL fixture check passed for both real claim functions: turns 1–9 select current work; turn 10 selects the old eligible record. Fixtures use connection-local temporary tables and do not mutate production jobs.

## 8 — Conditional fetching and cadence

Added bounded ETag/Last-Modified requests with explicit 304 handling before redirects; no-cache callers retain the original body API. Cached feed hashes are required before sending validators. Public-network/DNS/redirect/size protections remain active. Collector persists validators, successful-check/304/body-byte/parsed-entry counters; parsed entries explicitly include repeats rather than claiming they are newly discovered. BIS/Fed/Bitcoin Optech poll hourly; news defaults remain 15 minutes and annual data daily. Response-byte counters exclude HTTP headers and failed transfers. Actual savings require post-deployment samples.

### Validation incident and correction

The first fairness regression used session-local temporary tables without an outer transaction. The production database uses transaction pooling: its backend retained those temporary tables and later News requests saw test schemas, causing API 503s and worker failures. This invalidated the initial claim that the test was fully isolated. Paused rollout, removed the temporary tables, checked `public.items` (2,787 real records; zero test-source rows) and `public.story_documents` (1,614 records), and confirmed health recovered. No production table was dropped or replaced. Reworked the fixture to hold one outer transaction and intercept claim transactions as savepoints; rollback removes every fixture before releasing the pooled backend. Re-run passed and confirmed zero temporary tables remain. Step 7 validation is now qualified by this resolved incident; do not reuse untransactional temp tables on pooled databases.
