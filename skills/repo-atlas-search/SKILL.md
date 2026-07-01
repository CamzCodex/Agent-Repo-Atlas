# Repo Atlas Search

Use this skill when an agent needs to find, compare, or safely classify external repositories and reference maps from Agent Repo Atlas.

## Core rule

Listing means classified, not approved.

## Workflow

1. Search the atlas with plain task language.
2. Compare the best matches.
3. Read `category`, `type`, `riskLevel`, `acquisitionMode`, `license`, and `maintenance` together.
4. Prefer the least risky mode that still solves the task.
5. Escalate to broader web research only when the atlas does not cover the need.

## Useful commands

```bash
npm run search -- "react component"
npm run search -- "code quality"
npm run score
npm run validate
```

## Decision cues

- `reference-only`: inspect patterns, do not install by default
- `reference-map-only`: use it to find better candidates
- `dependency-candidate`: compare before adoption
- `sandbox-research-only`: isolate before trust decisions
- `do-not-use`: reject unless the task materially changes

