# FE Semantic Internal Linking v5.3

## Minor newsroom fixes completed

- Generates shorter, more specific anchor text instead of copying broad article headlines.
- Excludes a recommendation when a specific anchor, placement or meaningful reason cannot be produced.
- Explains every match score using the exact 100-point weighting: title similarity, shared title terms, description similarity, shared description terms, category overlap, tag overlap and section relevance.
- Removes the visible “Article source”, “How it was matched” and “Status: Approved” fields.
- Adds Google Cloud Natural Language entities beside shared topics. Entities load only when an article row is expanded, which controls API cost and uses the existing NLP cache.
- Filters the live pool to Financial Express article pages with numeric article IDs and excludes section, category, short, video, photo, web-story and podcast pages.
- Corrects filter wording and completes a grammar and spelling review of visible dashboard copy.
- Shows the first 10 article URLs and adds a “Load 10 more articles” button until all filtered results are visible.
- Continues to target 50–60 recent eligible article URLs with two or three qualified suggestions each.

## Validation

- 34 automated tests passed.
- Operational package verification passed.
- JavaScript syntax checks passed.
- No environment files, service-account keys or private credentials are included.
