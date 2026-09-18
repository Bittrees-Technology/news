# RSS inputs and outputs

Input: Account → Sources accepts public RSS and Atom feed URLs, using bounded, SSRF-guarded fetching. Personal connections stay private unless their owner explicitly shares them. The existing collection schedule refreshes catalog feeds three times a day.

Output: `/rss.xml` contains up to 100 top-ranked public items published in the preceding 24 hours. RSS 2.0 includes stable item IDs, source dates, categories/kinds, available author attribution, summary text, original source links and public Bittrees briefing links. Feed readers may choose their own date ordering rather than preserving server ranking. The response supports ETags and five-minute public caching.

Published newspapers: `/rss.xml?newspaper=<slug>`; a published section: `/rss.xml?newspaper=<slug>&feed=<section-slug>`. These read only the explicitly published snapshot and use no-store responses, so unpublishing blocks subsequent retrieval immediately. Private/draft newspapers return 404 even to signed-in visitors. Previously downloaded copies cannot be recalled from a reader. Private authenticated RSS subscription links are not implemented.

An RSS link appears in the footer and on published newspaper pages; the main page advertises RSS autodiscovery. Feed output does not expose scores, credentials, account details or internal source evidence. Summaries are escaped as safe text within RSS HTML descriptions.
