# ADR: World Monitor to Stock Runtime Integration

Status: Proposed

Date: 2026-07-22

Decision owner: Cameron / designated integration maintainer

## Context

World Monitor is AGPL-3.0-only and optimized for live situational awareness. Stock Runtime is MIT-licensed and optimized for typed research workflows and immutable run archives. The bridge must preserve evidence class, time semantics, rights, dissent and no-trading controls without copying AGPL implementation into the runtime.

## Decision

Adopt a **typed, read-only exported context payload governed by a neutral versioned JSON Schema**, consumed by an independently implemented Stock Runtime provider.

Initial flow:

1. World Monitor builds observations/events from its existing provider and panel services.
2. A typed exporter emits a bounded payload with provenance, rights, freshness, displayed/latest-attempt state and explicit no-trading controls.
3. A neutral specification repository, proposed as `CamzCodex/worldmonitor-context-spec`, owns schema, examples, compatibility rules, threat model and test vectors.
4. Stock Runtime's clean-room provider validates major version, provenance, rights, timestamps, staleness and forbidden instructions.
5. The original payload is archived with the run and accepted items enter the ResearchBag under distinct World Monitor contribution categories.
6. Existing research, risk and adversarial roles adjudicate it. No new role is created until evaluation proves existing roles cannot absorb the duty.

The first transport is a static/file payload. An authenticated API may replace transport later without changing the contract.

## Alternatives

| Alternative | Advantages | Risks | Decision |
| --- | --- | --- | --- |
| Direct code sharing | Fast, low duplication | AGPL contamination, tight coupling, shared failure domain | Reject |
| Direct database access | Rich queries | Schema coupling, rights bypass, credential blast radius | Reject |
| API integration | Current data, operationally familiar | Network/auth/availability complexity | Defer; compatible future transport |
| MCP integration | Agent discoverability | Prompt-injection and unstructured over-trust risk | Defer for discovery-only use |
| Typed exported context | Small, replayable, auditable, transport-neutral | Batch latency; schema governance required | Select for v1 |
| Event stream | Low latency, incremental | Operational and ordering complexity | Defer until volume proves need |
| Static report ingestion | Easy for humans | Loses types, units, dissent and machine validation | Reject as primary; allow supplementary evidence |

## Consequences

- No AGPL implementation code enters the MIT runtime.
- Rights filters execute before export and again before runtime acceptance.
- Missing, stale and contradictory evidence remain explicit.
- Every stock run can reproduce exactly which World Monitor payload contributed.
- Schema major versions fail closed; minor additive fields may be ignored only under documented compatibility rules.
- Integration remains read-only and cannot contain broker, order, position-sizing or portfolio actions.

## Decision gates

1. WP1 hardening exact-head green.
2. Neutral spec ownership/licence approved.
3. Rights policy and threat model approved.
4. Runtime adapter and archive tests green.
5. Adversarial evaluation demonstrates no recommendation contamination.

No production integration is authorized before all five gates pass.
