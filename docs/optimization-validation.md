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

Deployment verification: implementation commit `51745c0` pushed to main and deployed as `bittrees-news-3233v4nze-bittrees-tech.vercel.app` on the production alias. Public health passed; signed-out processing access returned 401. Production reconciliation recorded the 77 legacy missing-report observations; an immediate replay inserted zero. This does not classify those historical jobs as failed.

### 20 September 06:27 UTC — translation retry backoff

Found that reported translation failures became pending with an already-due availability timestamp, permitting immediate retries. Added the existing briefing-style delay: five minutes after failure one, ten after failure two; the third remains failed for review. Busy/model-resource deferrals remain separate at 30 seconds and refund the attempt. No existing failed work is reset or regenerated.

PostgreSQL regressions verify both retry delays, exhausted review state, resource-deferral behavior and exclusion of a deliberately high-priority delayed item by both real claim functions. Fairness, lease/result replay and atomic rollback checks still pass. All fixtures rolled back in one transaction; zero leaked temporary tables found. All 64 unit tests and production build pass.

Observation: 356 samples through 06:25 UTC; four News services active, supervisor healthy, candidate unloaded. Eligible briefing backlog 238 (237 unknown legacy enqueue times; one current-day item); one translation waiting under a minute. Stage sample coverage: 227 briefing archive/persist, 215 generation/validation, 69 translation generation/validation. The 77 legacy missing-outcome observations have not grown. Conditional checks: 713 HTTP 304s of 1,582 successes (45.1%), 465,392,855 response-body bytes; not a controlled savings comparison. Last collection 30 successes, zero failures, 26 unchanged in ten seconds. SMTP telemetry fresh at 06:24 with both host-origin probes passing. No signed delivery events; one shadow edition. Next publication remains due 07:57 UTC. Source-review and seven-day gates remain pending, as do dependency admission/state migration, permitted full-body policies and cold-load separation. Model/ranking decisions and explicit reader refresh remain unchanged.

Deployment evidence: `9d6ea0e` pushed to main and deployed to the production alias via `bittrees-news-6oem3xisz-bittrees-tech.vercel.app`. Live health passed; unauthenticated processing access remains 401. This is a targeted retry correction, not completion of the remaining acceptance gates.

### 20 September 07:27 UTC — observation checkpoint

368 samples through 07:25 UTC. All four News services active; supervisor healthy and candidate unloaded. Eligible briefings declined to 221, all legacy enqueue times unknown and none current-day; no eligible translations wait. Stage samples: 273 briefing archive/persistence, 259 generation/validation and 95 translation generation/validation. No new missing-outcome observations beyond the 77 historical gaps. Conditional telemetry: 903 HTTP 304 responses of 1,961 successful checks; 552,573,731 body bytes. This is ongoing instrumentation, not a controlled savings result. Last collection: 30 successes, no failures, 26 unchanged in eight seconds. SMTP telemetry at 07:24 passes both host-origin probes.

Public health passed. Next edition is due at 07:57 UTC; unchanged prior-evening publication is expected. Signed delivery events remain zero, shadow remains one edition, and source review is not due until 21 September ~02:00 UTC. Current source errors are five existing HTTP 403 restrictions; no restriction bypass or forced retry. The previously observed Hacker News fetch failure has cleared. No application/worker change or new deployment this checkpoint; production remains implementation `9d6ea0e`, verified at the previous deployment. All open implementation and acceptance gates remain as documented above; no model/ranking promotion or completion claim.

### 20 September 08:30 UTC — publication and throughput checkpoint

The 07:57 UTC edition published at 07:57:27.735, passing the two-minute SLA after the analytics/ledger/retry increments. Public health independently reports the new edition. Diversity shadow now has two editions (latest observation 08:00); its seven-day gate remains pending until at least 27 September 02:05 UTC.

381 processing samples through 08:30 UTC; all four News services active, supervisor healthy, candidate unloaded. Eligible briefings declined to 178 (all unknown legacy enqueue times; none current-day), translations zero. Stage coverage: 338 briefing archive/persist, 316 generation/validation, 121 translation generation/validation. Conditional telemetry: 1,095 HTTP 304s of 2,343 successful checks, 643,812,534 body bytes; no controlled savings claim. Latest SMTP report 08:29 passes host-origin probes. Real provider events remain zero. Current source errors are three HTTP 403 restrictions (Endpoints, IMF, STAT); no restrictions bypassed or forced retries. Expanded-source assessment remains due after 21 September ~02:00 UTC.

