# Briefing interest and save controls

Replaced emoji votes with Interested / Not interested across feed cards. Briefings reuse the same controls at the top and bottom, plus Save / Saved at both positions. Existing Next and Mark as read navigation remains unchanged.

Both placements and feed cards synchronize after successful interest writes through a shared event; other tabs invalidate their cached feedback and reload. Clicking the selected interest removes it. Account feedback uses the existing authenticated, rate-limited endpoint and article/source ranking aggregation, including existing sparse-cohort protections. Ranking weights are unchanged and the visible reading order does not change on feedback. Guest interests remain in local browser storage and do not contribute to shared rankings.

Save uses the existing reading endpoint/local guest store and read-state synchronization. Saved state is independent of read status. Failed writes show an error without claiming success. Account changes reload interest state, and controls remain disabled until state is loaded.

Validation: production build passed; 75 unit tests passed, including new coverage for synchronized guest interests and clearing, signed-in endpoint use and failed writes, cross-tab cache invalidation and listener cleanup. Existing reading synchronization tests remain passing. Browser interaction/visual validation is unavailable due to the previously reported browser policy-verification failure.
