# Processing rollout — 19 September 2026

## Installed / implemented

- Five-minute public collection with per-source due times, exclusive leases, content-hash reuse and failure backoff.
- Versioned public job envelopes, evidence revision identifiers, bounded leases and stale-result rejection.
- Admin processing dashboard and five-minute historical queue/publication samples, retained for 30 days.
- Local model registry with exact SHA-256 identity; role routing rejects unapproved candidates.
- Independent model supervisor: loopback-only endpoint, managed-child lifecycle, a 3 GB available-memory reserve plus model allowance, health checks, five-minute idle unload, exclusive News inference, and no authority to stop the existing system model service.
- Cache identity includes model digest, quantization, task, request, prompt and schema version. Disposable cache retention is 30 days / 5,000 entries.
- Isolated benchmark runner and 42 frozen cases, including ten non-English cases, evidence revision and prompt injection. Raw fixtures and outputs are ignored by Git and excluded from Vercel uploads.
- Separate bounded telemetry relay; supervisor/benchmark enforce Linux Landlock filesystem allowlists without access to the News credential file; the benchmark verifies that denial at startup. Benchmark service uses a Unix socket and permits only AF_UNIX sockets; it cannot open Internet sockets.

## Models

Production remains Qwen3.5 2B Q4_K_M, treated as externally managed. Candidate: official Qwen3 0.6B Q8_0 (639,446,688 bytes), pinned Hugging Face revision `23749fefcc72300e3a2ad315e1317431b06b590a` and verified SHA-256. Candidate results cannot publish or trigger delivery. Bonsai 2 remains a potential separate-host experiment; it is not silently installed or promoted on the constrained Acer.

## Gates still open

- Full-day baseline and three scheduled publication cycles after this rollout.
- Paired 42-case evaluation and Codex source-evidence review are complete; both tested configurations failed. An improved task/prompt/validation configuration needs a new isolated evaluation before any promotion. Schema validity and number matching alone cannot approve a model.
- Broader validation before a small production canary; no automatic candidate promotion.
- Unified persistent task-state migration, dependency heartbeat support and fair aging/deadline scheduling beyond the current priority/lease implementation.
- Complete permitted source-body acquisition and its source-by-source policy review. Existing generated pages remain labeled Summary and link to the full source article.
- Browser-state preservation inspection when computer-use access is available.

## Operations

Registry: Acer `~/.config/bittrees-news/models.json` (no tokens). Supervisor port 8092; managed candidate port 8093. Existing baseline port 8081 is unchanged. Model services and binaries are configured locally, never through a public job.

Benchmark fixtures/results: `~/.local/state/bittrees-news/benchmark/`. Results have `human_review: pending`; review them before any routing change. The benchmark resumes completed cases without repeating them. It is a one-shot service bounded to 24 hours, not a recurring publishing task.

New service names: `bittrees-news-models`, `bittrees-news-model-report`, `bittrees-news-benchmark`. Production workers were switched at an idle inference boundary at 01:02 UTC to the supervisor; approved model routing remains Qwen3.5 2B. The benchmark service is active and waits behind public translation/inference work. Its startup checks confirmed that Internet sockets and the News credential file are inaccessible. A saved copy of editor configuration permits routing rollback without changing source data or editions.

Tests: TypeScript suite, Python registry/locking suite, database processing/collection integration checks, and live health/access checks. Follow-up checks must update this document with actual benchmark and cycle results; do not mark all phases complete from startup alone.

## Continuation

An hourly Codex follow-up, “Complete TBN processing rollout,” continues implementation and evaluation while honoring the full-day and three-cycle gates. It reports meaningful results only and must pause on completion or required user input. Initial measurement window began around 00:50 UTC on 19 September; do not claim a full-day baseline before 20 September.

Web deployment: `b61b7fc` (processing dashboard, telemetry, public job envelopes), live at news.bittrees.org. API check confirmed unauthenticated processing access returns 401. Model telemetry has been received. Tests: 48 TypeScript, six Python, database collection and processing checks passed. No candidate output has been published.

## 19 September, 01:55–02:00 UTC follow-up

