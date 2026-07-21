# World Monitor adoption dossier

Upstream: `koala73/worldmonitor`  
Licence: `AGPL-3.0-only` for the platform; preserve all upstream notices.  
Atlas classification: `fork-candidate`  
Vendor branch: `vendor/worldmonitor-main`  
Camz enhancement branches: `camz/*`

## Current acquisition status

The vendor branch is a security-sanitised source snapshot pinned to an audited upstream commit. Runtime and application paths are unchanged. Because the connected GitHub App cannot create files under `.github/workflows`, upstream workflow files are preserved byte-for-byte under `.github/upstream-workflows-disabled`; `.worldmonitor-upstream.json` records the original commit and tree hashes needed to audit or reconstruct the source.

The first additive enhancement branch is `camz/local-foundation`. It contains ASX session/calendar support, finance-observation provenance primitives, secret-safe local diagnostics, focused tests, and local finance setup documentation. It remains separate from the vendor branch in draft PR #4 pending human review; no enhancement has been merged.

Validation completed on GitHub-hosted Ubuntu with Node 24. The untouched vendor control and enhancement branch both restored the preserved upstream workflows, built the full dashboard artifacts, and passed the complete upstream unit/integration suite. The enhancement branch additionally passed strict diagnostics, Biome on every modified source/test file, focused Camz tests, TypeScript, and the Finance production build.

## Why we are adopting it

World Monitor is unusually strong as a **finance-in-context and global situational-awareness foundation**. Its real advantage is not any single quote, indicator or map layer. It is the ability to put geopolitical, military, infrastructure, maritime, aviation, energy, climate, cyber, news and market signals into one operational picture.

It should become a read-only intelligence cockpit and context provider for the Camz stock-market stack. It must not become an execution terminal, broker, or unqualified source of exchange-grade prices.

## Capabilities to preserve

1. **Unified cross-domain intelligence model** — conflict, unrest, disasters, infrastructure, logistics, energy, commodities, cyber and finance belong in one event picture.
2. **Dual map engines** — retain the deck.gl/MapLibre flat map and globe.gl/Three.js globe, including renderer-aware layer definitions.
3. **Dense panel workstation** — preserve resizable persistent panels, URL state, focused refresh and the ability to construct role-specific workspaces.
4. **Single-codebase variants** — retain world, finance, commodity, energy, technology and positive-news configurations rather than splitting them into divergent applications.
5. **Correlation and risk surfaces** — keep cross-stream correlation and country-instability analysis as analyst-support tools, while exposing evidence and uncertainty.
6. **Freshness engineering** — retain seed metadata, explicit staleness states, cache tiers, coalescing, ETags, fallback chains and circuit breakers.
7. **Local AI** — preserve Ollama/OpenAI-compatible local inference and browser workers so sensitive workflows do not require hosted model providers.
8. **Programmatic access** — keep REST, OpenAPI, MCP, CLI and SDK foundations for agent and runtime integration.
9. **Desktop trust boundary** — retain Tauri, operating-system keyring storage and the local Node sidecar model.
10. **Engineering guardrails** — preserve TypeScript, Biome, unit/integration/E2E tests, visual regression, API-contract checks, security audits and performance budgets.
11. **International and regional coverage** — retain multilingual feeds, RTL support and global geographic configuration.
12. **Extensible data pipeline** — preserve provider adapters, seeders, generated service contracts, configuration-driven panels and map layers.

## Trust boundaries

Do not silently treat the following as authoritative:

- delayed or cached values as real-time exchange data;
- inferred ETF flows as official creation/redemption records;
- composite radar or risk scores as validated trading systems;
- LLM-generated associations as proof of causation;
- Redis snapshots as a complete point-in-time research ledger;
- undocumented upstream endpoints as durable commercial dependencies;
- hosted AI prompts as private by default;
- the presence of a provider name as proof of redistribution rights.

Every finance-facing record should eventually carry provider, source class, observed time, fetched time, cache age, transformation method and confidence.

## Enhancement sequence

### 0. Reproducible local baseline

- pin an upstream source commit and original tree hash in an isolated vendor branch;
- preserve blocked workflow files under a disabled, reversible path;
- create all Camz changes on branches derived from that vendor snapshot;
- add a local bootstrap and secret-safe diagnostics command;
- verify install, typecheck, finance build and focused tests;
- record optional provider gaps rather than pretending every panel is live.

### 1. Australia and ASX analyst profile

- add an opt-in Australia-focused workspace without forking the core finance variant;
- focus on ASX, AUD, RBA, iron ore, copper, gold, oil/LNG, China demand, shipping chokepoints and Asia-Pacific event risk;
- use IANA zones and verified, holiday-aware session states;
- clearly label closed, delayed, stale and unverified-calendar values.

### 2. Provenance and confidence

- add a shared observation-provenance contract;
- distinguish official, licensed, public-API, undocumented, estimated, deterministic-derived, AI-derived and unknown records;
- render compact provider/freshness badges;
- fail visibly when provenance cannot be established.

### 3. Structural market/news joining

- extract canonical entities and tickers during ingestion;
- normalise event time separately from retrieval time;
- add market-hours and pre/post-session semantics;
- incorporate macro actual/estimate/previous and earnings outcomes into briefs;
- support watchlist-linked story alerts with source and confidence thresholds.

### 4. Durable research history

- separate the live Redis cache from an append-only observation/event ledger;
- retain source URL, retrieval time, content hash, transformation version and model metadata;
- support replay, point-in-time reports and proper backtesting without rewritten history.

### 5. Camz stock-market integration

- add a read-only World Monitor context provider to `Stock-Market-Agent-Runtime`;
- feed geopolitical, macro, commodity, shipping and infrastructure risk into its evidence-weighted research DAG;
- preserve data-gap flags, dissent and deterministic analysis;
- expose this context through the approved persistent-desk `Stock-Market-App-Shell` rather than replacing its UX with World Monitor's panel grid.

## First enhancement slice

The first Camz branch is additive and independently testable:

1. a shared ASX market-session utility with detailed phases and coarse `pre`, `regular`, `post`, `closed`, `holiday`, and `unknown` states;
2. a finance-observation provenance type, assessor, flags, and formatter;
3. tests for Sydney/Adelaide daylight-saving boundaries, weekends, malformed timestamps, stale observations, official 2026 closures, and conservative unknown states outside verified calendar coverage;
4. a local diagnostics command that reports Node, environment, optional-provider, dependency, and vendor-provenance readiness without printing secrets;
5. local finance setup and reversible workflow-restoration documentation.

This establishes trust primitives needed by later UI and ingestion work without prematurely redesigning a large application.

## Branch and sync rules

- `vendor/worldmonitor-main` is a pinned, security-sanitised vendor snapshot and receives no Camz edits.
- `.worldmonitor-upstream.json` and the commit message retain the original upstream commit/tree identity.
- `camz/*` branches are created from a pinned vendor commit.
- upstream syncs are reviewed before rebasing or merging into Camz branches.
- AGPL and copyright notices remain intact.
- secrets, provider keys, caches, private reports and broker credentials never enter Git.
- public modified deployments must satisfy applicable AGPL source-availability obligations.
- no automatic order routing or trading is introduced.
