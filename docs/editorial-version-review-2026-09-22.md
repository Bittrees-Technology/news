# Editorial review identifiers

Editorial staff can resolve an article ID, 12-character briefing ID, legacy 20-character ID, full IPFS CID, or TBN story/briefing URL. The lookup shows the linked article ID, selected briefing ID, title and original-source link. Staff-only Editorial review links on briefing controls preselect the displayed version.

Review records now retain `briefing_cid`; the staff audit records both canonical article ID and reviewed CID. Lists link to the reviewed briefing and its IPFS archive, and separately identify a different current briefing. Existing reviews stay unversioned because their reviewed versions cannot be inferred safely. The UI submits the previewed CID; a changed article-level target returns 409 rather than recording a review against a different version. Review status remains an editorial record, not a publishing/removal action.

Role gates are unchanged: moderators may flag/review, editors/admins may approve. Both lookup and listing require public ownership; private records cannot be resolved. No existing review or role was changed during implementation.

Validation: 82 unit tests and production build passed. Rollback-only PostgreSQL fixtures verify article/current-CID mapping, exact archived version resolution by all identifier formats, short-alias collision rejection and public/private isolation. Browser interaction checks remain unavailable due to the existing browser-policy verification limitation.