- Database observations cover 00:50–01:55 UTC (14 five-minute samples). No post-rollout scheduled publication has occurred yet; the last three prior editions were about 29 seconds late. The full-day and three-new-cycle gates remain open.
- Supervisor, telemetry, benchmark, translation and story workers were active. Available memory was about 8.4 GiB with no swap used at inspection.
- The first benchmark run was not a usable paired comparison: all 42 candidate calls failed during launch with `PermissionError`. A sandbox reproduction identified an attempted open of `/dev/null` by `subprocess.DEVNULL`; inference never started for those candidate cases. Baseline results also included malformed JSON and transport failures. Do not count launch failures as a candidate quality score or infer speed from successful calls alone.
- Fixed managed-model startup to write diagnostics to a state-directory file, truncated on each launch, with routine llama logging disabled. This retains the filesystem sandbox and credential denial. Seven Python tests passed on Acer's production Python, including a regression test for startup output handling. The workstation's older Python lacks `hashlib.file_digest`, so the production-runtime suite is the relevant verification.
- Restarted only the News supervisor at an idle inference boundary; the shared baseline model service was untouched. Preserved the original benchmark results under a timestamped `results-before-launch-fix-*.jsonl` filename and started a fresh paired run at 01:58 UTC. Startup checks again verified that Internet sockets and News credentials are inaccessible. Candidate launch/inference success still requires observation; no candidate has been promoted.
- Preliminary inspection of baseline outputs found factual concerns despite valid JSON: one summary merged a motorcycle strike with separate refugee-camp attacks; another invented the missing end of a truncated mainnet-release condition; a podcast slogan was interpreted as event content. These examples prevent treating schema success as quality acceptance. Complete comparative factual review and improved evidence handling remain required. Raw outputs remain local, unpublished, and marked pending review.

## Reader-controlled refresh — 19 September

The user superseded the live-refresh requirement: an open newspaper must remain stable. Public health polling, translation polling, rolling-window timers and feedback-triggered reranking are removed. Read/save/vote writes still persist; newly read cards stay in place until an explicit hide-read action or refresh. Search and deliberate filters still operate immediately. A Refresh stories button loads current content and rankings. Future processing rollout changes must preserve this behavior.

## 19 September, 02:56–03:00 UTC follow-up

- The candidate launch fix is confirmed: Qwen3 0.6B completed all 42 benchmark cases. 39 returned structurally valid output (92.86%); three produced JSON parsing failures. Timed cases had a 5.49-second median and 34.132-second p95. These timings exclude untimed failures and busy deferrals and are not end-to-end throughput evidence.
- **Candidate rejected for the proposed general summary/translation role.** Evidence review covered the ten synthetic non-English cases, injection and revision cases: nine of twelve failed. Portuguese, Spanish, German, Italian and Polish summaries remained in their source language. Japanese, Chinese and Arabic cases invented weather dates/times/temperatures or probabilities. The injection case repeated the malicious cure claim as a study claim. French, Dutch and the economic revision case preserved the tested facts. The other 30 candidate cases remain unreviewed; these failures already preclude promotion.
- Review evidence is stored only on Acer in `benchmark/quality-review.json`, labeled as Codex evidence comparison, not human review. Original raw results are preserved. The report now separates structural validity, reviewed failures, unreviewed cases and timing coverage, and cannot approve production. Nine Python tests passed on Acer, including regression checks that valid JSON cannot override a failed quality review.
- Baseline at the later inspection: 34/42 completed, 26 structurally valid, five JSON errors and three transport errors. The baseline benchmark remains running and needs complete quality review; its production routing remains unchanged. The comparison uses the benchmark prompt, so these rates must not be reported as production failure rates.
- All five inspected News services were active. Available memory was approximately 5.2 GiB, with 6 MiB swap in use; this single observation does not establish memory-pressure safety or failure.
- Database samples cover 00:50–02:55 UTC (26 samples). No new scheduled edition has run since rollout; full-day and three-cycle gates remain open. Reader-controlled refresh is preserved.
- Next: finish baseline evidence review and investigate bounded output/prompt failures before changing any production summarization route. Keep the candidate isolated; do not start a canary with this failed configuration. Durable task-state/dependency work and permitted full-source evidence acquisition remain open.

## 19 September, 03:56–04:00 UTC follow-up

- Paired benchmark completed at 03:02 UTC; its one-shot service exited successfully (status 0). Both models have 42 attempts. Baseline: 34 structurally valid, five JSON errors and three transport errors; timed-only median 12.81s, p95 102.516s. Candidate counts remain 39/42. Neither result supports a production promotion.
- Reviewed the baseline's ten language cases plus injection/revision: eight of twelve failed. Three summaries remained non-English; Japanese, Chinese and Arabic cases invented material facts; one limitations field contradicted the supplied rainfall evidence; the injection summary repeated an injected assertion even though its limitations rejected it. Four cases preserved the tested facts. These are benchmark-prompt findings, not measured production error rates. Thirty ordinary cases per model still await full review. Review records remain private on Acer and identify Codex as the reviewer.
- Found and fixed a managed-model lifecycle bug: requests to the external baseline were resetting the candidate's idle timer, keeping an unused model resident indefinitely. Only requests to a managed model now update that timer. Regression tests cover successful and failed baseline requests; all ten Python tests passed on Acer.
- Activated the supervisor fix at an idle inference boundary. Only its own managed candidate was unloaded; the shared `local-ai` service was not restarted. Supervisor health now reports `managed_model: null`; shared baseline, supervisor, translation and story workers are active. The completed benchmark was not restarted.
- Database sample window: 00:50–03:55 UTC, 38 samples; no post-rollout scheduled publication yet. Latest queue sample: translations 816 done, 23 failed, 12 pending; summaries 182 archived, 858 pending, four in review. These are total queue counts, not failures attributable to this rollout.
- Full-day/three-cycle gates remain open. Next implementation should strengthen evidence completeness and output validation before any expanded generative role, while keeping collection/publication independent of optional inference and preserving reader-controlled refresh. Durable common task states, fair scheduling and source-policy-backed full bodies remain outstanding.

