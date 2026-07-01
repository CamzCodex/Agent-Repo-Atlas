# Starred Repo Import Workflow

Use this workflow to ingest and triage GitHub stars for CamzCodex.

## Commands

```bash
npm run import:starred
npm run triage:starred
npm run build:atlas
```

## What is preserved

The import keeps:

- repo URL
- owner
- name
- description
- language
- topics
- license
- stars
- forks
- archived status
- disabled status
- private/public visibility
- pushed_at
- updated_at
- created_at
- default branch
- homepage
- size
- open issues count

## Output files

- `registries/starred/starred-import.json`
- `registries/starred/starred-review-queue.json`

## Triage rule

Do not auto-create a full atlas entry for every star. Keep low-confidence items in the review queue and only promote the most useful candidates.

