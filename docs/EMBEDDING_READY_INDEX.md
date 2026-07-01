# Embedding Ready Index

The generated index is already shaped for retrieval and embedding pipelines.

## Best fields

- `id`
- `name`
- `owner`
- `repo`
- `category`
- `type`
- `summary`
- `aliases`
- `stack`
- `tags`
- `primaryUseCases`
- `searchText`
- `riskLevel`
- `acquisitionMode`
- `entryPath`

## Why it works

- It is deterministic.
- It is compact.
- It keeps the acquisition and risk signals near the content.
- It can be regenerated from the full entry set at any time.