## 19 September, 04:57–05:00 UTC follow-up

- News supervisor, telemetry, translation and story services are active. Completed benchmark remains successful and stopped; candidate remains unloaded. No model promotion or new benchmark run.
- Fifty processing samples span 00:50–04:55 UTC. No post-rollout scheduled publication yet; last published edition remains 18 September 19:57, published approximately 29 seconds after schedule. Full-day and three-cycle gates remain open.
- Added explicit provenance to newly saved summary artifacts: evidence kind (feed excerpt, episode description, structured observation, or title only), partial/unavailable completeness, `not-acquired` full-text status, nullable source language, retrieval timestamp when known, and a revision hash. Long feed text cannot imply full-text permission or completeness. Existing artifacts are not regenerated or re-pinned.
- Standalone pages now show the evidence kind and known retrieval time, including a clear distinction between a podcast description and a transcript or a snapshot and a complete dataset. Unknown language stays unknown. This is an evidence-labeling foundation, not completed full-body acquisition or factual validation.
- Validation: 56 TypeScript tests, production build, and database checks for unchanged-content reuse, source-change invalidation, stale leases and busy deferrals passed. Change commit: `9afc635`. Source-policy review/full-body acquisition, stronger grounding checks, durable task states and fair scheduling remain open. Reader-controlled refresh remains intact.

## 19 September, 05:57 UTC observation

- All four production processing services checked are active; supervisor health is good and no candidate is resident. The isolated benchmark remains completed successfully, with its previously recorded quality failures unchanged.
- Sixty-two samples now span 00:50–05:55 UTC. The first post-rollout scheduled publication is still upcoming at 07:57 UTC; no missing cycle is implied by the unchanged 18 September 19:57 edition.
- No model, worker or website changes in this check. Continue gathering the required baseline before expanding the durable task-state rollout. Full-day, three-cycle, complete ordinary-case review, grounding and source-policy/full-body work remain unresolved.

## 19 September, 06:57 UTC observation

- Production supervisor, telemetry, translation and story workers remain active. Supervisor reports no resident candidate. Completed benchmark status remains successful; quality gate remains failed for both tested configurations.
- Seventy-four samples cover 00:50–06:55 UTC. First new scheduled publication remains due at 07:57 UTC; latest published edition is still the previous evening's edition, as expected.
- Latest sampled queues: translations 892 done, 31 failed and none pending; summaries 353 archived, 723 pending, one working and ten in review. These aggregate counts reflect ongoing collection and processing; they are not benchmark quality rates. No retries or bulk regeneration were triggered.
- No routing or deployment changes. Full-day/three-cycle gates, remaining ordinary-case evidence review, stronger grounding validation, durable task-state work and source-policy/full-body acquisition remain open.

## 19 September, 07:57 UTC — first publication gate

- First post-rollout edition scheduled for 07:57 UTC published at 07:57:27.779 UTC, a 27.779-second delay. This passes the proposed two-minute publication target: **one of three new scheduled cycles observed**. Upcoming checks are 11:57 and 19:57 UTC; the full-day window still cannot complete before 20 September 00:50 UTC.
- Eighty-six five-minute samples span 00:50–07:55 UTC. Supervisor, telemetry, translation and story workers are active. Supervisor health reports no resident candidate; benchmark remains completed successfully with recorded quality failures and no promotion.
- No model, worker or website changes were made for this check. Publication succeeded without waiting for the remaining optional summary backlog. Remaining gates and implementation work listed above stay open; this single successful edition does not complete the rollout.

## 19 September, 09:00 UTC observation and evidence review

- Ninety-nine samples span 00:50–09:00 UTC. Latest publication remains the passing 07:57 cycle; one of three publication gates is complete. Four production services are active, supervisor is healthy, candidate is unloaded, and benchmark remains completed. Full-day gate is still open.
- Reviewed three more ordinary fixtures for both models (six source/output comparisons). Findings include sponsor copy turned into talk themes or event participation, a station slogan treated as event content, source claims incorrectly called speculative, and an unsupported product-launch assertion. These add evidence-handling failures to the existing rejected configurations; no new model promotion decision is needed.
- Private review records now cover 15 cases per model, with 27 ordinary cases per model still awaiting review. No benchmark outputs were published, no production route changed, and no retry or re-pinning was triggered. Remaining implementation and observation gates are unchanged.

## 19 September, 10:02 UTC observation and evidence review

