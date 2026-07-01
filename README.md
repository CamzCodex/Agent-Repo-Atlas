# Agent-Repo-Atlas

Agent-Repo-Atlas is a curated, machine-readable intelligence layer for external GitHub repositories, libraries, tools, UI systems, templates, MCP servers, agent frameworks, design references, and implementation patterns.

It is not a bookmark list.

It is designed so agents can:

- Search the atlas before broad web research.
- Compare candidate repos quickly.
- See usefulness, risk, license, maintenance, and acquisition mode.
- Decide whether a repo is a reference, dependency candidate, fork candidate, sandbox research target, or reject.
- Update the atlas when a new useful repo is discovered.

## What is in the repo

- Registry data under `registries/`
- JSON Schemas under `schemas/`
- Search, scoring, generation, and validation scripts under `scripts/`
- Agent usage guidance under `docs/`
- An agent skill under `skills/repo-atlas-search/`
- Prompt templates under `prompts/`

## Quick start

```bash
npm install
npm run validate
npm run test
npm run search -- "react component library"
```

If you add or edit repo entries, regenerate the index first:

```bash
npm run generate:index
npm run validate
```

## Repository model

Each repo entry captures:

- What the repo is for
- How an agent should use it
- Acquisition mode and confidence
- Maintenance signals
- License
- Risk notes
- Search keywords and taxonomy labels

The scoring model is intentionally transparent so agents can reason about why a repo ranked where it did.

## Current seed data

The atlas ships with two seed entries:

- `awesome-react-components`
- `devspace`

These are representative examples for the schema, search, and scoring pipeline.

## Working rules

- Search the atlas before reaching for the web.
- Prefer the lowest-risk acquisition mode that still solves the task.
- Do not auto-promote unreviewed repos into dependency candidates.
- Treat license and maintenance flags as first-class signals.
- Keep descriptions factual and short.

## Validation

Validation is dependency-free and checks:

- Registry structure
- Schema compliance
- Index consistency
- Search fixture behavior

## Extending the atlas

1. Add a new file under `registries/repos/`.
2. Update or regenerate `registries/repo-index.json`.
3. Run validation.
4. If the repo is useful, include it in the search fixture set or add a new fixture.

