# Unified topics and interests

The account topics page now has one panel and one save action. Each topic has mutually exclusive Include, Focus and Block choices. Existing focused topics and account exclusions are loaded; a legacy conflict displays Block. Countries and regions retain searchable block controls. Written interests, excluded phrases and delivery length live in the same form.

The authenticated topic-settings write validates the entire request, removes blocked topics from focus choices, then saves preference fields and exclusion fields together in one database update. It merges only the fields owned by this form, retaining source choices, required keywords, read visibility, sorting and temporary reader focus. Account/newspaper/ranking presentation caches are invalidated, and the account workspace retains the saved preferences when navigating between sections. An invalid request changes neither set of settings.

Existing scopes remain explicit: focus/interests/phrase exclusions configure personal selection and deliveries; topic/country/region blocks configure signed-in reading views. Public global rankings and publication settings are unchanged. Open readers still require explicit refresh.

Validation: 84 unit tests passed, production build passed, rollback-only database/API checks verified authenticated save, signed-out denial, conflicting topics, retention of unrelated fields and atomic rejection of invalid delivery length. No production user settings were changed for testing. Visual browser validation remains blocked by administrator policy verification.