- Production processing services remain active; supervisor is healthy with no managed model resident. Benchmark remains completed. 111 samples cover 00:50–10:00 UTC; latest publication remains the passing 07:57 edition (one of three required cycles).
- Reviewed the next three ordinary fixtures for both models. The smaller model preserved the strike headline but the baseline merged casualties into separate attacks. The smaller model reversed an attribution in the AI incident report and invented a nondisclosure rationale; the baseline had no parseable output for that case. Both gaming summaries preserved the core supplied facts, with noted limitations. Six comparisons were saved privately on Acer.
- Eighteen cases per model have now been reviewed; 24 ordinary cases per model remain. Existing failed promotion decisions stand. No model, website, collection, publication or delivery changes were made. Full-day observation and all previously listed implementation gates remain open.

## 19 September, 11:03 UTC observation and evidence review

- 123 samples span 00:50–11:00 UTC. Production processing services remain active, supervisor healthy, candidate unloaded and benchmark completed. Latest published edition remains the passing 07:57 cycle; second cycle is due at 11:57 UTC.
- Reviewed the next three ordinary cases for each model. Both soybean summaries added unsupported evidentiary or mechanistic framing; the baseline reversed the purpose of a climate lawsuit. The candidate climate summary and both sparse blog summaries preserved the tested source claims. Review notes are stored privately, with no artifact publication.
- Twenty-one cases per model are reviewed; 21 ordinary cases per model remain. Failed model-promotion decisions stand. No production changes or bulk retries were made. The full-day/three-cycle gates and previously listed implementation work remain open.

## 19 September, 12:04 UTC — second publication gate

- The 11:57 edition published at 11:57:27.210 UTC, 27.210 seconds after schedule. **Two of three new scheduled cycles now pass** the two-minute target. Next publication gate is 19:57 UTC; full-day observation remains due no earlier than 20 September 00:50 UTC.
- 135 samples span 00:50–12:00 UTC. Production processing services remain active, supervisor healthy, candidate unloaded and benchmark completed. No model promotion, retries, test delivery or pipeline change was triggered.
- Reviewed three additional ordinary fixtures for both models. Fire summaries preserved the supplied facts, whereas both Polygon summaries invented missing mainnet prerequisites. The candidate health summary preserved attributed participation statuses; the baseline strengthened a signing deadline into an unqualified requirement. Notes are private on Acer.
- Twenty-four cases per model are reviewed, with 18 ordinary cases per model remaining. Existing failed promotion decisions and outstanding grounding, durable task-state, source-policy/full-body and observation gates remain open.

## 19 September, 13:04 UTC observation and evidence review

- 147 samples cover 00:50–13:00 UTC. Four production services are active, supervisor healthy with no candidate resident, and benchmark remains completed. Latest edition is the passing 11:57 cycle; two of three publication gates remain passed.
- Reviewed the next three ordinary fixtures for each model, checking the longer quantum fixture against the exact first 5,000 characters actually supplied to the benchmark. Candidate failures included a signing-ceremony location error, changed staffing categories and unqualified presentation of a source recommendation. Two baseline outputs were unparseable; the baseline construction-waste summary retained source attribution.
- Private review records now cover 27 cases per model; 15 ordinary cases per model remain. No model promotion, production changes, test delivery or artifact publication occurred. Full-day observation and outstanding implementation gates remain open.

## 19 September, 14:05 UTC observation and evidence review

- 160 samples cover 00:50–14:05 UTC. Production processing services remain active, supervisor healthy, candidate unloaded and benchmark completed. Latest edition remains the passing 11:57 cycle; two publication gates are passed and the 19:57 gate remains upcoming.
- Reviewed three additional fixtures per model against the supplied evidence window. The encrypted-mempool outputs confused technical identities/privacy guarantees or turned acknowledgements into authorship. The candidate flight summary preserved the supplied facts, but its speech summary invented the continuation of a truncated quotation. Two baseline attempts had transport failures and no usable output; these are not classified as observed hallucinations.
- Thirty cases per model are reviewed; twelve ordinary cases per model remain. Notes are private on Acer. Failed promotion decisions stand. No production, delivery, retry or archive changes were made; full-day and outstanding implementation gates remain open.

## 19 September, 15:06 UTC observation and evidence review

- 172 samples cover 00:50–15:05 UTC. Production services remain active, supervisor healthy with no candidate resident, and benchmark completed. Latest published edition remains the passing 11:57 cycle; two of three publication gates are passed.
- Reviewed another three fixtures per model. Neither model supplied a usable output for the safety-warning case (parse/transport failures). Both preserved the main forest/philosophy podcast topics. The candidate conflated sponsor promotions with the AI podcast conversation; that baseline attempt was unparseable. Failure notes distinguish missing outputs from observed factual errors.
- Thirty-three cases per model are reviewed; nine ordinary cases per model remain. Records stay private. No routing, worker, website, delivery or archive changes were made. Full-day observation, final publication cycle and outstanding implementation work remain open.

## 19 September, 16:08 UTC observation and evidence review

