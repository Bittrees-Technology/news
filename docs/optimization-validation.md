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

## 9 — Bounded quality review

Admins now have batches of at most five failed public briefings and five failed translations, with bounded evidence, available output, failure category and a required finding. Reviewed records leave the unreviewed queue. Same-origin/role checks protect writes; arbitrary retry/promotion fields are rejected. Categories separate transport, malformed output, language, unsupported claims, attribution and insufficient evidence. No bulk retry or automatic model promotion occurs. Where failed output was never saved, the UI explicitly states that factual quality cannot be reconstructed. The frozen benchmark review remains the quality evidence; this production review workflow still needs human/agent findings on actual saved outputs.

## 10 — Delivery events and SMTP health

Signed Svix events now persist idempotently by event ID, recording provider ID/type/status/time without recipients or message content. Latest provider-time events distinguish acceptance, delivery to recipient server, deferral, bounce, complaint, failure and suppression. Replay does not repeatedly revise destinations; bounce/complaint suppression remains transactional. No email opens/clicks are collected. Events expire after 90 days. Model telemetry relay also probes local/public-address SMTP greeting without sending DATA; admin analytics marks telemetry stale after 15 minutes and clearly distinguishes host-origin probes from external WAN/inbox confirmation. Provider signing secret is configured, but real event receipt/dashboard registration still needs validation with the next normal delivery; send-only API permissions cannot administer webhooks. No test email was sent.

Provider event meanings checked against Resend's official webhook reference: https://github.com/resend/resend-skills/blob/main/skills/resend/references/webhooks.md . “Delivered” means recipient mail-server acceptance, not that the user read the message.

## Final verification and remaining acceptance gates

All ten implementation increments were committed/pushed to main and deployed individually; worker changes have their own commit and targeted service deployment. Unit suite: 64 passing. Production build passes. PostgreSQL regression checks cover lease expiry, queue fairness, public-only analytics/empty states, signed webhook authenticity/replay/suppression, and fixture cleanup. Fixed the installed Svix API compatibility issue discovered by the signed-event regression: verify signature first, then parse the authenticated body; `verify` does not return the parsed event in this installed version.

Additional evidence:
- Seven briefing jobs reported generation, validation, archive and persistence timings; new enqueue timestamps supplied queue timing for two. Worker services and supervisor active; no candidate model promotion.
- 83 collection observations recorded within a 15-minute sample after direct-write activation.
- Conditional Federal Reserve feed test: 14,853 body bytes on first local request, zero bytes and HTTP 304 on the next, same content hash. That endpoint returned HTTP 404 from production; production availability is recorded separately and not bypassed.
- Corrected six legacy World Bank rows to historical observation dates. Published immutable edition/IPFS snapshots were not rewritten.
- Inspected a bounded batch of five failed briefings and five translations; no failed output was retained. Stored reviewer-attributed notes with `unclassified` category and no impersonated human actor. No factual quality verdict, retry or promotion follows from missing output.
- SMTP telemetry confirms local and public-address route greetings from Acer, with no message DATA. Real external delivery remains a separate check.
- No test emails, guest tracking, bulk regeneration or live article reshuffling were introduced.

| Acceptance item | Status |
|---|---|
| Ten scoped implementation increments | Deployed, with incident/correction documented above |
| Unit/build/database regression checks | Passed; production health rechecked after correction |
| Seven-day ranking diversity comparison | Pending until at least 27 September 2026 02:05 UTC, based on actual first shadow record |
| Expanded-source 24-hour contribution/failure review | Pending until 21 September 2026 approximately 02:00 UTC |
| Meaningful engagement-rate assessment | Pending sufficient signed-in samples; no artificial activity generated |
| Sustained throughput/bandwidth improvement | Pending post-deployment time series; an individual 304 is not an overall savings claim |
| Cold-load timing separated from inference | Partial: generation includes model/cache/load time; candidate remains unloaded |
| Real provider webhook receipt | Pending: signing receiver implemented/configured; provider registration and real normal-delivery receipt not yet proven |
| Full factual assessment of legacy failed outputs | Unavailable where output was not retained; batches classified unclassified |

This is an implementation and current-validation report, not a declaration that all observation-dependent acceptance gates are complete. Continue the existing follow-up and issue a final completion report only when evidence supports those gates or explicitly document an unresolved external dependency. Do not promote shadow rankings or models merely because the observation period elapsed.

