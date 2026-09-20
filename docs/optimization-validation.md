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