- 184 samples span 00:50–16:05 UTC. Four production services are active; supervisor health is good and the candidate is unloaded. Benchmark is completed. Latest edition remains the passing 11:57 cycle, with two of three publication gates complete.
- Reviewed three more fixtures per model. The candidate retained the TVL snapshot correctly, but the baseline invented a date-based claim that it was hypothetical. The baseline preserved the GDP observation correctly, while the candidate's limitations contradicted the supplied historical observation. Neither market-podcast attempt produced parseable output.
- Thirty-six cases per model are reviewed; six ordinary cases per model remain. Review records stay private. No production routing, delivery, retries, website or archive changes. The final publication cycle, full-day observation and other implementation gates remain open.

## 19 September, 17:11 UTC observation and evidence review

- 197 samples cover 00:50–17:10 UTC. Four production services remain active; supervisor is healthy with no managed model resident. Benchmark is completed. Latest edition remains the passing 11:57 cycle; final publication check remains due at 19:57.
- Reviewed three further fixtures per model. The candidate retained the sparse fusion headline's intended goal; the baseline strengthened it into a result. The baseline megaproject podcast summary preserved supplied facts; the candidate response was unparseable. The mRNA summaries added an unsupported partnership or invented a prior manufacturing duration. These are source-comparison findings, not independent verification of the source's scientific claims.
- Thirty-nine cases per model are reviewed; three ordinary cases per model remain. Notes stay private. No routing, delivery, retry or public artifact changes. Full-day observation and other implementation gates remain open.


## 19 September, 18:12 UTC — paired review complete

- All 42 cases per model have now been compared against supplied evidence (84 attempt reviews). Candidate: 14 pass, 28 fail, including three unparseable attempts. Baseline: 11 pass, 31 fail, including five parsing and three transport failures. Failed cases include incorrect output language, factual/attribution errors, unsupported qualifications or limitations, and unusable outputs. These are Codex reviews of the frozen benchmark configuration, not independent human review, verified publisher accuracy or production error rates.
- Final cases showed source-host attribution errors, podcast sponsors assigned to a spaceport, inaccurate limitations and planned software integration presented as available. Raw evidence, outputs and review notes remain private on Acer; no benchmark artifacts were published.
- Both tested configurations fail the proposed promotion gate. Candidate remains isolated and unloaded; existing production routing stays unchanged. Do not start a broader canary from these results. Future work should first change evidence preparation/output validation and evaluate that version separately, preserving this failed run.
- 209 samples span 00:50–18:10 UTC. Four production services are active; supervisor is healthy, benchmark completed. Latest edition remains the passing 11:57 cycle. The 19:57 publication and full-day observation remain pending, alongside durable task states, fair scheduling, stronger grounding and source-policy-backed full-body acquisition.

## 19 September, 19:14 UTC observation

- 221 samples span 00:50–19:10 UTC. Production supervisor, telemetry, translation and story services remain active; supervisor is healthy with no candidate resident. Completed benchmark and failed promotion gates are unchanged.
- Latest published edition remains the passing 11:57 cycle. The third publication is due at 19:57 UTC and is not late. Full-day observation remains due after 20 September 00:50 UTC.
- No deployment, model, retry, delivery or artifact changes. Preserve the baseline observation window; proceed with the remaining task-state and grounding work after evaluating it. All outstanding implementation gates remain open.

## 19 September, 20:15 UTC — three publication gates passed

- The third post-rollout edition, scheduled for 19:57 UTC, published at 19:57:27.223 UTC (27.223 seconds after schedule). Public health confirms that publication. All three new scheduled cycles passed the two-minute target: 07:57 +27.779s, 11:57 +27.210s, 19:57 +27.223s.
- 234 samples span 00:50–20:15 UTC. The full-day observation gate remains open until at least 20 September 00:50 UTC; three passing editions alone do not complete the rollout.
- Supervisor, telemetry, translation and story services are active. Supervisor reports no resident candidate. Benchmark remains completed with both tested configurations rejected for expanded use. No production routing, retry, delivery or archive changes were made.
- Remaining work includes evaluating the full-day baseline, durable task-state/dependency scheduling, stronger evidence preparation and output grounding, source-policy-backed full-body acquisition, and any separately evaluated improved model/prompt configuration. Preserve reader-controlled refresh throughout.

## 19 September, 21:17 UTC observation

- 246 samples span 00:50–21:15 UTC. All three scheduled publication cycles still pass, with delays of 27.779s, 27.210s and 27.223s. Full-day baseline remains incomplete until 20 September 00:50 UTC.
- Supervisor, model telemetry, translation and story workers are active; supervisor health is OK with no managed model resident. Isolated benchmark exit status remains successful; the recorded quality gate failures remain unchanged, with no promotion.
- Repository was clean at inspection after the separately user-requested account-tab/role update (84df601). No processing model, pipeline, retry, delivery or archive changes in this observation. Remaining implementation and evidence gates are unchanged; preserve the baseline window before expanding task-state work.

## 19 September, 22:18 UTC observation

