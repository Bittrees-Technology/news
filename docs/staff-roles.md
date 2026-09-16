# News staff access

| Role | Permissions |
| --- | --- |
| Member | Manage their own newspaper, sources, topics and deliveries |
| Moderator | Member permissions plus flag and record reviews of public articles |
| Editor | Moderator permissions plus record editorial approval |
| Admin | Editor permissions plus article scores, source scores and ranking history/settings |
| Super-admin | Admin permissions plus assigning roles to verified identities |

Team roles and article review are in Account → Settings. Review annotations do not remove or republish articles. Staff roles do not confer access to other users' private newspapers or delivery destinations, and do not delegate mail, ENS or wallet authority.

Roles are matched against verified login identities on each server request. If an account has multiple linked identities, its highest granted role applies. Role writes and editorial reviews are audited. Super-admin bootstrap grants can be protected from changes through the web interface.

The initial owner grants cover the exact email `raging@bittrees.org` and the verified wallet `0xe5350d96fc3161bf5c385843ec5ee24e8b465b2f`, resolved from `raging.eth` on Ethereum mainnet on 17 September 2026. The email grant becomes available only after successful email verification. ENS transfers do not transfer News authority automatically. No ENS display name or unverified email field grants access. The operator bootstrap uses the all-zero UUID as the audit actor, identifying a deployment operation rather than an authenticated user.

Scores are removed before non-administrator browser/MCP responses are serialized. Ranking endpoints also enforce administrator access. Browser presentation caches clear on identity or role changes; they are never used for server authorization.

Validation: `npm test`, `npm run typecheck`, `npm run build`, and `npx tsx --env-file=.env.local scripts/check-roles.ts`. The integration check creates and removes disposable test identities without sending email.
