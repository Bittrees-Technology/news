# Briefing attribution and immutable share links

Phys.org example: `0584b1ed394490b108453c664f452269ae43abfd6e02e62de46ddcb77e572363`. The stored feed metadata and generated archive contained an empty author list. The article byline was verified from the user's screenshot: Tanja Vogel, German Institute of Development and Sustainability (IDOS); Lisa Lock edited, Robert Egan reviewed. Direct article inspection through the web tool was unavailable and a single HTTP fetch returned 400. No repeat publisher probes or mass crawling were added. “Not supplied by source” is now “Not available in collected metadata”; absent feed metadata does not imply the publisher omitted a byline.

Corrected the item's attribution with a provenance record, preserved it against subsequent empty feed updates, and queued only archive work on the existing document. Text and original generation time were retained; correction time is separate metadata. The worker pinned the correction without new model inference. Article-page author acquisition for other missing bylines is not implemented by this targeted correction.

Each public pinned version is retained in `briefing_versions`. A unique 20-character suffix aliases the full CID through `/briefings/<short-id>`; collisions fail closed at the database constraint. CIDs themselves are not truncated for IPFS access. Existing public snapshots were backfilled before deployment and again after the deployment gap. Pin acknowledgements atomically insert future version records. Private ownership is rechecked when resolving a short link. Archived content and attribution are read from the frozen document, not newer mutable item fields.

The reader replaces its address as the displayed post changes. Share briefing and the visible Briefing ID use the same path. Explicitly linked briefings open even if already marked read; advancing still saves read state and moves to older unread content. Older versions retain their old links. Legacy `/story/<id>` and selected `/briefings?story=<id>` links remain supported.

Deployment: `5c749e8`, production alias verified. 79 unit tests and production build passed. Rollback-only database checks passed for version isolation, short-ID collision rejection, private/invalid exclusion, and stable completed-briefing pagination. Both example version URLs returned HTTP200 with the expected CID in their payload. Corrected archive was read through the Acer local IPFS endpoint and confirmed Tanja Vogel, IDOS and the unchanged generation timestamp. Browser interaction testing remains unavailable due to the earlier administrator-policy verification failure.

- Corrected: https://news.bittrees.org/briefings/czk5h2nacxsi2hrasv7i
- Corrected CID: `bafybeiarxcmujdqzufum3pb72m4ehlvz4wh7jtczk5h2nacxsi2hrasv7i`
- Previous: https://news.bittrees.org/briefings/kl6yhtzucsnkcr4ct4ce
- Previous CID: `bafybeibxbrmboduziatw7cjvwfxycmpoybgo7xkl6yhtzucsnkcr4ct4ce`
