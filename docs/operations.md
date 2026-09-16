# Operations

## Schedule

UTC all year. Collect at 07:45 / 11:45 / 19:45; publish prepared editions at 07:57 / 11:57 / 19:57. Publish only complete editions. Late editorial completion publishes when it succeeds and retains its real publication timestamp. Noon delivery builds the daily period; Monday includes weekly subscriptions and the first includes monthly subscriptions. A ten-minute dispatcher drains bounded email batches. Concurrency is controlled with atomic job IDs, database locks and unique destination/period receipts.

## Editorial worker

Install `worker/editor.py` as `~/.local/lib/bittrees-news/editor.py` on the Bittrees model node. Its private 0600 configuration `~/.config/bittrees-news/editor.json` has site, token, model and model_url. Enable the supplied user service with a writable state directory. It connects outbound to News, summarizes only public items with the local loopback model, and checkpoints partial work. Do not expose the model port or grant it News database credentials.

## Deliverability

Use verified DKIM/return-path records and signed Resend bounce/complaint webhooks. Root MX remains on the existing mail server. Email verification challenges are limited per destination and originating IP. The worker must not send to unverified destinations. A newly verified forwarding destination starts paused. Hard bounces/complaints disable matching destinations. Verification-email provider suppression remains enforced by Resend.

## Data and recovery

Use the database provider's encrypted backups/PITR. Before restoring into a live environment, disable all cron triggers and workers, rotate service secrets, pause all destinations, cancel pending/sending delivery records, and reconcile provider receipts before reactivation. Never replay queued sends from a restored backup blindly. Verify restore on an isolated database before production cutover; a restore drill has not yet been completed.

## Monitoring

`/api/health` reports last public snapshot and configured service readiness; configuration flags do not prove end-to-end delivery. `sources` tracks collection status. `jobs` and `editor_jobs` record generation outcomes. `deliveries` distinguishes pending/sending/sent/failed/uncertain/cancelled. Provider acceptance is not proof that a human read the message.

## Wallet worker activation

The persistent user service `bittrees-news-wallet.service` runs on Acer using Node 24. Its 0600 configuration is at `~/.config/bittrees-news/wallet.json`; the isolated signing key never enters Vercel or public source control. The service gates initialization and every send on `mail.bittrees.eth` resolving to the dedicated service address. Import `docs/mail-ens-safe-transactions.json` into the existing controlling Safe's transaction builder, review the two encoded ENS actions and sign with that Safe's existing owners. This retains ownership with the Safe and does not transfer assets or burn fuses. No signature has been executed during rollout.

Once the ENS assignment resolves, the worker creates its own XMTP installation, reports reachability and a heartbeat, and only then can users enable wallet delivery. Public readiness requires a heartbeat less than five minutes old; an environment variable alone is insufficient. Validate a real explicitly authorized recipient in Chirpy before claiming end-to-end readiness. Production XMTP network/gateway availability is an additional runtime dependency.

## English display translations

`bittrees-news-translation.service` runs `worker/translate.py` on the existing Bittrees model node, using the editor's existing private configuration and loopback model endpoint. It polls authenticated `/api/editor/translation/claim` and `/result` routes with the existing editor credential. No paid translation API is used.

Public-source titles and displayed summaries are translated into English separately from editorial selection. Source text, ranking evidence, source links and publication snapshots are preserved. The UI labels automatic translations and offers the original wording. Geography filters use the English display text. Private sources and personal annotations are excluded from this public worker's queue.

The translation cache key includes source item ID, original headline, displayed summary and target/version (`en-v1`), so edits automatically require a new translation. English results are cached without rewriting source wording. Claim leases prevent stale workers from replacing results. Jobs retry up to three times; originals remain readable if translation fails. Browsers poll pending translations without page reload. New public editions queue translations automatically; previously published editions are populated when read. Language selection and additional publications can be added later without changing stored originals.

To activate after deploying the web routes and migration, copy `worker/translate.py` to `~/.local/lib/bittrees-news/translate.py` and its service to `~/.config/systemd/user/`, then enable/start `bittrees-news-translation.service`. This service shares the local model with the editor but has its own lock and retries. Inspect failures via the service journal and the `translations` table, without logging service credentials or source payloads.
