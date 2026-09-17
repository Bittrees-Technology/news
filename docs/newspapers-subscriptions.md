# Newspapers, subscriptions and MCP — 17 September 2026

## User workflow

1. Account → Your newspaper: save a name, permanent address and introduction privately.
2. Topics & interests and Sources & feeds: select the stories and connect public HTTPS RSS/Atom sources. Personal sources stay private unless their owner explicitly approves sharing.
3. Analytics → ranking preferences: all signed-in members can adjust their own weights and eligibility filters. Diagnostic scores and comparison history remain administrator-only.
4. Your newspaper → Generate & edit preview: create a dated broadsheet from the saved settings. Edit headlines and summaries, reorder or remove stories, and save privately. Revision checks prevent stale edits overwriting a newer preview. Sources remain attached; rewritten text is labeled as an owner edit. Regenerating replaces the prior draft. Publishing the reviewed revision is a separate explicit action, and rejects private/unshared source material.
5. Delivery: select the main paper, a personal digest, or a published newspaper/feed; choose a verified destination and daily, weekly or monthly frequency. Subscribe explicitly enables future delivery. Individual subscriptions can be paused. Destination pause stops all deliveries to that address. Existing enabled personal digest destinations continue to work until a subscription replaces that legacy selection.

Daily digests run after 12:00 UTC; weekly on Monday; monthly on the first. Main-paper subscriptions collect published editions in that period, and published user-paper/feed subscriptions collect retained snapshots. History retention begins with this release; older editions are not reconstructed. Digests are capped at 50 stories. A personal digest is freshly selected from the user's current settings; a published-paper subscription uses its publisher's issued editions. Automatic public generation uses the existing newspaper publication schedule and source/ranking settings.

Emails include a classic HTML newspaper and plain-text fallback. No live message was sent during this release's acceptance work. Provider delivery and inbox placement have not been retested here. Wallet delivery still requires the existing sender activation and a reachable XMTP destination.

## MCP contract

Endpoint: `https://news.bittrees.org/api/mcp`. Streamable HTTP with a custom bearer header, not OAuth. No token is sent to source sites. Merely creating a key does not count as validation; the account UI records validation after a successful authenticated tool call. The connection supplies tools to an active client; it does not start an external AI session automatically. Generation assembles source material using saved rankings, not an unsupported claim of fresh model-written reporting.

| Account page | Tools |
| --- | --- |
| Your newspaper | get_newspaper, set_newspaper, generate_newspaper, get_preview, edit_preview, publish_preview |
| Topics & interests | set_preferences, get_newspaper |
| Sources & feeds | add_source, refresh_source, set_feed, list_articles |
| Delivery | get_delivery, set_subscription |
| Analytics / ranking preferences | set_ranking, refresh_rankings; ranking_history for administrators |

Read, curate, publish and delivery are separate scopes. Delivery is opt-in and absent from older keys. It cannot create/verify a recipient, change another account's subscription, or grant itself publishing rights. Existing clients need a newly configured key to receive delivery authority. Publishing scope is still required for public publication. Changing newspaper metadata through curation does not toggle public visibility or start a schedule.

Subscriptions and destinations have independent revisions. Queue insertion is idempotent per subscription and period. Dispatch checks current destination and subscription state, paper visibility, source ownership/sharing and suppression; making a newspaper private blocks pending deliveries. Previously delivered mail cannot be recalled. Unsubscribe links for new subscriptions pause only that subscription.

## Evidence

- 28 unit tests, including HTML escaping and existing scoring/auth cache/role/source checks.
- Disposable-schema integration: 24 MCP requests plus daily/weekly/monthly queue tests, private-source publication denial, scope filtering, member settings/ranking, private preview, stale edit rejection, public snapshot, three target types, foreign destination denial, deduplicated queue, unsubscribe, private-paper email and wallet dispatch denial, pausing unavailable papers, validation/revocation, and signed-out API denial. No dispatch provider was invoked.
- Real MCP SDK Streamable HTTP connection to production: created a disposable account with no login identity, connected/refreshed a real public feed, configured topics/two feeds/rankings, generated and edited today's example, then removed the account and its key. See `newspaper-mcp-proof.json`. No subscriptions or destinations were created for this proof.
- Headless browser against production using a disposable, unprivileged acceptance account: saved the newspaper form, generated a preview, edited a headline, reloaded to verify persistence, checked that delivery required a verified destination, and opened member ranking preferences. Account and temporary session were removed.
- Desktop 1360px and phone 390px example renders: ten stories, no horizontal overflow. The example displays original publication dates and preserves publisher links.

Run `npm test`, `npm run typecheck`, `npm run build`. `scripts/validate-newspaper-flow.ts` uses an isolated, disposable database schema over an unpooled connection and never dispatches mail. The two live acceptance scripts require explicit environment flags; `ui-preview-acceptance.ts` also takes `PLAYWRIGHT_MODULE` and optional `CHROMIUM_EXECUTABLE` for the operator's browser runtime. Neither uses an existing user's identity or grants staff roles.

## Paged preview and connection requirement

The preview and published editions now use numbered newspaper sheets, with page navigation, an opening masthead, running headers and separate print pages (A3 portrait). Stories are kept whole, in their saved order; pagination accounts for longer edits. Mobile stacks stories within each numbered page for readability.

Personal draft generation now requires the account to have an unexpired MCP key with curation scope and a successful authenticated tool call. Creating a key or listing tools is insufficient. Read-only, expired and revoked connections do not qualify. This is enforced by the shared generation service, including browser API and MCP callers. Run `get_newspaper` to validate a newly connected client before requesting generation. Existing drafts and public examples remain readable and editable. This requirement does not imply that clicking Generate invokes an external AI: it assembles sourced material from saved settings; the connected client can then edit it through the tools.

Validation: 30 unit tests; isolated integration checks for absent, unvalidated, read-only, expired and revoked connections; three-page example with ten stories; 390px mobile without horizontal overflow; printed PDF also three pages.

## Named-feed fixes

Named feeds remain limited to twenty, independently of the ten RSS source connections. The form now offers an explicit Add another feed action, reports save/validation errors beside the fields, and creates valid addresses for short names (for example, AI becomes ai-feed). A saved feed can be previewed privately with a validated curation connection; this does not replace drafts or publish anything. Preview access checks account ownership.

Selected source filters now exclude unselected personal RSS sources. Optional required keywords/phrases restrict stories to at least one comma-separated term, while interests remain ranking preferences. Feed labels do not filter content. Published editions retain their issued content until the owner publishes a new edition. Existing saved feeds are not rewritten.
