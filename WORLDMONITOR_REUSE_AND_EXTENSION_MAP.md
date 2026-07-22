# World Monitor Reuse and Extension Map

Last reviewed: 2026-07-22

Decision values: **REUSE AS-IS**, **CONFIGURE**, **EXTEND**, **WRAP OR ADAPT**, **REPLACE WITH EVIDENCE**, **NEW BUILD REQUIRED**.

| Requirement | Existing World Monitor capability | Existing Camz capability | Reuse decision | Gap | Proposed action |
| --- | --- | --- | --- | --- | --- |
| Map architecture | Mature MapLibre/DeckGL/globe layers and interaction controls | Australia mission selects Oceania layers | REUSE AS-IS | None for integration | Keep map contextual; do not couple it to recommendation logic |
| Panel architecture | Class-based panels, lifecycle signal, safe rendering | Mission-scoped Australia Macro tab | EXTEND | Whole-panel request ordering | Use shared newest-request gate; retain panel lifecycle |
| Variant architecture | full, finance, tech, commodity, energy, happy | Australia allowed only in full/finance | EXTEND | Programmatic application was not fail-closed | Enforce variant guard in core function |
| Mission presets | Stable core preset registry | Australia extension | EXTEND | Extension compatibility and tests | Preserve core IDs; reject incompatible variants |
| Provider adapters | Typed RPC clients and provider-specific handlers | Yahoo-derived Australia path | WRAP OR ADAPT | No official AU provider framework | Add manifests and adapters outside UI components |
| Seeders | Large scheduled seeder estate | ASX calendar helper and quote seeds | EXTEND | AU official data seeders absent | Add one source per bounded PR with health metadata |
| Redis/cache | Tiered cache, coalescing and circuit breakers | Displayed/latest attempt separation | EXTEND | Invocation order and revision history | Keep Redis hot; add request tokens and durable history |
| Circuit breakers | Mature per-domain breakers | Per-call market data state | EXTEND | Latest registry was completion-ordered | Register invocation before await; reject stale completion |
| Desktop sidecar | Tauri + Node sidecar | Local diagnostics | REUSE AS-IS | Export/auth exposure review | Threat-model and keep read-only |
| Local AI | Existing local analysis surfaces | AMCP routing/governance | CONFIGURE | Prompt-injection isolation | Treat provider text as untrusted evidence, never instructions |
| API | Typed APIs and generated clients | Australia exporter is currently UI-copy oriented | WRAP OR ADAPT | No neutral context endpoint | Start with typed file/export; API later after rights gate |
| MCP | Existing discovery and tool surfaces | Stock runtime has no WM tool consumer | CONFIGURE | Rights and prompt-injection boundaries | Do not use MCP for v1 integration; consider read-only discovery later |
| CLI/SDK | Existing CLI and SDK packages | Stock runtime CLI and HTTP API | WRAP OR ADAPT | No contract compatibility command | Add schema validation CLI in neutral spec repo |
| Finance panels | Markets, macro, commodities, breadth and analysis | Australia workstation | EXTEND | AU official coverage and breadth prerequisites | Add official macro first; licensed breadth only after universe coverage |
| Market data | Global providers and Yahoo-normalized path | Seeded ASX index/bellwethers | CONFIGURE | Undocumented timing and redistribution | Keep context-only fallback; procure licensed source |
| Macro data | FRED, Eurostat, China snapshots | ASX session context | EXTEND | ABS/RBA/APRA adapters | Add official observation/revision metadata |
| News/events | RSS, feeds and event panels | Typed Australia context export | EXTEND | Canonical event envelope | Normalize evidence without copying provider implementation |
| Sanctions | Existing sanctions layers/feeds | Command Centre risk roles | WRAP OR ADAPT | Entity false positives and point-in-time history | Preserve source class, match confidence and dissent |
| Supply chain/shipping | Chokepoints, vessels, routes and disruption data | Stock risk workflow | WRAP OR ADAPT | Issuer exposure graph | Export evidence-linked hypotheses, not causal conclusions |
| Energy | Oil/gas/electricity panels | Australia resource basket | EXTEND | AEMO adapter | Add official AEMO data and issuer exposure mapping |
| Historical storage | Current-state cache and some archives | Stock immutable run archives | NEW BUILD REQUIRED | No revision-preserving observation store | PostgreSQL/optional Timescale + S3 raw artifacts; Redis remains hot cache |
| Alerts | Existing alert and freshness mechanisms | Runtime risk escalation | WRAP OR ADAPT | Deduplication and recommendation contamination rules | Export alert evidence with rights and freshness; risk role adjudicates |
| Agent integration | API/MCP/AI surfaces | Typed ResearchBag workflow and role graph | WRAP OR ADAPT | Clean-room provider absent | Independently implement neutral contract consumer in MIT runtime |
| Provenance | Freshness source groups and Camz finance provenance | Citations and archive manifests | EXTEND | Canonical multi-time envelope and rights fields | Adopt observation/event envelopes without universal trust score |
| Testing | Large unit/integration/E2E estate | Runtime Vitest, schemas and walk-forward tests | EXTEND | Cross-repo contract and security tests | Add test vectors in neutral spec; run both suites |
| Deployment | Vercel/Railway/Tauri/self-host patterns | Local runtime API | CONFIGURE | Cross-service auth and rollback | Begin with offline file payload; defer network coupling |
| Security | CORS, auth, rate limits, sanitization and secret guards | No-broker controls and archive validation | EXTEND | SSRF, hostile data and rights bypass across new flow | Apply threat model and fail-closed consumer validation |

## New-build rationale

Only two components currently justify new construction:

1. **Revision-preserving historical store**: World Monitor's hot-cache/current-state architecture and the Stock Runtime run archive solve different problems. Neither provides provider-run/raw-artifact/observation-revision history.
2. **Neutral context specification**: direct AGPL code sharing would contaminate the MIT runtime boundary. A clean-room, independently specified contract is the smallest safe bridge.

Everything else should configure, extend or wrap existing capability.
