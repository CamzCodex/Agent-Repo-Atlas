# Current State Audit

Last reviewed: 2026-07-22  
Scope: World Monitor Australia hardening and read-only Stock Runtime integration

## BLUF

World Monitor is a strong, mature upstream application and should be extended, not rebuilt. The Camz Australia stack is ancestry-clean, but the application is hosted on a non-default lineage inside `Agent-Repo-Atlas`; GitHub `main` has no common ancestor with the World Monitor vendor or Australia branches. PR #10 is draft and its body is stale. Its current head, `b9568b884e983f9e4decc2cc7961e52db71a2987`, was not validated by the successful exact-head workflow: run `29881947809` validated the earlier target `02952445bfc221b16d100eba3b077c9db95173c5` through automation head `63c7caf0e8756e9a87e6a208ff4dfb610ad45b34`.

The stock runtime is a separate MIT-licensed backend with immutable archives, typed output schemas, citations, risk artifacts, provider degradation metadata and a no-broker boundary. No World Monitor runtime provider exists. Integration is not operational.

## Repository state

| Repository | Role | Default branch/head | Relevant state |
| --- | --- | --- | --- |
| `CamzCodex/Agent-Repo-Atlas` | Currently hosts World Monitor vendor and Camz branches; default repo purpose conflicts with that use | `main` / `412789a006631b16f4c1ae5de98f37d63379fb2f` | Public; World Monitor lineage has no common ancestor with `main` |
| `CamzCodex/Stock-Market-Agent-Runtime` | Stock research backend | `main` / `b32056ae7facb75a143171b5f475ae1bb40f0aa5` | Private; MIT; no open PR; no World Monitor provider |
| `CamzCodex/Command-Centre-Agent-OS` | Doctrine and runtime contracts | `main` / `c5c83f83a563e4d13b3eb3b966f17d02125abc15` | Private; one unrelated stale draft PR #2 |
| `CamzCodex/Agent-Memory-Control-Plane` | Strategy, plans, memory, routing, evaluation and cross-repo governance | `main` / `6b27b4bb5a6613cb45da0142428b83728055875c` | Private; several unrelated active PRs; local-primary directive remains recorded |
| `CamzCodex/Stock-Market-App-Shell` | Read-only runtime consumer | `main` / `f64ab883d62b0a4f75ee54ba754e15cb995cf45c` | Private; support repo; no open PR |
| `CamzCodex/Repo-Intelligence-Register` | Canonical repo/file index | `main` / `f9ed0e7bb49d37f85357d5e9d0432fba3b7eda63` | Private; does not yet index the World Monitor lineage as a dedicated product repo |

## World Monitor branch graph

| Branch | Exact head | Relationship |
| --- | --- | --- |
| `vendor/worldmonitor-main` | `e4a086febbbd9b48230d8442805c629668bd08ac` | Vendor-preservation branch; records upstream `koala73/worldmonitor` commit `9c51d04b2f0873f940227774ef8d65ce6d12900d` |
| `camz/local-foundation` | `00d35489d871165acb160e3c313457de7f916deb` | 10 ahead / 0 behind vendor |
| `camz/australia-desk` | `2805e57001028327e3f2dd4f3b2a9da4b94f12e2` | 68 ahead / 0 behind foundation |
| `camz/australia-adversarial-v4` | `b9568b884e983f9e4decc2cc7961e52db71a2987` | 7 ahead / 0 behind Australia desk |
| `fix/worldmonitor-trust-defects` | Published implementation baseline `1510c324e23edebfbf94d15245fc316b021c2d32` | Seven atomic commits; draft PR #12; no Actions run on this head |

## Pull requests and validation

| PR | State | Finding | Disposition |
| --- | --- | --- | --- |
| #6 Australia / ASX desk | Open draft; head `2805e57` | Ancestry-clean, but not merge-ready and body lacks current hardening stack | Keep draft |
| #8 adversarial v3 | Closed without merge; head `721b3b0` | Explicitly superseded by #10 and #12 | No further action |
| #9 v3 validation marker | Closed without merge; head `86be6c1` | Obsolete operational scaffolding | No further action |
| #10 adversarial v4 | Open draft; head `b9568b8` | Body says four commits but branch is seven ahead; current head has no workflow run | Keep draft; update only after fixes land and exact-head gate runs |
| #11 v4 validation marker | Closed without merge; head `63c7caf` | Workflow run `29881947809` succeeded, but validated target `0295244`, not current PR #10 or #12 | No further action |
| #12 trust defects and baseline | Open draft; implementation baseline `1510c32` | Four bounded fixes and the required architecture/governance baseline; no Actions run | Keep draft until complete exact-head gate is green |

## Existing strengths confirmed

- Preact/Vite TypeScript dashboard with mature map, panel and six-variant architecture.
- 80+ API entry points, typed generated clients, provider gateways, Redis cache tiers, request coalescing and circuit breakers.
- Tauri desktop shell and local sidecar.
- Existing API, MCP, CLI/SDK and local-AI surfaces.
- Finance, macro, geopolitical, sanctions, maritime, energy and cross-domain panels.
- Freshness-tracked source groups and explicit degraded/unavailable states.
- Camz foundation adds ASX calendar handling, local diagnostics and finance provenance.
- Australia desk adds a mission-scoped workstation and typed read-only `worldmonitor-australia-context-v2` export.
- Stock Runtime already has a config-driven research DAG, role metadata, typed prediction/risk/citation artifacts, immutable archives, walk-forward contracts and no brokerage integration.

## Source-of-truth conflicts and duplicates

1. `Agent-Repo-Atlas/main` is unrelated to the World Monitor branch history, so normal default-branch CI, security and release expectations do not apply cleanly.
2. The repo name says reference atlas while feature branches contain a complete AGPL application.
3. Adversarial v2/v3/v4 and validation marker branches duplicate superseded work and confuse current-head evidence.
4. PR #10 and #11 descriptions no longer describe their current relationship.
5. AMCP records a local-primary directive while this Work-mode mission treats GitHub as the durable coordination source. No remote write should claim to supersede unknown newer local work.

## Current integration points

- Producer candidate: `buildAustraliaMarketContextExport()` and deterministic JSON serialization in World Monitor.
- Consumer candidate: Stock Runtime research-bag/provider layer and immutable run archive.
- Governance: Command Centre no-broker/report-only rules and AMCP planning, evaluator and memory standards.
- Missing: neutral schema, clean-room runtime adapter, archived original payload, research-bag classification and end-to-end tests.

## Missing documentation before this branch

- Reuse/extension decision map.
- Cross-repo integration ADR.
- Provider and data-rights registers.
- Canonical observation and event contract.
- Threat model, test plan, operations runbook and recommendation influence policy.
- Dedicated-repository migration plan.

## Current acceptance status

The trust-defect branch is published, but it is **not green**. Focused tests, TypeScript, Markdown/JSON validation and both production variants passed locally. The normal `tsx` launcher is blocked by sandbox IPC restrictions, the fallback full suite has not established an accepted result, and GitHub reports no Actions run on implementation baseline `1510c32`. No PR is merge-ready. Stock Runtime integration is not operational.