- 258 samples span 00:50–22:15 UTC; no missing five-minute buckets in this interval. Three publication gates remain passed at +27.779s, +27.210s and +27.223s. Full-day observation remains pending until 20 September 00:50 UTC.
- All four production processing services are active. Supervisor health is OK with no managed model resident. Benchmark completed successfully as a process; its reviewed quality failures still prohibit candidate promotion.
- Repository was clean before this status update. No pipeline, model, retry, delivery or archive changes were made while preserving the baseline. Durable dependency scheduling, fairness, stronger grounding and permitted full-body acquisition remain outstanding; this observation does not complete those implementation gates.

## 19 September, 23:18 UTC observation

- 270 five-minute samples span 00:50–23:15 UTC. Three publication gates remain passed (+27.779s, +27.210s, +27.223s). The 24-hour baseline is still pending until 20 September 00:50 UTC, irrespective of the local calendar date.
- All four processing services are active. Supervisor is healthy with no managed model resident. Benchmark exit remains successful, with unchanged reviewed quality failures and no candidate promotion.
- Repository was clean before this update. No pipeline, model, retry, delivery or archive changes. Remaining durable task/dependency, fairness, grounding and source-policy/full-body work stays open pending baseline evaluation.

## 20 September, 00:18 UTC observation

- 282 five-minute samples span 19 September 00:50 through 20 September 00:15 UTC (23h25m). Three publication gates remain passed at +27.779s, +27.210s and +27.223s. The full-day observation gate has not yet elapsed; evaluate after 00:50 UTC.
- All four production processing services remain active. Supervisor health is OK with no managed model resident. Benchmark exit remains successful but reviewed quality failures still preclude promotion.
- Repository was clean. No processing, model, retry, delivery or archive changes. Durable task/dependency scheduling, fairness, stronger grounding and permitted full-body acquisition remain unfinished; unchanged operational results do not satisfy those implementation gates.

## 20 September, 01:18 UTC — full-day gate and lease hardening

- 294 contiguous five-minute samples span 19 September 00:50 through 20 September 01:15 UTC (24h25m). The full-day observation and three publication timing gates now pass. Publication delays remain 27.779s, 27.210s and 27.223s.
- Across that observation span, translation totals changed from 368 done / 4 failed / 401 pending to 1,421 done / 57 failed / zero pending. Briefings changed from 53 archived / 964 pending / one working to 1,165 archived / 275 pending / one working / 25 review. Ongoing arrivals mean these are queue snapshots, not fixed-cohort success rates. Latest model telemetry reports 978 completed, 22 failed and a 23.47-second median; this is not a separated load/wait/inference/pin latency measurement.
- All four production processing services are active; supervisor healthy, no candidate resident, benchmark process completed. The reviewed candidate and baseline benchmark configurations remain rejected for expanded use. Production model routing remains unchanged.
- Found and fixed a bounded lease gap: translation completion/deferral and briefing retry/archive completion checked lease identity but not expiry. They now require the original 40-minute translation or 30-minute briefing window as well, matching claim-reclamation rules. No worker or schema change required.
- Transaction-local PostgreSQL regression check (`scripts/checks/lease-expiry.ts`) verifies expired retries, translations and archive completions are rejected, superseded archive leases are rejected, and active translation/archive completions succeed. Temporary tables shadow production tables; rollback removes fixtures. All 57 unit tests and production build pass.
- Overall rollout remains incomplete. Durable shared task/dependency state, fair scheduling, evidence grounding, reviewed source policies/permitted full-body acquisition and richer stage timings remain outstanding. Publication success does not resolve benchmark quality failures. Preserve explicit reader refresh and keep candidate unloaded.
- Lease hardening deployed to news.bittrees.org; production health returns OK and the expected latest scheduled edition. No test email, bulk retry, model swap or benchmark publication occurred. Continue the next independent task-state/evidence increment on subsequent runs.

## 20 September — user-authorized analytics optimization rollout

Executed the ten analytics optimization increments with separate main commits/deployments; see docs/optimization-validation.md for the ledger, tests and pending gates. Changes include truthful score labels, historical observation dates, atomic collection observations/overdue alerts, seven-day diversity shadow, signed-in engagement retention, worker-stage timings, oldest-work scheduling opportunities, HTTP validators, bounded quality-review batches, signed delivery events and SMTP monitoring. Candidate model routing is unchanged; explicit reader refresh is preserved.

A fairness regression initially leaked session temporary tables through transaction pooling, briefly causing API failures. Removed temporary tables, verified real tables and no test-source rows, re-ran the fixed outer-transaction/savepoint fixture, and verified restored health. Future database regressions must be contained in one rollback transaction or an isolated test database. This incident is explicitly recorded in the validation report.

First shadow record: 20 September 02:05:21 UTC; evaluate no sooner than 27 September 02:05 UTC. Expanded-source review due after 21 September approximately 02:00 UTC. Stage timings are arriving; local/public SMTP probes pass. Real provider event arrival and sufficient engagement/outcome samples remain pending. Full durable task/dependency and source-policy/full-body work are still not complete.

## 20 September, 02:21 UTC — post-rollout observation and backlog visibility

