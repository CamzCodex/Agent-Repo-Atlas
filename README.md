# Agent-Repo-Atlas

Agent-Repo-Atlas is a machine-readable external repo intelligence system for agents.

It helps Agent OS, Command Centre, Codex, and future specialist agents search known repos before broad web research, compare candidates, inspect risk and license signals, and choose the right acquisition mode without treating listing as approval.

## What this repo does

- Tracks curated external GitHub repos, topic maps, and reference collections
- Imports starred GitHub repos into a review queue
- Scores and searches entries with transparent rules
- Generates a deterministic registry index from full entry files
- Validates structure, paths, URLs, and classification data
- Exposes an agent skill for repo discovery and triage

## Core rule

Listing means classified, not approved.

## Main commands

```bash
npm run build:atlas
npm run generate:index
npm run import:starred
npm run triage:starred
npm run validate
npm run test
npm run search -- "react component"
```

## Repository layout

- `registries/` holds the full entry files, index, starred import, and review queue
- `schemas/` documents the registry contract
- `scripts/` provides import, triage, build, search, scoring, generation, and validation tools
- `docs/` explains taxonomy, workflow, guardrails, and Agent OS usage
- `skills/repo-atlas-search/` contains the agent-facing skill
- `prompts/` contains triage and discovery prompts

## Current atlas seed set

The atlas is seeded with high-value references and operational tooling such as:

- React UI systems and component references
- Agent frameworks and Codex bridges
- MCP and local developer tooling
- Code-quality, project-management, and research-reference maps
- A starred GitHub review queue

## Working practice

1. Search the atlas first.
2. Compare candidate repos before recommending adoption.
3. Check license, maintenance, acquisition mode, and risk.
4. Prefer the least invasive useful mode.
5. Keep the review queue separate from the full atlas.

## Validation

The validation loop checks:

- Required fields and data types
- Entry paths and duplicate ids
- Valid URLs and acquisition/risk enums
- Search behavior against fixtures
- Deterministic index generation from the full entry set