Code inspection confirms supervisor headline counters summarize only the most recent 1,000 event records, not lifetime totals; legacy records may mix benchmark/production traffic and failed events omit mode. Do not interpret the displayed 979/21 as production success/failure rates. Separating these cohorts and labeling the sample window remains an observability follow-up. Supervisor `load_seconds` measures preparation/lock overhead for the externally managed baseline, not an observed baseline cold load. These limitations prevent claiming full stage-timing acceptance. No runtime code/model/ranking changes or deployment in this checkpoint; production remains `9d6ea0e`. Remaining dependency, full-body-policy and observation gates stay open.

### 20 September 09:30 UTC — model telemetry cohorts

Implemented explicit production-only successful/failed call counts and inference median, with benchmark and unknown-origin event counts excluded and displayed separately. Reports identify the latest-1,000-event window and its observed timestamps. Legacy telemetry falls back to an explicit mixed-sample label. Cache hits are not supervisor calls; unknown-origin failures still prevent a complete production failure rate. The supervisor is unchanged, so legacy/unclassified failure events are not guessed into production. No model routing change.

Three Python regression tests cover mixed cohorts, bounded windows, empty history and invalid timing values. All 64 TypeScript tests and production build pass. Compatible API/UI deployment precedes the telemetry-only worker activation; inference services require no restart. Full cold-load separation and dependency admission remain unresolved.

At 09:30: eligible briefings 155, all legacy enqueue timestamps unknown and none current-day; no translations waiting. All four News services active, candidate unloaded. SMTP telemetry fresh and both host-origin probes pass. Conditional counts: 1,287 HTTP 304s / 2,731 successes, 731,160,975 body bytes; no controlled savings claim. Latest edition remains the passing 07:57 publication. No real signed provider events, two shadow editions; 24-hour source and seven-day shadow gates remain pending.

Deployment verification: `8f3d260` pushed to main; production deployment `bittrees-news-oxbq614k9-bittrees-tech.vercel.app` passed live health. Only the News telemetry service restarted after API readiness; all four News services remain active and three Python tests passed on Acer. The 09:33 report arrived with a 1,000-event window (19 September 18:05 to 20 September 09:32): 980 successful production calls, zero explicitly classified production failures, 20 unknown-origin events and no benchmark events in this particular window. The 20 unknowns prohibit interpreting zero classified failures as a zero failure rate. Source/observation/dependency and cold-load acceptance gates remain open.

### 20 September 10:31 UTC — revision supersession

Investigated one new missing-outcome observation: its 09:49 briefing claim was replaced at 10:01 with a different evidence revision, and the replacement generated/archived successfully. This supports revision replacement rather than an unresolved backlog failure; the original observation is preserved.

New claims now atomically mark unfinished older claims for the same task/artifact as superseded when the evidence revision differs. Completed/retried/deferred history is preserved; same-revision retries and other tasks/artifacts are excluded. Replaying any existing claim cannot supersede newer work. Admin labels identify the event as “Superseded by newer evidence.” This increment records replacement lineage at admission; it does not constitute the complete dependency-state migration. Historical events are not fabricated or erased.

PostgreSQL regression covers revision changes, same-revision retries, old/new claim replay, task/artifact isolation and completed history. Existing real-claim fairness/rollback tests pass; all fixtures remain inside rollback transactions. All 64 unit tests and production build pass. Schema deployment precedes API code.

At 10:30: eligible briefing backlog 132, all legacy enqueue times unknown and none current-day; no translations waiting. All four News services active, candidate unloaded. SMTP report 10:28 passes both host-origin probes; model sample explicitly shows 19 unknown events, not a zero-failure claim. Feed telemetry: 1,480 HTTP 304s / 3,122 successful checks, 823,628,028 body bytes. Source errors remain HTTP 403 for Endpoints and IMF; no bypass. Latest publication is still the passing 07:57 edition; next due 11:57. No signed delivery events, two shadow editions. All longer observation and outstanding implementation gates remain open.

Deployment verified: implementation `3e51dec` pushed to main, deployed via `bittrees-news-120zx1szj-bittrees-tech.vercel.app` to the production alias after the compatible schema migration. Public health passed; signed-out admin processing returns 401. No worker restart, forced source fetch, regeneration or email was triggered. New supersession events await naturally occurring revised claims; historical missing-outcome observations are retained.

### 20 September 11:32 UTC — post-deployment observation

