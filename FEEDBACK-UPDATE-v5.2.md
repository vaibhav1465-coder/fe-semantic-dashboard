# FE Semantic Internal Linking v5.2

## Requested newsroom changes

- Loads the latest 50–60 eligible Financial Express article URLs from WordPress REST.
- Shows one source URL per compact row instead of article cards.
- Opens recommendation information in a dropdown below the URL.
- Shows two or three qualified link suggestions per source article.
- Checks a pool of up to 500 recent FE articles, increasing the possible recommendation set to roughly 120–180 qualified suggestions.
- Does not show a recommendation unless anchor text, placement guidance and a clear reason are all available.
- Keeps status at the end of each recommendation.
- Removes the carousel, slider, card grid and score progress bar.
- Uses simple English and corrected newsroom copy throughout the dashboard.
- Keeps Financial Express styling, responsive layout, subtle depth and existing provenance APIs.
- Uses live WordPress metadata and semantic term overlap for the 60-article list. Existing Google NLP provenance and API checks remain available.

## Quality behaviour

The engine first uses the configured match threshold. If fewer than 50 eligible source articles are found, it can reduce the score threshold to a controlled minimum of 20, while still requiring at least two meaningful shared topics and complete anchor, placement and reason fields. Weak matches are never added simply to reach the target count.

## Validation

- 32 automated tests pass.
- Operational package verification passes.
- Invalid `nodejs22.x` runtime removed from `vercel.json`.
