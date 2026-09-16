# Source collection triage — 2026-09-16

Rechecked all 34 sources marked unavailable using the repaired collector, storing successful items and their actual check results. 32 recovered; Endpoints News and IMF news continue to return HTTP 403. They remain marked unavailable, with a publisher-access explanation. No access restrictions were bypassed.

Causes corrected:
- The IPv4 guard incorrectly treated all of 192.0.0.0/16 as private. Restrict the special-purpose check to 192.0.0.0/24, preserving the private 192.168.0.0/16 block. NASA and several WordPress publishers use public 192.0.66.* or 192.0.78.* addresses.
- Catalogue feeds with large back catalogues exceeded the 2 MB download cap, and DeFiLlama exceeded 8 MB. Known catalogue endpoints now have a bounded 32 MB limit. Custom account endpoints retain the 2 MB limit; redirects, DNS checks, timeouts and streamed byte limits still apply.
- The homepage displayed the failure count stored in the edition snapshot. It now reads current source status independently, with a last-check timestamp and expandable explanations. Archived edition counts remain labeled as historical.

Feeds with zero recent stories are reachable but may have no articles/episodes inside the collection window; reachability does not imply recent content.

Recheck unavailable sources without publishing an edition or sending messages:

```sh
node --env-file=.env.local --import tsx scripts/triage-sources.ts
```

# Geography filters

Country/territory groupings are derived from Unicode CLDR 48 territory containment (URL retained in `lib/geography-data.json`; license in `docs/licenses/unicode.txt`). English display names are generated with `Intl.DisplayNames`. The additional Middle East grouping is an editorial filter.

Filters match explicit place names and selected aliases in article titles, excerpts, summaries and geographic topics. They are lightweight text classification, not comprehensive geolocation. They do not infer location from a publisher's headquarters. The selectors filter the current edition, preserve topic/content filters, and show an empty state for places without matching stories. Selecting a country replaces the region selection and vice versa; All clears both.
