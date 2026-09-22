# Editorial review identifiers

Editorial staff can resolve an article ID, 12-character briefing ID, legacy 20-character ID, full IPFS CID, or TBN story/briefing URL. The lookup shows the linked article ID, selected briefing ID, title and original-source link. Staff-only Editorial review links on briefing controls preselect the displayed version.

Review records now retain `briefing_cid`; the staff audit records both canonical article ID and reviewed CID. Lists link to the reviewed briefing and its IPFS archive, and separately identify a different current briefing. Existing reviews stay unversioned because their reviewed versions cannot be inferred safely. The UI submits the previewed CID; a changed article-level target returns 409 rather than recording a review against a different version. Review status remains an editorial record, not a publishing/removal action.

Role gates are unchanged: moderators may flag/review, editors/admins may approve. Both lookup and listing require public ownership; private records cannot be resolved. No existing review or role was changed during implementation.

Validation: 82 unit tests and production build passed. Rollback-only PostgreSQL fixtures verify article/current-CID mapping, exact archived version resolution by all identifier formats, short-alias collision rejection and public/private isolation. Browser interaction checks remain unavailable due to the existing browser-policy verification limitation.

## Flag action and account menu

The briefing shortcut is now an in-place Flag action for Editor/Admin/Super-admin. It writes an audited flag for the selected archived version, preserves existing review notes, and confirms Flagged without navigation. Top/bottom controls share state. Editorial briefing hyperlinks appear only for flagged versions; unflagged IDs and a different current version remain plain text. Public sharing and normal reading links are unchanged. Role selection moved to account settings; the public header no longer shows active role. My account opens a native disclosure with My newspaper, Account settings and Log out; outside-click/Escape/navigation close it.

84 unit tests and the production build passed. Expanded rollback-only API checks verify successful editor flags, preserved notes, exact flag lookup, member/moderator denial and private-item exclusion. No real article was flagged during validation. Browser visual validation remains unavailable under the recorded policy-verification limitation.
