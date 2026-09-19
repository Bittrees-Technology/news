# TBN processing flow

Standing editorial requirement: The Bittrees News serves a global audience. Its homepage uses descending global/quality ranking without a separate repeated top-three section. Personal interests may override defaults in personal views. A **Full article/Full briefing** label must mean complete permitted source content; generated overviews are **Summary**, with a separate full-article source link. Never reconstruct missing publisher text with AI.

## Sequence and dependencies

1. Existing UTC prepare jobs collect source feeds/data at 07:45, 11:45 and 19:45. Public content enters storage. Changed title/excerpt invalidates its old extractive summary; changed title/source evidence invalidates generated documents and pin references. Unchanged evidence retains generated work. Historical IPFS objects remain immutable.
2. Global ranking assigns work priority; current-day public items precede older backlog. Completed documents awaiting pinning go first because they require no inference. Private content is never submitted to the public workers.
3. Edition preparation selects grounded source sentences deterministically in ranked order (up to 24), reusing valid source excerpts. It makes **zero model calls** and therefore no longer waits for long-form generation. Server validation still requires an exact source span. Existing publication times remain 07:57, 11:57 and 19:57 UTC; late prepared editions publish on result acceptance.
4. Translation runs language detection first, uses installed Portuguese-to-English translation when available, and otherwise calls local Qwen. Already completed content-keyed translations are reused.
5. Translation and briefing workers share an exclusive local inference lock. Waiting translations have priority between requests. Busy work is deferred without spending a retry. This coordinates News workers only; other applications using the same model are outside this lock. In-flight inference is not preempted.
6. Briefings use constrained JSON output, a 320-token budget, bounded source evidence and a shared cache keyed by model endpoint plus exact inference request. Successful generation precedes IPFS pinning. A failed pin can resume from the saved document without regenerating it.
7. Briefing claims have unique leases and a 30-minute window; stale results cannot replace updated content. Three failed attempts stop automatic retry; backoff is 5/10/15 minutes. Translation leases allow 40 minutes for two sequential fields, with a three-attempt limit. Model calls time out at 15 minutes. Busy deferrals use 30 seconds and refund the claim attempt.
8. Visible homepage checks every minute for edition, source-content, completed-translation and generated-summary changes and refreshes its data. RSS keeps its five-minute cache. Browser refresh behavior applies to the public homepage, not private drafts or historical snapshots.

## Verification and operations

Run `npm test`, `npm run build`, `python3 -m unittest discover -s worker -p 'test_*.py'`, and the database integration check `npx tsx --env-file=.env.local scripts/check-processing.ts`. The integration check creates isolated old-dated fixtures and removes them, exercising unchanged reuse, content invalidation, stale-lease rejection and busy deferral.

Deploy schema and web API before replacing/restarting the three News workers; old briefing workers do not supply the new lease field. Backups of the previous worker scripts are on Acer in `~/.local/lib/bittrees-news/rollback-process-v1/`. The new shared helper files must be installed beside the workers. Existing service hardening and credential files remain unchanged.

Worker logs record task type, successful inference duration, completion-token count, cache hits, and error types; prompts and credentials are not logged. Observe actual sustained completion rates before changing hardware or model quality settings. A valid JSON response does not prove factual correctness.

Initial observation (2026-09-19): 381 translations pending, 4 failed, 1 working; 955 briefing records, 56 generated and pinned. Live model smoke test: valid constrained JSON, 19 generated tokens, 36.72 seconds including inference; identical cached request 0.0003 seconds. This small test demonstrates cache reuse, not end-to-end briefing throughput.
