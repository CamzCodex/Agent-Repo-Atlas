# World Monitor Security Threat Model

Last reviewed: 2026-07-22

## Trust flow

External provider → fetch/parser → raw artifact → normalized observation/event → context exporter → transport/archive → Stock Runtime validator → ResearchBag → model prompts → recommendation artifact.

Every arrow is a trust boundary. Provider content is data, never executable instruction.

| Threat | Boundary/control | Required tests |
| --- | --- | --- |
| SSRF/private network | Manifest host allowlist, DNS/IP private-range rejection, redirect revalidation | Literal/encoded IPs, DNS rebinding, redirect chain |
| Oversized/decompression bomb | Content-length and decoded-size limits, compression ratio/time budget | Huge body, nested archive, malformed compression |
| MIME/parser confusion | MIME and magic-byte validation; parser version pinned | HTML served as CSV, malformed XLSX/JSON |
| CSV/XLSX formula injection | Neutralize leading formula tokens on human export | `=`, `+`, `-`, `@` cells |
| HTML/XSS | Escape/sanitize provider text; no unsafe HTML promotion | Script/event-handler payloads |
| Prompt injection | Delimit untrusted evidence, strip instructions from control channel, require typed outputs | Feed text requesting system/portfolio actions |
| Schema poisoning | Strict schema, size/depth/cardinality limits, unknown-major rejection | Duplicate keys, enum abuse, deep nesting |
| Stale replay/future time | Raw hash, request token, clock-skew policy, freshness basis | Old cache, future publication/observation time |
| Entity corruption | Stable namespaces, match method/confidence, review queue | Homonyms, ticker reuse, symbol changes |
| Sanctions false positive | Authoritative evidence, match rationale, dissent and human escalation | Common-name and transliteration corpus |
| Rights bypass | Producer and consumer filtering; export audit; entitlement-bound fields | Missing/unknown rights and downgrade attempts |
| Secret leakage | Redaction before raw/log/archive; secret scanning | Headers, URLs, error objects, payload examples |
| Dependency compromise | Lockfiles, SBOM, scanning, signed releases | Known-vulnerable and tampered dependency fixtures |
| Sidecar exposure | Loopback/auth, bounded endpoints, origin validation | LAN binding, origin spoof, token replay |
| Agent over-trust | Contribution categories, corroboration, dissent, no sole-driver rule | Malicious/high-confidence single source |
| Trading side effect | Schema forbids instructions; runtime rejects action verbs/fields; no broker dependency | Broker/order/portfolio canary tests |

## Mandatory kill switches

- Provider-level disable without redeploy.
- Export disable by rights policy.
- Runtime World Monitor ingestion disable.
- Model-context contribution disable while preserving archived evidence.

## Residual risk

Public information can be wrong, delayed or manipulated even when transport is secure. The architecture reduces propagation and records uncertainty; it cannot make evidence true by schema validation alone.