Production now records six natural supersession events, confirming replacement-claim lineage is active after `3e51dec`; missing-outcome observations remain 78, including previously documented historical/revision gaps. Eligible briefing backlog at 11:30 is 109, all legacy enqueue times unknown and none current-day; no translations wait. All four News services are active; supervisor healthy with no managed candidate. Stage coverage: 498 briefing archive/persist, 468 generation/validation, 205 translation generation/validation. Queue p95 includes older work and deferrals, not just current-story latency.

Collection counters: 1,676 HTTP 304s of 3,511 successes, 912,203,647 body bytes; no controlled bandwidth-savings claim. Source failures remain the existing Endpoints and IMF HTTP 403 restrictions; no bypass or forced retry. SMTP telemetry is fresh at 11:28 with both host-origin probes passing. Real delivery events remain zero; normal noon delivery has not occurred yet. Two shadow editions; source review and seven-day comparison remain premature. Latest edition remains the passing 07:57 publication, with the next due 11:57 UTC. Public health verified. No code, worker, routing or deployment change this checkpoint; all previously documented acceptance and implementation dependencies remain open.

### 20 September 12:33 UTC — noon publication and delivery validation

The 11:57 edition published at 11:57:27.170 UTC, within the two-minute target. Shadow now has three editions, still short of its seven-day gate. Two normal scheduled delivery rows were created at 12:00 and marked sent with provider IDs by 12:00:43.805. These represent provider acceptance only. Signed provider events remain zero, so delivered/deferred/bounced outcomes cannot be verified from the receiver. No test or duplicate email was sent.

Inspected the existing Brave window without closing/restarting anything and opened a new Resend webhook tab. Resend redirected to its login page. Requested that the user sign in; provider-admin inspection is waiting for that session. The existing send-only key cannot administer the webhook. No credentials were requested/exposed and no permission/security controls were bypassed. Other monitoring and implementation work can continue independently.

At 12:30: 104 eligible briefings (101 unknown legacy enqueue times, four current-day, oldest known wait ten minutes); one newly queued translation. Four News services active, supervisor healthy and candidate unloaded. Stage samples: 544 briefing archive/persist, 512 generation/validation, 249 translation generation/validation. Supersession events eight; missing-outcome observations unchanged at 78. Feed counters: 1,866 HTTP 304s / 3,900 successful checks, 1,000,664,505 body bytes; not a controlled savings comparison. SMTP telemetry fresh at 12:28, both host-origin probes pass. Existing IMF/Endpoints HTTP 403 restrictions persist without bypass. No runtime deployment; production remains `3e51dec`. Public health passed. Source review, seven-day comparison, provider session and previously listed implementation gates remain open.

### 20 September 13:33 UTC — observation checkpoint

Eligible briefings declined to 85 at 13:30, all legacy enqueue timestamps unknown and none current-day; no translations wait. Four News services active, supervisor healthy, candidate unloaded. Eight supersession observations and 78 deadline-without-report observations remain unchanged. SMTP telemetry is fresh at 13:28 with both host-origin probes passing. No signed provider events have arrived; Resend sign-in requested at the prior checkpoint remains an external dependency, without another login request or test email.

Collection counters: 2,054 HTTP 304 responses / 4,287 successes, 1,096,414,430 response-body bytes. These are cumulative instrumentation counts, not a controlled savings measure. An intermittent Hacker News fetch failure is present again alongside the existing Endpoints/IMF HTTP 403 restrictions; retain normal backoff and do not bypass restrictions. Latest edition remains the passing 11:57 publication; next due 19:57 UTC. Public health passes. Shadow has three editions; source review and seven-day gates are not due. No code/deployment/model/ranking changes this checkpoint; production remains `3e51dec`. Outstanding implementation and acceptance gates remain open.

### 20 September 14:34 UTC — revision-specific queue age

Investigated a reported 585-minute oldest known wait: this briefing was originally queued at 04:45 and archived at 04:48, then requeued after new evidence at 14:20. The old timestamp included hours when no processing was pending. Collection now resets enqueue time when a known content revision changes. Unchanged content and retries preserve the wait; first-time legacy content-key initialization preserves unknown/original history rather than fabricating a date. No historical timing samples or existing queued revisions are rewritten, so older aggregate queue percentiles may include this prior overstatement.

Regression uses the real storeItems function with rollback-local LIKE fixtures, checking changed evidence invalidation and clock reset, unchanged evidence, retry age/attempt preservation and unknown legacy timestamps. The new database check, all 64 unit tests and production build pass. This improves revision admission/fair aging measurements but does not complete capacity/dependency admission.

