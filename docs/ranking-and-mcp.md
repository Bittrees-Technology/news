# Rankings, personal publication and AI curation

## Scoring

Version `tbn-transparent-v1` applies five normalized weights: freshness 20, relevance 25, source consistency 20, evidence support 25 and completeness 10. Owners can change all weights. Freshness has a 48-hour half-life; relevance measures interest-term matches (neutral 50 without interests); consistency is the source's successful collection percentage over 30 days (neutral 50 before observation); grounding rewards exact-source summaries and distinguishes unsupported paraphrases; completeness measures available title, HTTPS link, timestamp and excerpt. These are transparent curation heuristics, not factual-accuracy or editorial-independence assessments.

Hard filters cover topics, selected sources, exclusions, content type, age, minimum score, presence of summary, duplicate headlines and source caps. They affect personal pages and digests. Feed-specific interests and selectors remain independent; an owner's scoring profile applies across their feeds. Newspaper/feed scores average selected article scores, with sample size and rank stored. Public comparisons include only published papers and may involve different weights. Source history reports collection consistency, not an invented credibility score.

Observations start with actual current data. Source checks are unique by source and collection timestamp; page views do not add repeated successful samples. Entity scores are recorded at most once per hour; the account chart returns the latest observation per day over the last 30 days. Profile/version is stored per observation; raw history is retained for 90 days. No synthetic backfill is performed.

## Personal publishing

Existing papers remain private unless explicitly published. Automatic publication is off by default. Owners may authorize daily, three-daily or hourly public snapshots. A separate Vercel personal job runs every 15 minutes; it claims bounded account work with expiring leases, refreshes eligible personal sources and publishes complete snapshots. Scheduling is best effort and can run later under load. On failure, the last successful snapshot remains. Unpublishing in the UI also turns off automation. Concurrency checks prevent a snapshot built under superseded visibility settings from being published.

Custom RSS/Atom sources remain private unless the owner explicitly permits their stories in public editions. Source URL/credentials are not exposed in newspaper pages. User AI curation is stored per account and never rewrites the shared news desk's items or schedule. Public-source summaries supplied by a user's AI must match an exact source passage.

## User MCP connection

Endpoint: `https://news.bittrees.org/api/mcp`. Transport: stateless Streamable HTTP with JSON responses, supporting negotiated protocol versions 2025-03-26, 2025-06-18 and 2025-11-25. Tested with the official MCP TypeScript SDK client. See the [transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

Create a connection in `/account/ai`. Configure an HTTP-capable MCP client with the endpoint and `Authorization: Bearer <the key shown once>`. Keys are hashed at rest, expire after 7/30/90 days and are immediately revocable for subsequent calls. This release uses manually provisioned bearer keys; it does not implement OAuth discovery/authorization, so OAuth-only clients cannot connect yet.

Scopes:
- `read`: settings, eligible articles and ranking history for the token's account.
- `curate`: add/refresh private HTTPS RSS/Atom sources, set preferences/feeds/ranking, select grounded summaries, exclude articles and refresh scores independently.
- `publish`: publish the user's public newspaper now. This scope is separate and unchecked by default. It cannot change the automatic-publication schedule.

No scope grants account deletion, email/wallet administration, main Bittrees publishing, arbitrary proxy requests or root credentials. Custom authenticated APIs and browser scraping are not supported; connected sources must be public HTTPS RSS/Atom endpoints. Tool calls are rate-limited by account and audited by action/status, without argument bodies or tokens. Provider content remains untrusted.

## Validation

Unit tests cover deterministic/bounded scores, relevance weight changes, grounding, hard filters, duplicates, source caps and UTC publication boundaries. Integration checks use isolated accounts and the official MCP client to verify scope separation, token revocation, cross-account isolation, SSRF rejection, summary grounding, real history, opt-in automated snapshots and retention of the previous edition on failure. No test email or wallet message is sent by these checks.
