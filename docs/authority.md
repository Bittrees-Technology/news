# News service authority

News has an isolated PostgreSQL database and login role, not access to CRM application tables. The Vercel server enforces account ownership for all private records.

- `CRON_SECRET`: protected collection, publication and delivery job endpoints. Never delivered to browser code.
- `EDITOR_SECRET`: claims public editorial jobs and submits validated summaries. No account data or arbitrary URL/proxy access.
- `WORKER_SECRET`: wallet delivery queue, reachability reporting and acknowledgements. It does not authorize email, database administration, ENS changes or asset transfers.
- Resend key: restricted to sending for the verified bittrees.org domain. Application code fixes the sender to main@bittrees.org. Provider domain scoping is broader than one exact mailbox; rotate the key on compromise.
- Resend webhook secret: signature verification for provider events only.

mail.bittrees.eth must be resolved and its actual controlling signer authorized before wallet delivery activates. No root Safe key, seed phrase, or user key belongs in News. Connecting a user wallet only requests SIWE authentication. Recipient wallet proof does not grant authority to operate the sender.

Revocation: remove/rotate the scoped environment credential and restart its worker. Pause a destination to cancel pending jobs; sender execution rechecks consent. A message already accepted by a provider cannot be recalled. Uncertain sends require reconciliation and are not automatically resent.