At 14:30: 73 eligible briefings, 64 unknown legacy timestamps, eight current-day; two translations waiting up to ten minutes. Four News services active; supervisor healthy and candidate unloaded. SMTP report 14:28 passes both host-origin probes. Stage coverage 649 briefing archive/persist, 612 generation/validation, 307 translation generation/validation. Eight supersessions and 78 missing-report observations unchanged. Conditional counters 2,262 HTTP 304s / 4,719 successes, 1,196,307,943 body bytes; no controlled savings claim. Only existing Endpoints/IMF HTTP 403 errors remain; intermittent Hacker News error cleared. Latest publication remains passing 11:57; no provider events, three shadow editions. Provider sign-in and the previously listed implementation/observation gates remain pending.

Deployment verified: `deb3280` pushed to main and deployed to the production alias via `bittrees-news-knjkxg23q-bittrees-tech.vercel.app`; live health passed. Zero temporary fixture tables remain. No worker restart or historical rewrite. Natural future evidence revisions use the corrected clock; prior aggregate timing limitations and all remaining acceptance gates are retained.

### 20 September 15:36 UTC — observation checkpoint

At 15:35, eligible briefing backlog is 44 (40 unknown legacy enqueue times, four current-day with known waits under a minute); four newly queued translations also wait under a minute. Stage samples cover 706 briefing archive/persist, 664 generation/validation and 331 translation generation/validation. Eight supersession events and 78 deadline-without-report observations remain unchanged. Recent queues no longer show the prior 585-minute revised-item wait; historical timing percentiles retain the documented limitations.

All four News services active; supervisor healthy, candidate unloaded. Latest collection: 79 successes, no failures, 61 unchanged bodies in 12 seconds. Conditional counters: 2,469 HTTP 304s / 5,143 successes, 1,310,260,665 body bytes; no controlled savings claim. Existing Endpoints/IMF HTTP 403 restrictions persist without bypass. SMTP report at 15:33 passes both host-origin probes. Model telemetry retains 19 unknown-origin events and cannot establish a complete failure rate. No signed provider events; provider-admin work still awaits the previously requested Resend sign-in. Three shadow editions; source and seven-day assessments are not due. Latest edition remains the passing 11:57 publication; next due 19:57 UTC. Public health passed. No deployment/worker/model/ranking changes; production remains `deb3280`. All outstanding implementation and acceptance gates remain open.

### 20 September 16:37 UTC — observation checkpoint

At 16:35, eligible briefing backlog is 22 (16 unknown legacy enqueue timestamps and six newly queued current-day items); six new translations are eligible with known waits under a minute. All four News services active; supervisor healthy, candidate unloaded. Eight supersessions and 78 deadline-without-report observations remain unchanged. Translation review transitions total nine versus four at the prior checkpoint; these are accumulated transition counts, not a quality rate, and no bulk retry/promotion is triggered.

Latest collection: 79 successes, zero failures, 59 unchanged bodies in 12 seconds. Conditional counters: 2,663 HTTP 304s / 5,534 successes, 1,400,428,316 body bytes, without a controlled savings claim. Endpoints/IMF HTTP 403 restrictions persist; no bypass. SMTP telemetry fresh at 16:33 with both host-origin probes passing. No real provider webhook events; the existing Resend sign-in request remains pending. Three shadow editions; source and seven-day gates are not due. Latest publication remains passing 11:57, next due 19:57 UTC. Public health passed. No runtime/model/ranking/reader-refresh change; production remains `deb3280`. All outstanding acceptance and implementation gates remain open.

### 20 September 17:38 UTC — eligible legacy backlog cleared

The 17:35 sample has only two newly queued public briefings and two translations, each with known waits under a minute; no eligible legacy records remain. A direct follow-up database check finds no public briefings eligible, in progress or in retry backoff. However, 52 unarchived public briefings remain in exhausted-attempt review (47 with unknown legacy enqueue timestamps). Therefore this is clearance of runnable briefing work, not completion of all articles or proof that every older item succeeded. No review items were reset, discarded or mass-regenerated.

