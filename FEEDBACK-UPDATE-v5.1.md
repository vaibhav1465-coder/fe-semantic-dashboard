# FE Semantic Dashboard — Feedback Update v5.1

Implemented without changing the operational APIs or provenance logic:

1. Rewrote visible dashboard copy in simple English.
2. Added the exact editorial message: contextual, relevant and meaningful for readers.
3. Moved Approved/Rejected status below the reason and metrics.
4. Removed the score progress/status bar.
5. Grouped the latest processed source articles with three or more suggestions when available.
6. Removed the horizontal table/carousel experience. Each source article now appears in one complete frame.
7. Rebuilt the layout in a Financial Express-inspired red, white and editorial-newsroom theme.
8. Added subtle 3D depth, raised cards, shadows and responsive hover movement.
9. Kept Google NLP, WordPress REST, RSS, cache, last-crawl provenance and editorial action APIs unchanged.
10. Added an Apps Script to update the already-published evaluation form into simple English.

Validation:

- `npm test`: 29/29 passed
- `npm run verify`: passed
- No Google credentials, environment secrets or private keys are included
