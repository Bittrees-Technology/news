# Expanded-source 24-hour assessment — 21 September 2026

Review window: **20 September 02:00–21 September 02:00 UTC**, assessed around 02:45 UTC. Public records only.

The twelve additions supplied **56 of 457 retained public articles dated within the window (12.3%)**. They currently hold 202 records including older feed entries. All twelve are currently healthy; 935/937 recorded collection observations in the fixed window were healthy. Availability measures collection success, not factual reliability.

| Source | Healthy checks / observations | Articles dated in window | Archived briefings at review |
|---|---:|---:|---:|
| Africanews | 96/96 | 6 | 6 |
| BIS Statistics Releases | 25/25 | 0 | 0 |
| Bitcoin Optech | 25/25 | 0 | 0 |
| CNA Asia | 96/96 | 9 | 9 |
| Dialogue Earth | 96/96 | 1 | 1 |
| DW World | 96/96 | 2 | 2 |
| Federal Reserve Press Releases | 21/23 | 0 | 0 |
| France 24 English | 96/96 | 30 | 29 |
| Global Voices | 96/96 | 2 | 1 |
| Mongabay | 96/96 | 0 | 0 |
| Rest of World | 96/96 | 0 | 0 |
| RNZ Pacific | 96/96 | 6 | 6 |

## Findings

- 54/56 window articles have archived generated briefings. One France 24 item is in exhausted-attempt review with HTTPError, and one Global Voices item with ValueError. These labels do not establish factual correctness or justify an automatic retry.
- Federal Reserve availability was 21/23 observations (91.3%); the two production failures were previously observed HTTP 404s. It is currently healthy. Keep its hourly cadence and normal backoff; no proxy, restriction bypass or alternative publisher endpoint was introduced.
- Five additions had no article dated in this single-day window. Their feeds were reachable and retained older entries. That is not evidence that periodic research/newsletter feeds should be removed.
- France 24 contributed 30/56 added-source articles. Added sources improve available publisher coverage, but this count does not establish distinct event coverage or top-three diversity. The seven-day shadow remains unpromoted.
- Observador, Público and ECO account for 198/457 articles (43.3%) in this window, versus 219/417 (52.5%) in the earlier audit snapshot. Different dates and publication volumes prevent attributing this difference solely to expansion. The largest individual source remains Observador: 111/457 (24.3%).

## Optimization recommendations

1. Retain the twelve additions and their current bounded cadence. Do not expand model demand again until the review queue and source contribution are understood over several publishing days.
2. Review the two unarchived added-source briefings through the bounded quality workflow. Do not claim their source/output factual quality from an error type alone.
3. Keep observing Federal Reserve availability. A recovered intermittent 404 should remain an operational finding, not an editorial reliability penalty.
4. Focus the next transfer investigation on existing large endpoints. Cumulative counters since instrumentation show DeFiLlama at 426.3 MB, Latent Space at 338.8 MB and This Week in Startups at 302.9 MB. The two podcast feeds have 25 successful checks each and zero 304 responses. Check supported validators, response sizes and update yield before changing cadence; these totals are not fixed-window savings measurements.
5. Complete the seven-day publisher/event shadow assessment no earlier than 27 September 02:05 UTC. Preserve current ranking weights and reader overrides in the meantime.

## Measurement limits and disposition

- Article counts use publisher timestamps and retained records at review time. `fetched_at` changes when evidence changes, so it is not treated as an immutable first-discovery timestamp. Counts are records, not deduplicated real-world events.
- Collection observations use the fixed 24-hour window; current health and archive status are later snapshots. Cumulative transport counters cover a different instrumentation window and exclude headers/failed-transfer bytes.
- No full factual/source-reliability review, causal geographic improvement, reader satisfaction improvement or controlled bandwidth reduction is inferred.
- The **24-hour expanded-source contribution/failure review is complete**. The overall analytics/processing rollout is not complete: provider event receipt/admin session, seven-day shadow, engagement sample adequacy, full stage timing, common dependency/capacity admission and source-policy/full-body work remain open.
- This assessment changes no catalog, model routing, ranking, reader settings or delivery subscriptions.
