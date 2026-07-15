# FE Semantic Preview Deployment Checklist

## Before preview deployment

- [ ] Run `supabase/001_editorial_actions.sql`
- [ ] Run `supabase/002_semantic_cache.sql`
- [ ] Add Google service-account JSON to Vercel server-side environment variables
- [ ] Add Supabase URL and service-role key
- [ ] Add `REFRESH_SECRET` and `CRON_SECRET`
- [ ] Confirm `FE_WORDPRESS_REST_URL` with the Tech team
- [ ] Add exact `FE_RSS_FEED_URLS` only when Tech provides them; otherwise automatic discovery is used

## Preview validation

- [ ] `/api/health` returns `healthy`
- [ ] `/api/sources?live=1` shows WordPress REST or RSS as `live`
- [ ] `/api/self-test?live=1` does not contain a failed test
- [ ] Dashboard shows Google NLP as `Live` or `Cached`, not fake `N/A`
- [ ] Anchor text is visible in its dedicated column
- [ ] Date and duplicate validation are visible
- [ ] Used / Ignore / Reject survives refresh and another browser
- [ ] CSV export includes anchor text and editorial action
- [ ] Current production URL remains untouched until approval


## Version 5 provenance checks

- [ ] `/api/provenance?live=1` reports WordPress REST when live.
- [ ] If WordPress REST fails, the dashboard header reports RSS Feed.
- [ ] If WordPress and RSS fail, the header reports Fallback Cache or Last Crawl.
- [ ] Google NLP header reports Live only after a successful live NLP call.
- [ ] Cached or stale NLP results are never presented as live.
- [ ] Success metrics remain out of the production UI for this release.
