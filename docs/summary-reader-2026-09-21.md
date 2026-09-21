# Summary reader

The landing page keeps its feed layout and ranking; cards display the source-derived excerpt/English translation, with Summary links opening the separate `/briefings` reader. Header navigation exposes Feed and Summary. The reader orders public, prepared summaries by source publication time (newest first), with stable ID tie-breaking and bounded 100-item batches plus Older summaries. A selected pending story remains accessible with its existing preparation notice. Private source items cannot enter the public reader. The new path is reserved against newspaper names; no existing collision was found.

Mark as read saves the existing account read record, or the existing guest browser record, before dismissing and advancing. A failed save leaves the summary visible. Next skips without claiming it was read and lasts for this visit; Refresh reloads current content and resets skips. Read changes notify other views/tabs and refresh on return/focus; they do not poll for new stories or rerank an open feed. Guest history stays in browser storage, while signed-in read writes use the existing authenticated endpoint. Guests do not gain cross-device synchronization. Original story URLs retain all metadata/content and now expose reader controls too.

Summary content is shared between routes and retains tags, publication, authors, timestamp, source link, evidence limits, overview, key points, generation provenance, sharing and IPFS reference. Generated summaries remain distinguished from full publisher articles.

Validation: 72 unit tests passed, including local guest persistence/preservation of saved flags, signed account writes without browser history storage, and failed writes without success notifications. Production build passed. Browser visual validation was attempted but blocked because the browser tool could not verify the administrator-enforced policy; no bypass was attempted. No publisher requests, test emails or source/ranking changes were made for this work.

## Follow-up: unified Briefings and continuous scrolling

The public UI now uses Briefings labels, removes the Feed navigation link/back link and reading-status subtitle, and labels the action Mark as read. The top-left TBN brand remains the home link. Tags use the exact feed `topic colored-tag` classes and shared color function/theme variables.

The reader now displays a continuous chronological list, fetching older posts in 30-item keyset batches with no fixed total-page cap. All public source kinds are eligible, including articles, podcasts, structured data and posts without a generated briefing; pending entries retain source text and preparation status. Private items remain excluded. The initial snapshot boundary prevents newly fetched items from being injected during scrolling; only Refresh starts a new snapshot. Read/Next dismiss a post and move to the following one. Existing guest/account read synchronization remains in place.

Pagination only reads stored source data and completed translation records. It does not fetch publishers, enqueue translation work, increase collection frequency or change ranking. A Load more/Retry fallback supplements automatic scrolling. No private source inclusion or source-catalog expansion is implied by all public sources.

Validation: 72 unit tests and production build passed. A rollback-only database fixture validated multiple pages with tied timestamps, unique IDs, all three source kinds, multiple sources, pending/generated posts, selected starts, and private/future exclusion. All fixture tables were created within one transaction and rolled back before destroying the connection. Visual browser verification remains unavailable due to the previously reported administrator-policy check.

## Completed briefings only

Following the reader's correction, both the initial page and all scrolling batches now require a generated briefing document. Newer source posts with pending/missing documents no longer appear as preparation cards. Completed briefings remain newest-first by source publication time, across every public source kind; existing read-state exclusions still apply. IPFS pinning is not required to read an already completed briefing. This supersedes the preceding inclusion of pending entries.

Validation: 72 tests and production build passed. Updated rollback-only pagination fixture verifies that newer null/missing documents cannot displace the newest completed briefing, while multi-page ordering, source-kind coverage and private/future exclusions remain correct.
