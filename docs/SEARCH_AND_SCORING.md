# Search and Scoring

## Search

Search uses the generated index and matches against:

- `id`
- `name`
- `url`
- `owner`
- `repo`
- `category`
- `type`
- `tags`
- `aliases`
- `stack`
- `summary`
- `primaryUseCases`
- `searchText`

## Output

Search results include:

- rank
- score
- id
- name
- type
- category
- risk level
- acquisition mode
- URL
- entry path
- short match reason

## Scoring

The scorer is intentionally transparent.

- Strong matches in id, name, owner/repo, category, type, aliases, and tags score highest.
- Summary and use-case matches score next.
- Search-text matches score lower.
- Low-risk entries get a small boost.
- High-risk entries stay visible, but they are labeled clearly and never treated as approved.

