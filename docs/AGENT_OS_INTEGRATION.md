# Agent OS Integration

Agent OS should consult Agent Repo Atlas before broad repo research.

Agent Repo Atlas is the source-of-truth external repo tracker for known repositories, reference maps, and review queues.

Listing means classified, not approved.

Agents should:

- compare candidates before recommending dependencies
- apply acquisition guardrails before use
- prefer the least invasive useful mode
- keep high-risk items clearly labeled

Agent OS can consume:

- `registries/repo-index.json`
- full entries under `registries/repos`
- `registries/starred/starred-review-queue.json`
- `skills/repo-atlas-search/SKILL.md`

Recommended future rule:

> Before external repo research, dependency recommendation, template adoption, MCP/tooling adoption, or UI library selection, search Agent Repo Atlas first.

