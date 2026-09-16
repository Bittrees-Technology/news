# Bittrees News

A public newspaper covering world affairs, the economy, technology and science. Read without an account; sign in by verified email or Ethereum wallet to choose sources, add personal RSS feeds, save stories and configure digest deliveries.

- Public newspaper and archived snapshots; source-linked summaries and podcasts.
- 127 curated news, research, podcast and public data endpoints, with measured source health.
- Private PostgreSQL account data, one-time email verification, domain-bound SIWE and 22-hour sessions.
- Private source preferences and feed connections; a saved library across editions.
- Verified email/wallet destinations with explicit opt-in and daily, weekly or monthly deliveries.
- Fixed UTC editions at 07:57, 11:57 and 19:57; daily deliveries at noon, weekly Monday and monthly the first.
- Bittrees-hosted AI through an outbound-only editor on a private node. No public inference port.
- Domain-restricted email sender, signed bounce webhooks and an outbox that does not blindly resend ambiguous messages.

## Development

Use Node 22 or newer. Install with `npm ci`, copy `.env.example` to `.env.local`, configure a dedicated PostgreSQL database, and run `npm run migrate`. Start with `npm run dev`. Run `npm test`, `npm run typecheck`, and `npm run build` before deployment.

`npm run generate` collects sources and prepares the current edition slot. With `EDITOR_WORKER=true`, the private editorial worker completes the generated summaries asynchronously. With no model configured and worker mode disabled, output is explicitly labelled publisher excerpts rather than AI-generated summaries.

## Deployment

The production application is deployed to Vercel. Configure private environment variables; never commit credentials. The cron entries prepare, publish and dispatch separately. Initial schema migration must run before deploying. Preview environments must have separate databases and sending credentials; do not point untrusted preview deployments at production.

See [operations](docs/operations.md), [authority](docs/authority.md), and [delivery status](docs/delivery-status.md). Wallet messaging must remain disabled until sender identity and installation authorization are verified. `worker/editor.py` requires only an editorial token and access to the local model; it has no database or private account access.

## Provenance

Product behavior and compact presentation were inspired by [Snax Daily](https://github.com/snackman/snax-daily). Application code is an original Bittrees implementation. The initial public-source directory uses factual publisher names and feed URLs observed in that reference and adds world/economy, climate, health, Portugal, security and data coverage. Publisher material remains owned by its respective rights holders.
