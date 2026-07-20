# FE Semantic v5.7

## Entity-quality fix

- Rejects generic Google entities such as `history`, `world`, `results`, `event`, standalone years, dates, numbers and prices.
- Matches reliable named-entity variants such as `FIFA World Cup` ↔ `World Cup` and `HDFC Bank` ↔ `HDFC`.
- Removes standalone years from entity display names.
- Prioritises people, organisations, locations, events, works and named products.
- Hides the Google Entities field when no reliable shared named entity exists.
- Adds an entity-quality response version to bypass older cached pair responses.
- Keeps Google entities separate from the semantic match score.
