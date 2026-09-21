# Page performance — September 22, 2026

Implemented public-only home snapshot caching with 30-second revalidation, concurrent session/snapshot loading, completed-translation reads without render-time queue writes, and progressive landing-page rendering (30 cards at a time). Search/filtering retains the full snapshot. Briefing payloads omit source context after deriving evidence. No account data is shared in the public cache, and no live page reorder or publisher polling was added.

Production measurements: three sequential compressed HTML requests per route from this workstation, before and after c46e480. These are HTTP timings, not browser paint or LCP.

| Route | Before TTFB, seconds | After TTFB, seconds | Compressed HTML |
|---|---|---|---|
| Home | 7.84 / 4.41 / 4.21 | 6.63 / 1.12 / 1.09 | ~716 KB → ~450 KB |
| Briefings | .71 / .53 / .52 | .73 / .55 / .54 | ~35.7 KB → ~29.8 KB |

The warmed home requests improve substantially; first-request latency remains material. Briefings transfer size improves, while response latency is effectively unchanged at this sample size. Home still serializes all snapshot items for search/filtering, leaving a future opportunity for a paginated search endpoint. Stale-while-revalidate can temporarily serve a previous snapshot; 30 seconds is a revalidation interval, not a hard maximum freshness guarantee.

Validation: production build, 72 unit tests, and rollback-only briefing pagination checks pass. The one-at-a-time reader correction is a subsequent change. Browser measurements and visual QA are unavailable because administrator-enforced browser policy verification failed; no bypass attempted.
