# TBN analytics and source coverage audit

Audit: 20 September 2026, approximately 01:44–01:50 UTC. Counts are point-in-time snapshots from the production database before the source expansion enters scheduled collection. Code review covers analytics, collection, scoring, feedback, delivery and processing. No private article text, credentials or individual account identities are included.

## Findings

| Measure | Observed | Interpretation |
|---|---:|---|
| Catalog | 127 sources before expansion | 139 after 12 validated additions |
| Reachability | 121 healthy; 6 unavailable | 95.3% latest-check availability, not uptime |
| Public content | 2,642 items | 2,433 articles, 193 podcasts, 16 data items |
| Last 24-hour intake | 417 items | Uses publication date, not discovery time |
| Three Portuguese publishers | 219 / 417 (52.5%) | Observador, Público and ECO dominate intake; not necessarily front-page exposure |
| Largest individual publisher | Observador: 111 / 417 (26.6%) | Consider publisher caps after ranking, without discarding its useful reporting |
| Generated briefing queue | 1,182 saved and pinned of 1,469 records; 25 in review | Queue coverage differs from coverage of all 2,642 public items |
| Translation states | 1,426 done; 57 failed | 96.2% of these terminal records done; schema completion is not translation accuracy |
| Feedback | 11 votes from one account | Insufficient evidence for broad popularity; resist strong community conclusions |
| Reading signals | Two read marks, no saves, one participating account | Does not measure visits, impressions or retention |
| Delivery | Four marked sent in seven days | Provider acceptance, not confirmed inbox delivery |
| Publication | Last three editions +27.779s, +27.210s, +27.223s | All pass the two-minute target |

Six unavailable publishers returned HTTP 403: SemiAnalysis, Endpoints News, IMF News, STAT, Bankless and Fusion Industry Association. Keep the existing daily backoff; do not retry aggressively or bypass access controls. A successful request elsewhere would not establish production availability.

## Analytics limitations that matter

1. **Source consistency is mostly transport availability.** `sourceScores` uses healthy-check share with a bounded feedback adjustment. It does not measure publisher factual reliability. Observations are recorded when ranking runs, rather than atomically for every collection attempt; some checks may be missed. Show availability, editorial reliability and reader response separately, with sample counts.
2. **Evidence support is a heuristic.** The current grounding factor gives an exact excerpt match a high score. It cannot establish that a publisher is correct or detect every hallucination. Completeness rewards field presence and excerpt length; it does not mean the full article is available. Benchmark review already found quality failures, so retain the existing model and evaluate improved evidence handling before promotion.
3. **Summary analytics span separate stores.** `items.summary_kind` reports 103 extractive and 2,539 excerpt records, while generated standalone briefings live in `story_documents`. Reporting only the former understates generated content. The new coverage panel counts briefings separately and explains the distinction.
4. **Latest check time is not freshness coverage.** One recently checked feed can hide another overdue feed. Add oldest check age and overdue-source counts relative to each source's polling interval.
5. **Historical data can look newly published.** World Bank observations use retrieval time as `published_at`, while the observation year is in the title/text. Keep observation period, release date and retrieval time distinct, and prevent annual data from taking a breaking-news freshness bonus just because it was fetched again.
6. **No defensible conversion or popularity funnel yet.** Current feedback/read/save records lack article-impression denominators, session retention and source-click counts. Absence of these measurements is not zero engagement. Keep signed-in preference signals private and avoid adding identifying guest tracking by default.
7. **Feed identity does not equal publisher diversity.** Multiple feeds may belong to one publisher, and multiple publishers may cover the same event. Measure both publisher-family concentration and event duplication before judging geographic balance. Country keyword tagging alone is not a robust geographic audit.
8. **Stage timings are incomplete.** Current snapshots/worker medians do not isolate queue wait, cold load, inference, validation and IPFS time. Median inference alone cannot explain a slow briefing.

## Changes implemented with this audit

- Admin/super-admin analytics now include public content mix, generated/archived coverage, 24-hour intake concentration, aggregate 30-day signed-in feedback and seven-day delivery states. The endpoint enforces administrator authorization and excludes private source content and identities.
- Added explicit labels distinguishing intake from popularity, briefing coverage from full text, and provider acceptance from inbox receipt. Data loads on entry without live polling in the new panel.
- Corrected the editorial workspace link to `/account/editorial`.
- Expanded the catalog from 127 to 139 sources. Each added feed returned usable recent entries through the same bounded, public-network-checked parser used by collection. Tests were read-only; the normal collector ingests them after deployment.
- Expanded the existing World Bank GDP query from Portugal/USA/euro area to include world and regional aggregates for East Asia/Pacific, South Asia, Sub-Saharan Africa, Latin America/Caribbean, Middle East/North Africa and Europe/Central Asia. These are historical annual observations, not live economic ticks.

