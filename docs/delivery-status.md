# TBN rollout status — 16 September 2026

Public website: https://news.bittrees.org. Public repository: https://github.com/Bittrees-Technology/news. Vercel project: bittrees-news, bittrees-tech team.

## Live

- The Bittrees News (TBN) branding, public newspaper and archive, free email or EVM-wallet signup, saved reading and private preferences.
- 127 public news/research/podcast/data endpoints; source health is reported individually. Not all endpoints are available on every collection. Personal HTTPS RSS feeds are supported; arbitrary credentialed API connections are not yet supported.
- Three publication slots at 07:57, 11:57 and 19:57 UTC. Preparation starts 12 minutes earlier. The prior successful edition remains readable on failure; late completion is timestamped honestly.
- Bittrees-hosted Qwen3.5 2B selects source passages. Publication verifies every passage against its source. This is extractive summarization, not free-form generated reporting. A first preview with an unsupported paraphrase was corrected visibly to publisher excerpts.
- Verified main@bittrees.org sender, a domain-scoped sending key, signed bounce/complaint endpoint, verified forwarding destinations, paused-by-default subscriptions, daily/weekly/monthly queues and unsubscribe. Root MX preserved.
- Insights product registration as The Bittrees News (TBN), optional consent script, ignored personal account interaction labels. No synthetic visitor traffic added.

Production deployment: `dpl_BBuvV6FACb4WpU6om1n16j3ZyCja`. Source-grounded edition `2026-09-16T21:27` completed and published at 21:32 UTC.

## Verification

Six unit checks pass, including UTC period boundaries, filters, SSRF and exact-source validation. Disposable two-account HTTP/database checks pass for ownership isolation, replay rejection, private saves, blocked internal feeds, destination mutation, unique period queues and pause cancellation. Production build passes. Public production pages and API checks are recorded during rollout.

One explicitly authorized email test was accepted by Resend on 16 September, provider message ID 01a0ac1f-26e5-72ee-86d9-5a6c96c53bdc. The recipient reported it had not arrived; provider status was sent, not delivered, at the last check. A TCP check from the implementation environment to smtp.bittrees.org:25 was refused; that alone does not establish the external network cause. Do not claim inbox delivery. No recurring subscription was created for the test.

## Remaining activation and validation

- Wallet worker installed on Acer with an isolated, unfunded sender and encrypted persistent XMTP storage. It waits for mail.bittrees.eth to resolve to the dedicated address. The controlling Safe must sign the exact transactions in mail-ens-safe-transactions.json. No user signature was fabricated, no treasury authority delegated, and no wallet test has been sent. Chirpy acceptance still needs a recipient test after activation.
- Actual browser interaction/visual checks were unavailable because browser access was blocked by policy. HTTP/build validation does not replace that check.
- Email-code inbox completion, real bounce/complaint delivery, scheduled overnight execution and disaster-recovery restore remain unverified. Public signup is implemented; this is not a claim that every acceptance case has passed.

## Named newspapers and account pages

Added owner-managed newspapers at `/<newspaper>` and named feeds at `/<newspaper>/<feed>`. They are private by default; owners can publish and unpublish them. Public pages exclude all account-private source records. Newspaper names and introductions are public only when published. Addresses are unique and permanent; display names remain editable. Account deletion cascades to newspaper/feed records.

Account settings now have separate Your newspaper, Topics & interests, Sources & feeds, Delivery, and Account pages. Archive and Saved navigation appears only after sign-in. Authenticated two-account HTTP checks verified private-page access, reserved/colliding addresses, feed ownership, publication reversal and exclusion of private stories. No blockchain transaction is required for these URL paths.

## Rankings, automation and personal MCP

Balanced, adjustable article ranking and source-consistency scores are implemented. The account Rankings page shows recorded source/newspaper/feed score and position history; the initial 127 source observations are based on actual collection records. The ranking model is transparent and does not claim factual accuracy. See ranking-and-mcp.md for weights, sample interpretation and retention.

Owners can enable daily, three-daily or hourly public snapshots; the separate personal scheduler runs every 15 minutes. Custom sources refresh independently from the Bittrees collector. Source-sharing permission is explicit, and revoking sharing removes that source's stories from the current public snapshot without discarding unrelated stories.

The user MCP endpoint supports read, curate and separately authorized publish scopes with expiring, revocable keys. Official-client integration tests passed for scope boundaries, ownership, source selection, grounding, SSRF, token revocation and failure retention. Nine unit tests pass. This is manually provisioned bearer authentication, not OAuth; custom source ingestion supports public HTTPS RSS/Atom.
