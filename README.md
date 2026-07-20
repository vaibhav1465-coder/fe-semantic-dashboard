# FE Semantic Interlinking — Fully Operational Build v5.3

This package preserves the approved Financial Express dashboard UI/UX and makes the data-source layer operational through code.

## Live source order

Every article lookup follows this automatic fallback chain:

1. **Financial Express WordPress REST API**
2. **Financial Express RSS/Atom feeds** discovered from the FE syndication directory
3. **Article HTML metadata/body extraction**
4. **Persistent/static cache fallback**

No dashboard row needs to be manually edited.

## Operational functions included

- Live Google Cloud Natural Language sentiment and entity analysis
- 30-day NLP result cache with stale-cache protection
- WordPress REST article-list and single-article lookup
- RSS/Atom feed discovery, parsing, deduplication and freshness sorting
- Supabase-backed persistent content/NLP cache
- In-memory and local-file cache fallbacks
- Daily Vercel cron cache warm-up
- Suggested anchor-text generation
- Exact placement recommendation
- Source-newer / target-older validation
- Same-URL and duplicate-pair blocking
- Persistent Used / Ignore / Reject actions
- Source, NLP and cache provenance in the existing dashboard UI
- Health, source, content, NLP, cache and self-test APIs
- Automated unit, UI and package-verification tests

## API endpoints

- `GET /api/health` — product, dataset, cache and source configuration
- `GET /api/recommendations` — processed recommendation dataset
- `GET /api/actions` and `POST /api/actions` — editorial decisions
- `GET /api/content?source=auto&limit=20` — latest FE content
- `GET /api/content?url=ARTICLE_URL` — resolve one article through all fallbacks
- `GET /api/nlp` — Google NLP configuration status
- `GET /api/pair-entities?source_url=...&target_url=...` — on-demand Google entities for an opened recommendation
- `POST /api/nlp` — analyze supplied text or an FE article URL
- `GET /api/sources` — configured/cached source status
- `GET /api/sources?live=1` — live WordPress REST and RSS probe
- `GET /api/cache` — cache diagnostics
- `DELETE /api/cache?prefix=PREFIX` — protected cache clear
- `GET /api/self-test` — offline-safe product checks
- `GET /api/self-test?live=1` — live WordPress, RSS and Google NLP test
- `GET /api/cron-refresh` — protected scheduled source/cache warm-up

## Server-side configuration

Copy `.env.example` to `.env.local` for local testing. On Vercel, add the same values under **Project → Settings → Environment Variables**.

Required for live NLP:

- `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`
- Natural Language API enabled in the matching Google Cloud project

Recommended for persistent shared cache and editorial actions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACTIONS_TABLE=fe_editorial_actions`
- `SUPABASE_CACHE_TABLE=fe_semantic_cache`

Run these SQL files once in Supabase:

- `supabase/001_editorial_actions.sql`
- `supabase/002_semantic_cache.sql`

Required security values:

- `REFRESH_SECRET`
- `CRON_SECRET`

WordPress/RSS values:

- The code includes the standard FE WordPress REST posts endpoint as a default.
- Tech can replace it through `FE_WORDPRESS_REST_URL` when FE uses a custom/internal endpoint.
- RSS links are discovered automatically from `https://www.financialexpress.com/syndication/`.
- Tech can supply exact feed URLs through `FE_RSS_FEED_URLS`; configured URLs override discovery.

## Run locally

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

Useful test URLs:

```text
http://localhost:3000/api/health
http://localhost:3000/api/sources?live=1
http://localhost:3000/api/self-test?live=1
http://localhost:3000/api/content?source=static-cache&limit=5
```

## One-command refresh

Run:

```powershell
.\run-full-refresh.ps1
```

The script automatically:

1. Loads `.env.local` or `.env`.
2. Imports the current dashboard data when no input file exists.
3. Tests WordPress REST, RSS, cache and Google NLP configuration.
4. Resolves article content through the full fallback chain.
5. Runs Google NLP or reuses valid cached results.
6. Regenerates anchor and placement recommendations.
7. Applies date, URL and duplicate safeguards.
8. Runs all automated tests and package verification.

For a strict production gate, run:

```powershell
.\run-production-readiness.ps1
```

## Cache behaviour

- WordPress/RSS list cache: 5 minutes by default
- Article cache: 6 hours by default
- Google NLP cache: 30 days by default
- Stale data may be served temporarily when a live source fails
- Supabase is used for persistent shared cache when configured
- Local development uses a file + memory cache
- Vercel without Supabase uses process memory plus the bundled static fallback

## Vercel automation

`vercel.json` schedules `/api/cron-refresh` daily at **02:00 UTC**. The endpoint warms the latest FE source cache and Google NLP cache. Vercel protects it using `CRON_SECRET`.

## Deployment rule

Deploy this package to a **Vercel Preview** first. Do not promote it to production or merge it into the production branch until the preview and `/api/self-test?live=1` are approved.

## Honest readiness note

The code is complete and offline tests can validate the implementation. Google NLP can only return **live** after valid server-side Google credentials are added. WordPress REST can only be marked **live** after the FE endpoint responds from the deployment environment. If either source is unavailable, the dashboard explicitly reports the failure and uses RSS/cache rather than displaying a false success.



## Version 5 production release

The approved dashboard UI is retained. The production header now reports the actual data provenance used by the application:

1. **WordPress REST API** when the live post endpoint responds.
2. **RSS Feed** automatically when WordPress REST fails.
3. **Fallback Cache** when both live article sources are unavailable.
4. **Last Crawl** when the product must rely on the last processed recommendation batch.

Entities and sentiment are labelled separately as **Google NLP API**, **Google NLP Cache**, **Google NLP Stale Cache**, or **Last Crawl**. The Google NLP last-known status is persisted through the configured cache layer, and the dashboard never labels cached data as live.

The stakeholder success-metrics page is intentionally deferred and is not included in this production release.


## v5.2 live article list

The dashboard requests `/api/live-recommendations?limit=60&candidates=500&min_suggestions=2&max_suggestions=3`. It checks up to 500 recent Financial Express WordPress posts and returns the latest 50–60 eligible source articles with two or three qualified internal linking suggestions each. A suggestion is excluded unless it contains a valid target URL, anchor text, placement guidance and a clear reason. The bundled processed crawl remains the safe fallback when the live WordPress request is unavailable.


## v5.8 Google entity coverage

When an expanded recommendation has a reliable named entity shared by both articles, the dashboard labels it **Shared by both**.

When Google NLP completes but no reliable shared entity exists, the dashboard now shows the strongest filtered named entities from the **Source article** and the **Suggested article** separately. These article-level entities are not presented as shared evidence and are not added to the match score.

The UI loads entity requests sequentially per expanded article and retries one transient failure once. Generic words, years, dates, prices and numbers remain excluded.