- Repository was clean on entry. All four production processing services active; supervisor healthy, candidate unloaded. Latest publication is still the expected 19 September 19:57 edition. No new scheduled publication is due until 07:57 UTC.
- Fifteen briefings have generation/validation/archive/persistence stage samples; two translations have generation/validation/queue samples. Fifty-eight instrumented source checks transferred 22,191,612 body bytes so far, with no production 304 responses recorded yet. The latest scheduled collection completed 57 checks, zero failures and 44 unchanged bodies in ten seconds. These initial counters do not establish sustained bandwidth savings.
- SMTP local and public-address route probes are both healthy with fresh telemetry. No signed provider delivery event has arrived. Diversity shadow remains one edition, starting 02:05:21 UTC; seven-day and source-expansion observation gates remain pending.
- Added admin-only oldest eligible queue age and eligible/current-day counts, excluding active leases, retry backoff and exhausted jobs. Legacy briefing enqueue timestamps remain unknown and are counted separately. This supplies the missing backlog-age measure for the new fairness policy without changing scheduling or model routing.

## 20 September, 03:22 UTC — conditional responses and durable claim ledger

- 319 processing samples through 03:20 UTC. All four processing services active; supervisor healthy with no managed candidate. Benchmark exit remains successful, but reviewed quality failures still prohibit promotion. Latest edition remains the expected previous evening's 19:57 publication.
- Cumulative feed telemetry: 424 successful checks, 137 HTTP 304 responses (32.3% of successful checks), 210,876,300 response-body bytes. These are counters since instrumentation, not a controlled bandwidth comparison. Latest collection: 52 successes, zero failures, 41 unchanged bodies, nine seconds.
- Eligible briefing backlog decreased from 369 to 334; all remaining eligible records have unknown legacy enqueue timestamps and are older than the current day. No eligible translations wait. Stage samples cover 71 briefings and 16 translations; briefing queue age is known for ten newer jobs. SMTP telemetry is fresh and both probes pass; no signed provider events arrived. Shadow still has one edition; observation gates remain open.
- Added a durable public claim ledger recording the validated envelope, task/artifact/content revision, phase, lease and deadline inside the same transaction that assigns the worker lease. Translation claiming now uses that same transactional pattern. Archive-only claims are marked separately. Retention is 30 days for expired claims. This records claims only; complete durable dependency/terminal-state transitions remain future work.
- PostgreSQL fixture regression confirms 20 accepted claims yield 20 ledger rows, fairness still reserves turn ten, and forcing a ledger constraint failure rolls back both briefing and translation lease assignment. The entire fixture is in one rollback transaction with nested savepoints, preventing pooled temporary-table leakage.

## 20 September, 04:23 UTC — durable processing outcomes

- 331 processing samples through 04:20 UTC. Services and supervisor remain healthy; candidate unloaded; completed benchmark still fails its reviewed quality gates. Latest published edition remains the expected previous evening edition, with next publication due 07:57 UTC.
- Claim ledger now has 64 briefing-generation and nine translation-generation claims. Stage samples cover 127 briefing archive/persistence completions, 120 generation/validation attempts and 24 translation completions. Eligible briefing backlog is 284 (all legacy enqueue times unknown, none current-day); no translations are eligible and waiting.
- Collection counters: 797 successful checks, 319 HTTP 304 responses (40.0%), 300,229,454 body bytes. Latest run: 53 successes, no failures, 42 unchanged bodies in nine seconds. Fresh SMTP probes pass; no signed delivery events; shadow still one edition. Observation-dependent gates remain pending.
- Added append-only, lease-linked generation/archive/translation/defer/retry/review outcomes, atomically committed with the corresponding result/retry update. Legacy leases without claim records finish without fabricated history. Replayed identical archive results create one outcome; attempts to replace an already recorded CID with another CID under the same lease are rejected. Admin processing analytics shows event counts explicitly as transitions, not unique jobs.
- PostgreSQL fixture regression verifies lease expiry, archive replay idempotency, conflicting CID rejection, event rows and rollback of a translation state update when event persistence fails. Fixtures remain in one outer rollback transaction with savepoints. Full dependency admission/reconciliation and explicit expiration transitions are still outstanding; this increment is not declared full rollout completion.
- Extended the same regression to result replay: a repeated generation response returns the originally saved document/timestamp rather than creating a different IPFS input, and generation writes after archival are rejected. This closes the document/CID consistency gap as well as duplicate outcome insertion. All 64 unit tests and the build pass; production health verified after deployment.

## 20 September, 05:25 UTC — missing-outcome reconciliation

