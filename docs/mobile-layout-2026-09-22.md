# Mobile layout review — 22 September 2026

The update retains TBN’s palette, tag colors, reading order and explicit refresh. Changes target phone layouts up to 700px, a narrower header treatment at 380px, and coarse-pointer tablet controls. Desktop newspaper layout and print rules are preserved.

| Page or route family reviewed in source | Mobile changes |
|---|---|
| `/briefings`, `/briefings/[shortId]`, `/story/[id]` | Heading separated from controls; two-column interest buttons; full-width mark-as-read actions at both ends; readable title/section scale; metadata and long archive links wrap; flag dialog bounded by viewport height. |
| `/`, `/saved`, `/archive?id=…` | Content tabs fit the available width; actions wrap; search fields use readable 16px inputs; topic/country controls have larger touch targets; story controls wrap without shrinking labels. |
| `/archive` | Dates and edition links wrap cleanly. No new archive navigation link added. |
| `/account` and `/account/topics`, `/sources`, `/delivery`, `/ai`, `/settings` | Role-filtered native account section selector on phones; single-column forms; larger inputs, checkbox labels and actions; safe-area-aware save bar; long addresses and keys contained. Email capitalization/spellcheck disabled. |
| `/account/access`, `/editorial`, `/analytics` | Same navigation and forms; reviewer form labels spaced consistently; review history readable; scrollable tables are keyboard-focusable with accessible labels; long IDs and diagnostic text contained. |
| `/account/rankings` | Existing redirect to analytics retained. |
| `/account/preview`, `/[newspaper]`, `/[newspaper]/[feed]`, `/examples/daily-2026-09-17` | Existing single-column phone newspaper preserved; masthead scale bounded; long names wrap; preview controls and page links have larger targets. |
| `/about`, `/privacy`, `/terms`, `/unsubscribe` | Shared prose heading/spacing and button improvements; footer links wrap and have larger touch areas. |
| All pages | Header/account dropdown, visible focus for details/table regions, 44px primary control targets on phones, and overflow handling. No font-scale or pinch-zoom restriction introduced. |

Validation: all 84 existing unit tests passed; production build passed. All page route files and shared UI components reviewed in source. No account data, feedback, flags, publication or delivery mutations were used for this review. Mobile selector destinations remain a fixed local allowlist filtered with existing role permissions; server authorization is unchanged.

Limitation: browser visual/interaction checks could not run. The native browser tool denied the local preview because it could not verify the administrator-enforced security policy. No browser-security workaround was attempted. Actual iOS/Android rendering, virtual-keyboard behavior and authenticated mobile flows still need visual confirmation; do not describe this as a device-tested audit.
