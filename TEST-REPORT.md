# FE Semantic Operational v3 — Test Report

Generated: 15 July 2026

## Passed

- 21 automated unit and UI regression tests
- Node.js syntax checks across all API, library and script files
- Operational package verification
- Secret-safety check for the browser HTML
- Vercel cron configuration check
- Recommendation processor dry run with cached/no-live mode
- Local API server checks:
  - `/api/health`
  - `/api/sources`
  - `/api/content?source=static-cache&limit=2`
  - `/api/nlp`
  - `/api/self-test`

## Implemented

- Google Cloud NLP REST integration using service-account authentication
- Google NLP result cache and stale-cache fallback
- WordPress REST posts and article lookup
- RSS/Atom feed discovery and parsing
- Source priority: WordPress REST → RSS → HTML → static cache
- Supabase persistent cache support
- Daily Vercel cron cache warm-up
- Live source and cache provenance in the existing UI

## Requires deployment environment to verify as live

- Google NLP live call requires the real server-side Google service-account variable.
- FE WordPress REST requires the production/preview runtime to reach the FE endpoint or the Tech-provided custom endpoint.
- RSS live retrieval requires the FE feed URLs to respond from the deployment runtime.
- Supabase persistence requires the two SQL files and server-side Supabase variables.

The product reports these states honestly as Live, Cached, Failed, Not configured, or Static fallback. It does not display a fake success state.
