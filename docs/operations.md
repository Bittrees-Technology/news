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

`bittrees-news-translation.service` runs `worker/translate.py` on the existing Bittrees model node, using the editor's existing private configuration. Portuguese uses the local Argos 1.9 Portuguese-English neural model with CTranslate2; other languages use the loopback model endpoint. It polls authenticated `/api/editor/translation/claim` and `/result` routes with the existing editor credential. No paid translation API is used.

Public-source titles and displayed summaries are translated into English separately from editorial selection. Source text, ranking evidence, source links and publication snapshots are preserved. The UI labels automatic translations and offers the original wording. Geography filters use the English display text. Private sources and personal annotations are excluded from this public worker's queue.

The translation cache key includes source item ID, original headline, displayed summary and target/version (`en-v1`), so edits automatically require a new translation. English results are cached without rewriting source wording. Claim leases prevent stale workers from replacing results. Jobs retry up to three times; originals remain readable if translation fails. Browsers poll pending translations without page reload. New public editions queue translations automatically; previously published editions are populated when read. Language selection and additional publications can be added later without changing stored originals.

The dedicated Python environment at `~/.local/lib/bittrees-news/translation-env` installs `langdetect==1.0.9` (see `worker/translation-requirements.txt`). Deterministic, high-confidence English detection for both fields skips model work; uncertain or mixed-language text still reaches the model.

To activate after deploying the web routes and migration, copy `worker/translate.py` to `~/.local/lib/bittrees-news/translate.py` and its service to `~/.config/systemd/user/`, then enable/start `bittrees-news-translation.service`. This service shares the local model with the editor but has its own lock and retries. Inspect failures via the service journal and the `translations` table, without logging service credentials or source payloads.

Portuguese model setup: download `https://argos-net.com/v1/translate-pt_en-1_9.argosmodel` from the official Argos index, then run `worker/install-translation-model.py <archive>` on the node. The installer checks SHA256 `ae76df6f650895c16f2b582065014fab496755ca846ecb19fae81d51f332a38e` and extracts to `~/.local/state/bittrees-news/models/translate-pt_en-1_9`. The package README/metadata and model files remain together. The worker uses two CPU threads and a 768 MB memory limit. Install all pinned runtime requirements from `worker/translation-requirements.txt`.

Translation output must be detected as English before submission; unchanged non-English title/summary pairs are rejected server-side. English detection does not invoke the model when both fields are confidently English. Public source links and original text are never replaced in storage.

## Standalone public briefings and IPFS

`worker/stories.py` uses the existing editor credential and local model, claims only public-source rows from `story_documents`, produces an original overview/key-points/limitations document, saves the validated response, pins that exact JSON through the existing localhost Kubo API, and records the returned CID. Install `worker/bittrees-news-stories.service` on Acer. No new public admin API or model port is opened. Failed claims become eligible again after 15 minutes; completed-but-unpinned documents retry without regeneration. This is one Bittrees pin, not a redundant pinning guarantee.

Newly collected public sources enqueue automatically. Private sources never enqueue and the story route denies them. Pages `/story/<id>` show author when provided, source publication, publication date, original link, generation time/model, and archive status. Existing stories can be queued using `scripts/queue-story-briefings.ts`. Source feed context (up to 12,000 characters) is internal model evidence and excluded from public score-redacted responses. The archive contains the original generated briefing and attribution, not full source articles, accounts, votes or private connections. Model-generated prose is labeled as such and limited to available feed evidence; it is not independently verified reporting. IPFS content may remain retrievable after removal from this site.
