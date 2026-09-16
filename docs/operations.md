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