### Commit and deployment record

| Step | Main-branch commit |
|---|---|
| 1 Signals | 656e4c3 |
| 2 Data dates | bfabae4 |
| 3 Collection observations | 49df7bd |
| 4 Diversity shadow | 93da674; latest-edition-only correction in 76aa1ae |
| 5 Engagement | 76aa1ae |
| 6 Timings | d13c012; workers 1fa1272 |
| 7 Fairness | 36d0b93; corrected regression isolation in 262f756 |
| 8 Conditional collection | 262f756 |
| 9 Quality review | cb78a5f |
| 10 Delivery/SMTP | 24b13ca; verified-body parsing fix in 27aa6c1 |

Every listed website increment was deployed to the production alias after its passing build. Step 7's initial health check failed during the temporary-table incident, then recovered after cleanup; this is not represented as an uninterrupted healthy rollout. Production collector validation subsequently fetched BBC World successfully (18,901 body bytes, one recorded check). Delivery-event analytics are restricted to provider IDs belonging to News deliveries, excluding unrelated provider-account mail. The existing hourly follow-up now covers source review, seven-day shadow evaluation and the outstanding acceptance checks; no duplicate automation was created.

### 20 September 02:21 UTC follow-up

Added explicit eligible backlog age/current-day counts to processing analytics. Eligibility follows the claim rules, excludes active leases/backoff/exhausted jobs, and does not substitute publication dates for unknown historical enqueue times. Initial production timing samples now cover both worker types. Latest collection: 57 successes, zero failures, 44 unchanged bodies; cumulative instrumented checks 58, body bytes 22,191,612 and no production 304s yet. SMTP probes pass; real provider events, the 24-hour source assessment and seven-day comparison remain pending.

### 20 September 03:22 UTC follow-up

Production now records 137 HTTP 304 responses from 424 successful checks; 210,876,300 body bytes transferred. This verifies conditional-response operation, not a baseline-adjusted savings percentage. The eligible briefing backlog declined to 334; translations have no eligible backlog. No real signed delivery event or new publication cycle has occurred yet.

Durable claim ledger added as the next processing increment: envelope/revision/phase/deadline is committed atomically with each public worker lease. Real PostgreSQL fixture checks preserve the every-tenth fairness rule and force ledger failure to verify both claim paths roll back. This does not yet implement the full dependency/state-transition framework or satisfy the seven-day acceptance gate.

### 20 September 04:23 UTC follow-up

Durable claim ledger is receiving production claims (64 briefing, nine translation at inspection). Added atomic outcome events and admin transition counts, with idempotent archive replay and conflicting-CID rejection. PostgreSQL rollback/lease tests pass; no test email or model/ranking promotion. Eligible briefing backlog is 284; feed counters now include 319 HTTP 304s of 797 successful checks. These continuing counters are not a controlled savings estimate. Seven-day, source-expansion and real provider-event gates remain open.
- Result-replay hardening preserves the first saved briefing and prevents generation responses from changing an already archived document. Database regression verifies unchanged replay content, a single generated/archive outcome and rejection of conflicting CID/post-archive writes.

### 20 September 05:25 UTC follow-up

Added bounded deadline-without-report observations to the processing ledger and admin display. This closes a visibility gap without equating missing telemetry with failure or automatically retrying work. The existing 77 gaps span the pre-outcome rollout; late real outcomes can coexist with the observation. PostgreSQL checks pass for the 100-row batch limit, five-minute grace, recorded outcomes, idempotency and late results, plus prior lease/replay regression. All 64 unit tests and the production build pass; zero leaked temporary fixture tables found. Implementation increment: `Reconcile overdue claims without treating missing reports as failures`.

344 processing samples retained through 05:25 UTC; all four News worker services healthy. Feed counters show 522/1,205 successful checks returned 304, with 378,555,487 body bytes recorded. This verifies conditional fetching, not a measured baseline-adjusted savings claim. No signed provider events have arrived. Source assessment remains due after 21 September ~02:00 UTC; the seven-day shadow remains due after 27 September 02:05 UTC. Full processing dependency admission/state reconciliation and other previously documented acceptance limits remain open.
