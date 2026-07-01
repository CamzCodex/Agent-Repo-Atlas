# Embedding Ready Index

The atlas is structured so it can be embedded into a retrieval system with minimal transformation.

## Recommended fields

- `slug`
- `name`
- `description`
- `summary`
- `tags`
- `topics`
- `useCases`
- `acquisitionMode`
- `maintenance.state`
- `risk.flags`
- `license`
- `externalUrl`
- `notes`

## Why these fields matter

- They are concise enough for embeddings.
- They carry enough meaning for ranking and comparison.
- They preserve acquisition safety signals.

## Indexing guidance

- Keep the text factual and compact.
- Use stable vocabulary.
- Avoid stuffing the entry with noisy marketing language.