### Added feeds

| Source | Coverage |
|---|---|
| Africanews | African news and international affairs |
| DW World | International reporting |
| France 24 English | International reporting |
| RNZ Pacific | Pacific regional reporting |
| Global Voices | International civic and local perspectives |
| CNA Asia | Asian reporting |
| Rest of World | Technology beyond a US-centric lens |
| Dialogue Earth | Climate and environment |
| Mongabay | Biodiversity, forests and environment |
| BIS Statistics Releases | Primary statistical release notices, classified as articles rather than raw datasets |
| Federal Reserve Press Releases | Primary economic-policy announcements |
| Bitcoin Optech | Bitcoin engineering and technical developments |

Feed availability is not an endorsement or a license to reproduce full publisher articles. No full-text acquisition policy changed. Africanews documents its feeds on its [official widgets page](https://www.africanews.com/page/widgets/); BIS documents statistical release feeds in its [Data Portal help](https://data.bis.org/help/tools). Exact endpoints are in `lib/catalog.json`.

Not activated: BIS research candidate returned 404; RNZ World, Bitcoin Core and World Bank Trade Tips candidates produced no usable entries in the collector's recent-content window. These results do not prove those publications lack functioning feeds; retain for separate endpoint/recency investigation. Existing podcast catalog remains available.

## Prioritized optimization plan

| Priority | Improvement | Expected benefit | Proposed acceptance measure |
|---|---|---|---|
| P0 | Separate source availability from editorial reliability and grounding | Removes misleading confidence in rankings | Distinct labels, sample counts and evidence rubric; validate a frozen reviewed sample |
| P0 | Preserve observation/release/retrieval dates for data | Stops old statistics masquerading as breaking news | Re-fetching unchanged annual data cannot increase freshness |
| P1 | Record every collection outcome at write time; add overdue-source alerts | Accurate health history and faster incident detection | Each completed attempt has one idempotent observation; alert after two expected polling intervals |
| P1 | Shadow-test publisher/event diversity on the leading stories | Broader global selection without letting feed volume dictate ranking | Compare top-three unique publishers/events and regional coverage against current ordering over seven days; retain reader overrides |
| P1 | Add bounded signed-in impression/source-click events and privacy retention rules | Useful engagement rates rather than raw vote counts | Publish numerators, denominators and unique-reader counts; no popularity claims on tiny cohorts |
| P1 | Split queue wait, inference, validation and archive timings | Find the actual bottleneck before changing models | Median/p95 per stage and age of oldest eligible work; preserve publication SLA |
| P1 | Process leading current stories first, age older work gradually | Better visible coverage with no permanent backlog starvation | Track time-to-briefing for current stories and maximum backlog age |
| P2 | Conditional HTTP requests and source-specific cadence | Less bandwidth and repeated parsing | Track bytes, 304 rate and new items/request; preserve freshness while reducing transfer |
| P2 | Review failed translations and briefings in bounded batches | Improve quality without mass regeneration | Error categories and reviewed factual/attribution pass rate; no model promotion on schema success alone |
| P2 | Track delivery-provider events and SMTP route health | Distinguish accepted, delivered, deferred and bounced | Event coverage plus verified inbound route monitoring; do not equate “sent” with receipt |

These are recommendations unless listed in the implemented section. Do not change all ranking weights at once: first fix measurement, then compare changes against the current ranking on a fixed set. Reassess new-source contribution and failures after 24 hours; avoid expanding inference demand indiscriminately. All new sources use existing bounded collection limits and backoff. Reader-controlled refresh remains unchanged.


## Standing requirement — source restraint (21 September 2026)

Optimize local processing and cached evidence before increasing publisher requests. Do not increase polling frequency, collection concurrency or source count as a shortcut to throughput. Reuse frozen evidence for debugging and model comparisons; avoid repeated live probes of restricted sources. Preserve conditional requests, exclusive collection leases, bounded response sizes and rate-limit/failure backoff. Evaluate request budgets at publisher/domain level across related feeds; use measured new-item yield to justify slowing low-yield sources. Publisher-wide budgets and adaptive low-yield cadence remain follow-up work, not controls claimed as already implemented.

Also avoid editorial overreliance on individual sources: monitor publisher-family concentration and repeated-event coverage for the default TBN newspaper. Keep the existing diversity shadow and quality review gate before changing live selection, preserve readers' explicit choices, and do not add unvalidated caps or equate volume with reliability.
