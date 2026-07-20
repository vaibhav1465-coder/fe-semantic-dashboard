# FE Semantic v5.8

## Google entity coverage and reliability

- Google NLP no longer appears missing merely because two articles do not share an exact named entity.
- Shared named entities are shown as **Shared by both**.
- When no shared entity exists, the strongest meaningful Google entities are shown separately for the **Source article** and **Suggested article**.
- Article-level entities are never presented as shared match evidence and are never added to the match score.
- Generic entities, years, dates, prices, numbers and weak terms remain excluded.
- Entity requests run sequentially within each expanded article to reduce burst failures and improve cache reuse.
- One automatic retry is used for a transient server or Google NLP failure.
- Entity response cache version increased to 5.8.