All four News services active; supervisor healthy and candidate unloaded. Eight supersession events and 78 deadline-without-report observations unchanged. SMTP telemetry fresh at 17:34 with both host-origin probes passing. Latest collection: 79 successes, no failures, 63 unchanged bodies in 13 seconds. Conditional counters: 2,859 HTTP 304s / 5,923 successes, 1,498,956,027 body bytes; not a controlled savings comparison. Intermittent Hacker News fetch failure and Federal Reserve production HTTP 404 recur alongside existing Endpoints/IMF HTTP 403 restrictions; preserve backoff without bypass. The expanded-source review remains due after 21 September ~02:00 UTC.

Public health passed; latest edition remains passing 11:57, next due 19:57 UTC. No signed provider events, three shadow editions; prior Resend sign-in request remains pending. No application or worker changes/deployment this checkpoint; production remains `deb3280`. All observation and outstanding implementation gates remain open.

### 20 September 18:39 UTC — observation checkpoint

The 18:35 sample contains six newly queued briefings and six translations, all current-day with known waits under a minute and no eligible legacy backlog. All four News services active; supervisor healthy, candidate unloaded. Eight supersessions and 78 deadline-without-report observations unchanged; review transitions continue to be retained without bulk retry. SMTP report fresh at 18:34 and both host-origin probes pass.

Latest collection: 79 successes, no failures, 60 unchanged bodies in 12 seconds. Conditional counters: 3,047 HTTP 304s / 6,309 successes, 1,587,625,820 body bytes; no controlled savings claim. Existing intermittent Hacker News fetch failure, Federal Reserve production 404 and Endpoints/IMF 403 restrictions persist with normal backoff. Public health passes; latest edition remains passing 11:57, next due 19:57 UTC. No signed delivery events; Resend sign-in request remains pending. Three shadow editions; source-review and seven-day gates are not yet due. No application/worker/model/ranking change or deployment this checkpoint; production remains `deb3280`. Outstanding implementation and acceptance gates remain open.

### 20 September 19:42 UTC — pre-publication checkpoint

At 19:40, one new briefing and one translation are eligible, both current-day with known waits under a minute; no eligible legacy backlog. Four News services active, supervisor healthy, candidate unloaded. Eight supersessions and 78 deadline-without-report observations unchanged. Translation review transitions now total 16, retained for review without bulk retries or any quality/promotion claim. SMTP telemetry fresh at 19:39, both host-origin probes passing.

Latest collection: 52 successes, no failures, 46 unchanged bodies in nine seconds. Conditional counters: 3,268 HTTP 304s / 6,751 successes, 1,695,526,441 body bytes; no controlled savings claim. Hacker News and Federal Reserve currently have no recorded source errors; existing Endpoints/IMF HTTP 403 restrictions remain without bypass. Public health passes. The evening 19:57 edition is not due yet; latest passing edition remains 11:57. Three shadow editions, zero signed delivery events; Resend sign-in dependency remains pending. Source review remains due after 21 September ~02:00 UTC, seven-day assessment after 27 September 02:05 UTC. No code/worker/model/ranking changes or new deployment; production remains `deb3280`. Outstanding implementation and acceptance gates remain open.

### 20 September 20:43 UTC — three daily publication cycles passed

All three 20 September editions published within the two-minute target: 07:57 at +27.735 seconds, 11:57 at +27.170 seconds, and 19:57 at +27.740 seconds. Public health independently confirms the evening edition. These are three successful daily cycles while the rollout proceeded, not three cycles after every individual deployment. Optional processing did not prevent these scheduled publications. Shadow now has four editions; the seven-day gate remains pending until at least 27 September 02:05 UTC.

Latest sample at 20:41: 17 newly queued briefings (14 current-day, none with unknown enqueue times) and 14 translations, all known waits under a minute. Four News services active, supervisor healthy, candidate unloaded. Eight supersessions and 78 deadline-without-report observations unchanged. SMTP telemetry fresh at 20:39 with both host-origin probes passing. Latest collection: 53 successes, no failures, 46 unchanged bodies in ten seconds. Conditional counters: 3,466 HTTP 304s / 7,140 successes, 1,785,494,913 body bytes; no controlled savings claim. Existing Endpoints/IMF HTTP 403 restrictions persist without bypass.

No signed provider events; prior Resend sign-in request remains pending. Expanded-source review is due after 21 September ~02:00 UTC. Review queues, common dependency/capacity admission, permitted full-body policies and complete timing/quality acceptance remain unresolved. No code/worker/model/ranking changes or deployment this checkpoint; production remains `deb3280`. This publication milestone does not complete either plan or authorize model/ranking promotion.

### 20 September 21:44 UTC — observation and translation triage

