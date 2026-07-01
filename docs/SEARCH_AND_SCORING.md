# Search and Scoring

## Search

Search is lightweight and deterministic.

The search pipeline:

1. Normalize the query.
2. Compare it against the entry text, tags, topics, use cases, and notes.
3. Reward exact phrase matches, token overlap, and category alignment.
4. Return a ranked list with a short reason.

## Scoring

Scores are intentionally transparent.

Scoring favors:

- Clear task fit
- Strong maintenance state
- Usable license
- Low acquisition risk
- Good documentation

Scoring penalizes:

- Unclear licensing
- Staleness
- Large or risky surfaces
- Weak maintenance

## Interpretation

- `80-100`: strong candidate
- `60-79`: useful with review
- `40-59`: niche or mixed fit
- `0-39`: low priority or reject

