# News SEO and identity audit — 18 September 2026

Implemented:
- Original vector newspaper/sprout logo in the existing navy/blue palette, header branding, 32px ICO, scalable SVG favicon, Apple touch icon, 192/512px icons and web manifest.
- 1200×630 social preview with Open Graph and Twitter summary-card metadata.
- Consistent TBN site naming, title template and page-specific descriptions for public pages.
- Self-referencing canonicals for home, About, Privacy, Terms, archive index, each dated archive edition, and publicly published newspapers/feeds.
- WebSite and Organization JSON-LD on the homepage. No invented readership, reviews, author credentials, or claim of original reporting for publisher excerpts.
- Dynamic sitemap containing public editions and published newspapers/snapshot feeds only. Reads at request time so unpublishing removes entries. Bounded to 1,000 recent archive editions and 5,000 newspapers; partition the sitemap before those limits are reached.
- robots.txt advertises the sitemap. Account, saved-library, unsubscribe, private/unknown newspaper metadata and the sample edition are noindex. Account pages remain crawlable for engines to see noindex; robots.txt is not a privacy control. Existing server ownership checks remain the access boundary.
- API responses carry X-Robots-Tag: noindex, nofollow.
- Invalid archive IDs now return 404 instead of a success response with an error message.

Inspected: server-rendered content, page headings, public source links, existing mobile viewport, HTTPS metadata, cache behavior, asset dimensions, private-page indexing boundaries and public publication state. Tests and build cover regressions; deployed HTTP checks cover metadata and assets.

Remaining external work:
- Verify domain ownership in Google Search Console and Bing Webmaster Tools, then submit https://news.bittrees.org/sitemap.xml. No verification code was provided or fabricated; submission is not claimed.
- Search indexing and search snippets are controlled by search engines and may take time. No ranking guarantee.
- Real-user Core Web Vitals and search performance need sufficient traffic/verified search-console data. No field-performance score is claimed.
- Content discovery is source-linked aggregation. Editorial transparency and original analysis are ongoing content work, not replaceable with metadata or keyword stuffing.

References: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap and https://developers.google.com/search/docs/appearance/site-names