At 21:40, three newly queued briefings and three translations are eligible, all current-day with known waits under a minute. Four News services active, supervisor healthy and candidate unloaded. Eight supersessions and 78 missing-report observations unchanged. SMTP report 21:39 passes both host-origin probes. Collection: 52 successes, one failure, 45 unchanged bodies in 13 seconds. Conditional counters: 3,660 HTTP 304s / 7,531 successes, 1,883,028,823 body bytes; no controlled savings claim. Intermittent Hacker News fetch failure recurred; Endpoints/IMF restrictions persist.

Inspected bounded translation-worker logs after review transitions rose to 22. Logs show local ValueError failures following cache hits, alongside an isolated HTTP 502 and later successful translations. The worker uses ValueError for invalid size, insufficient English confidence and unchanged source text; logs do not distinguish these causes. This supports a follow-up to preserve bounded failure categories and review cache-validation handling; it does not establish a factual quality rate or justify weakening validation, mass cache deletion or bulk regeneration. No failed output is published or recreated for this check.

Public health confirms the passing evening edition. Four shadow editions; no signed provider events and prior Resend sign-in request still pending. Source review after 21 September ~02:00 UTC and seven-day comparison remain premature. No runtime/deployment/model/ranking change; production remains `deb3280`. All outstanding implementation and acceptance gates remain open.

### 20 September 22:44 UTC — bounded translation diagnostics

Added content-free translation failure categories and claim/translate/persist phase labels to worker logs. Categories distinguish invalid size, insufficient English confidence, unchanged text, truncated model output, malformed JSON, language detection, transport/HTTP errors and stale persistence leases. Unknown failures remain unclassified; no exception message/source text is logged. Existing validation thresholds, retry/backoff behavior, cached outputs and review states are unchanged. These labels support subsequent bounded diagnosis; they do not repair or certify existing failed outputs.

Three Python regressions cover exact validation categories, HTTP phase handling, malformed JSON and omission of exception content. Worker compilation passes. No website/database change is needed; the existing 64-test web validation remains the prior deployment's result, not newly rerun for this Python-only increment. Targeted worker deployment follows the commit.

At 22:40: four newly queued briefings and four translations, current-day waits under a minute, no unknown enqueue times. Four services active, candidate unloaded. SMTP telemetry fresh at 22:39, both probes passing. Collection: 52 successes, zero failures, 44 unchanged bodies in ten seconds. Counters: 3,855 HTTP 304s / 7,919 successes, 1,989,763,116 body bytes; no controlled savings claim. Existing Endpoints/IMF 403 restrictions remain. No provider events; four shadow editions. Source review and seven-day gates remain premature; prior Resend sign-in request and remaining processing/quality dependencies stay open.

Worker deployment verified: `94ad389` pushed to main; translation files copied to Acer and three tests plus compilation passed in its actual translation environment. Database inspection showed zero active translation claims immediately before restarting only `bittrees-news-translation`. All four News services remain active, supervisor healthy and candidate unloaded; public health passed. Website deployment remains `deb3280` because this increment changes worker diagnostics only. Historical failures remain unclassified and no production failure was deliberately induced to populate the new labels. All remaining acceptance gates stay open.

### 20 September 23:44 UTC — worker follow-up

The diagnostic worker remains active and has processed subsequent public translations successfully; the inspected recent log tail contains successful translation/inference entries, without needing a deliberately induced failure. New failure categories still require naturally occurring samples before drawing a category distribution. All four News services active, supervisor healthy and candidate unloaded.

At 23:40, three current-day briefings wait up to five minutes and two new translations wait under a minute; no eligible unknown-enqueue legacy backlog. Eight supersessions and 78 missing-report observations unchanged; translation review transitions remain 23. SMTP report fresh at 23:39 with both host-origin probes passing. Latest collection: 52 successes, zero failures, 46 unchanged bodies in 11 seconds. Conditional totals: 4,049 HTTP 304s / 8,308 successes, 2,076,177,672 body bytes; no controlled savings claim. Intermittent Hacker News fetch failure and existing Endpoints/IMF restrictions persist with normal backoff.

Public health confirms the passing evening edition. Four shadow editions, zero signed provider events. The clock is still 20 September UTC despite the local Lisbon date change; the 24-hour source assessment remains due after 21 September 02:00 UTC. Seven-day comparison and prior Resend sign-in request remain pending. No new runtime changes/deployment; website `deb3280`, diagnostic worker `94ad389`. All other implementation and acceptance gates remain open.
