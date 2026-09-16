# News service authority

News has an isolated PostgreSQL database and login role, not access to CRM application tables. The Vercel server enforces account ownership for all private records.

- `CRON_SECRET`: protected collection, publication and delivery job endpoints. Never delivered to browser code.
- `EDITOR_SECRET`: claims public editorial jobs and submits validated summaries. No account data or arbitrary URL/proxy access.
- `WORKER_SECRET`: wallet delivery queue, reachability reporting and acknowledgements. It does not authorize email, database administration, ENS changes or asset transfers.
- Resend key: restricted to sending for the verified bittrees.org domain. Application code fixes the sender to main@bittrees.org. Provider domain scoping is broader than one exact mailbox; rotate the key on compromise.
- Resend webhook secret: signature verification for provider events only.

mail.bittrees.eth must be resolved and its actual controlling signer authorized before wallet delivery activates. No root Safe key, seed phrase, or user key belongs in News. Connecting a user wallet only requests SIWE authentication. Recipient wallet proof does not grant authority to operate the sender.

Revocation: remove/rotate the scoped environment credential and restart its worker. Pause a destination to cancel pending jobs; sender execution rechecks consent. A message already accepted by a provider cannot be recalled. Uncertain sends require reconciliation and are not automatically resent.

## News staff roles

News roles are independent of Mercado. Only verified login identities grant staff access; an ENS label, display name, client preference or role tag cannot grant authority.

- **Member:** existing reading, personal newspaper and delivery tools. No score diagnostics or staff access.
- **Moderator:** record article flags and review notes in the staff review queue. Cannot approve reviews, inspect scores or manage roles.
- **Editor:** moderator capabilities plus approval of reviews. Review status does not itself remove, rewrite or republish an article.
- **Admin:** editorial review and article-score/ranking diagnostics. No team-role management.
- **Super-admin:** admin capabilities and assignment of roles to verified identities.

Team management and review are in Account → Settings. Article IDs are available under Editorial review for staff. Role writes and reviews are audited. Linked identities on one account contribute their highest verified role. Remove all elevated grants for that account to fully revoke access.

Protected recovery grants: `raging@bittrees.org` and `0xe5350d96fc3161bf5c385843ec5ee24e8b465b2f` (resolved from `raging.eth` on Ethereum mainnet on 17 September 2026). These activate only after normal email verification or SIWE sign-in. They cannot be demoted in the web interface. Future ENS ownership changes do not silently transfer News authority; wallet rotation requires explicit configuration.

Article ranking data is removed server-side from member/public editions, named feeds, personal feeds and personal AI responses. Ranking endpoints also require admin/super-admin access. Internal editorial scoring and story ordering continue unchanged. Roles do not grant access to other members' private sources, deliveries or settings; worker credentials keep their existing scopes.
