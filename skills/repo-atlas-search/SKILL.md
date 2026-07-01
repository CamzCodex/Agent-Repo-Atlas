# Repo Atlas Search

Use this skill when an agent needs to find, compare, or safely acquire external repositories from the atlas.

## Purpose

The atlas is the first stop for repo discovery. It reduces broad web searching and keeps acquisition decisions explicit.

## Workflow

1. Search the atlas with the user task.
2. Compare the top candidates.
3. Inspect the acquisition mode, maintenance, license, and risk notes.
4. Choose the safest repo that still solves the task.
5. If nothing fits, mark the gap and move to broader research.

## Commands

```bash
npm run search -- "query"
npm run score
npm run validate
```

## Decision rules

- `reference`: inspect for ideas and patterns.
- `dependency-candidate`: candidate for installation or integration review.
- `fork-candidate`: close fit but should be adapted locally.
- `sandbox-research`: useful, but isolate from production assumptions.
- `reject`: do not recommend unless the task materially changes.

