# FE Semantic v5.4 — editorial handoff hardening

- The dashboard Last Crawl chip now uses the live recommendation run timestamp. The provenance API continues to preserve the true processed-crawl timestamp and does not relabel a one-article source probe as a crawl.
- Local development now loads `.env.local` and `.env`; a safe setup script is included for Google NLP.
- Match score shows the exact seven components, points earned, maximum points, and calculation logic.
- The quality threshold is fixed at 40/100 by default and is never lowered to inflate article count.
- Google entities remain on-demand and are reported honestly as live, cache, stale cache, or unavailable.
- Production credentials remain server-side only.