- 344 samples through 05:25 UTC; News supervisor, telemetry, briefing and translation services active, managed candidate unloaded. Latest scheduled edition remains the expected 19 September 19:57 edition; next cycle due 07:57 UTC. The reviewed model rejection remains in force.
- Outcomes are arriving: 42 generated and 42 archived briefings, 27 translations, 16 deferrals, 14 retries and six review transitions at inspection. These are transition counts, not distinct jobs or cohort failure rates. Eligible queues at 05:25: 274 briefings (six from the last 24 hours, 268 unknown legacy enqueue times, oldest known wait 50 minutes) and one translation waiting five minutes.
- Cumulative conditional-fetch counters: 1,205 successful checks, 522 HTTP 304 responses (43.3%), 378,555,487 body bytes. These are instrumentation counters, not a controlled bandwidth improvement. Latest collection: 30 successes, zero failures, 27 unchanged bodies in ten seconds. SMTP telemetry at 05:24 passes both host-origin probes. No signed delivery events; still one diversity-shadow edition.
- Added bounded missing-outcome reconciliation to five-minute sampling: at most 100 claims per run, only after a five-minute grace beyond the claim deadline, idempotent by lease/event. The new `deadline_unreported` event means no outcome existed at that observation, not proven processing failure. It does not consume attempts, reclaim jobs, alter artifacts or reject later valid outcome records. At inspection all 77 old gaps were claimed between 03:26 and 04:25, spanning the pre-outcome instrumentation window; no failure classification is inferred.
- Admin labels distinguish these observations from worker outcomes. PostgreSQL regression covers batch bounds, grace boundary, active claims, all existing outcome types, repeated reconciliation and later outcome coexistence. Result/lease regression, all 64 unit tests and production build pass; zero leaked fixture tables found. Common dependency admission, explicit authoritative task-state reconciliation and cold-load separation remain incomplete. No model/ranking change, test email or reader auto-refresh.

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

### 21 September 00:44 UTC — observation checkpoint

At 00:40, nine briefings are eligible (three published within 24 hours, all enqueue times known, oldest known wait five minutes) and three newly queued translations wait under a minute. Four News services active; supervisor healthy, candidate unloaded. Eight supersessions, 78 missing-report observations and 23 translation review transitions unchanged. SMTP telemetry fresh at 00:40, both host-origin probes passing.

Latest collection: 53 successes, two failures, 44 unchanged bodies in 11 seconds. Conditional totals: 4,240 HTTP 304s / 8,695 successes, 2,162,342,926 body bytes; no controlled savings claim. Source status includes a Lex Fridman podcast timeout and the existing Endpoints/IMF HTTP 403 restrictions; preserve ordinary backoff without forced retries or restriction bypass. Hacker News currently has no recorded error. Public health confirms the passing 20 September evening edition; next scheduled publication is 07:57 UTC. Four shadow editions; no signed provider events, prior Resend sign-in request still pending. Expanded-source review is not yet due (21 September after 02:00 UTC). No new code/worker/model/ranking changes or deployment; website `deb3280`, diagnostic worker `94ad389`. All outstanding implementation and acceptance gates remain open.

### 21 September 01:44 UTC — diagnostic evidence and review timing

At 01:40, neither public queue has eligible waiting work. Four News services active; supervisor healthy and candidate unloaded. Eight supersessions and 78 missing-report observations unchanged; translation review transitions total 27. New diagnostic labels are now exercised naturally: the bounded log inspection since deployment contains 12 failures, all `language_check` during translation. This identifies the immediate rejection condition (insufficient English confidence), not whether the rejected text was factually wrong or the language detector produced false positives. No validation threshold is weakened, output regenerated, or cached content removed on that evidence alone.

SMTP telemetry fresh at 01:40, both host-origin probes passing. Latest collection: 52 successes, one failure, 47 unchanged bodies in 18 seconds. Conditional totals: 4,438 HTTP 304s / 9,084 successes, 2,251,928,637 body bytes; no controlled savings claim. Current errors include In the Pipeline and Lex Fridman timeouts plus existing Endpoints/IMF HTTP 403 restrictions; retain backoff. Public health confirms the passing evening edition. Four shadow editions, zero signed provider events; prior Resend sign-in request remains pending. The 24-hour expanded-source review is still premature until after 02:00 UTC and is due at the next hourly check. No runtime changes/deployment; website `deb3280`, diagnostic worker `94ad389`. All remaining implementation and acceptance gates stay open.

### 21 September 02:44 UTC — expanded-source review completed

Completed the required fixed 24-hour contribution/failure review (20 September 02:00–21 September 02:00 UTC). See [source-review-2026-09-21.md](source-review-2026-09-21.md) for the table, method and recommendations. The twelve additions account for 56/457 window-dated public records (12.3%), with 54 archived briefings and two in review. All twelve currently healthy; Federal Reserve had two failed observations out of 23 and recovered. Retain the source set/cadences, preserve restrictions and backoff, and do not change ranking weights from one day's sample.

The source-assessment acceptance item is complete; the seven-day comparison and overall rollout are not. At 02:40, four briefings wait up to five minutes and one newly queued translation waits under a minute. Four News services active; supervisor healthy, candidate unloaded; SMTP probes fresh and passing. No signed delivery events, four shadow editions. Existing provider sign-in request and other implementation/quality gates remain open. No runtime deployment: website `deb3280`, worker `94ad389`.
