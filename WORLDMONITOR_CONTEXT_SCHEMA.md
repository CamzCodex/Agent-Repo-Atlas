# World Monitor Context Schema

Status: Draft design for neutral repository  
Version: `0.1.0`  
Last reviewed: 2026-07-22

This document is an independent data-contract design. It does not authorize copying AGPL implementation into Stock Runtime. The normative JSON Schema and test vectors should be created in the proposed neutral `CamzCodex/worldmonitor-context-spec` repository after ownership and licence approval.

## Payload envelope

Required fields:

- `schemaVersion`: semantic version; unknown major fails closed.
- `payloadId`: stable unique ID.
- `generatedAt`: exporter generation time, never used as observation freshness.
- `producer`: product, version, commit and environment class.
- `purpose`: must be `read-only-research-context`.
- `controls`: read-only/no-recommendation/no-target/no-sizing/no-order/no-broker/no-portfolio-mutation flags, all fail-closed.
- `rightsSummary`: overall export decision and blocked-record count.
- `observations`: canonical observation envelopes.
- `events`: canonical event envelopes.
- `claims`: optional structured association/hypothesis claims.
- `warnings`, `unknowns`, `dissentingEvidence`.

## Canonical observation envelope

| Group | Required fields |
| --- | --- |
| Identity | `observationId`, `measureId`, `measureLabel`, `schemaVersion` |
| Value | `value` (number/string/null), `unit`, `currency`, `scale`, `frequency`, `adjustment`, `transformation` |
| Entity | `entityIds`, `instrumentIds`, `geography` |
| Time | `effectiveTime`, `observationTime`, `publicationTime`, `retrievalTime`, `ingestionTime`, `revisionTime`; nullable individually but basis explicit |
| Source | `providerId`, `datasetId`, `sourceClass`, `sourceUrl`, `termsUrl`, `attribution` |
| Rights | `rightsPolicy`, `cachePermission`, `retentionPolicy`, `exportPermission` |
| Request | `requestId`, `requestKey`, `invocationSequence`, `startedAt`, `completedAt` |
| State | `displayedDataState`, `latestAttemptState`, `offlineState`, `freshness`, `freshnessBasis`, `revisionStatus` |
| Quality | `qualityFlags`, `completeness`, `coverage`, `limitations` |

`retrievalTime` and `ingestionTime` must never make an old `observationTime` fresh. Unknown observation time is represented as null plus a quality flag, not substituted.

## Canonical event envelope

Required fields:

- `eventId`, `eventType`, `schemaVersion`.
- `entityIds`, `instrumentIds`, `geography`.
- `effectiveTime`, `publishedTime`, `retrievalTime`, `ingestionTime`, `revisionTime`.
- `providerId`, `datasetId`, `sourceClass`, `evidenceLinks`.
- `materialityFeatures` as evidence, never an automatic recommendation.
- `confidenceMeaning` and `confidenceValue` only when methodology is declared.
- `contradictoryEvidence` and `limitations`.
- Rights fields matching the observation envelope.
- `aiDerived` boolean plus model/method when true.

Event types include earnings, guidance, dividends, capital raisings, mergers, trading halts, corporate actions, sanctions, outages, releases, policy decisions, military events, disasters, shipping disruption and energy disruption.

## Hypothesis/association claim

Required fields: `claimId`, `hypothesis`, `relationshipType`, supporting observation/event IDs, dissenting evidence IDs, time window, historical comparison, sample size, limitations and generation method.

Allowed relationship types distinguish `co-occurrence`, `exposure`, `correlation`, `lead-lag`, `authoritatively-supported-causal` and `speculative-hypothesis`. AI output cannot promote one type to another.

## Compatibility

- Major: breaking semantic/required-field change; consumer rejects unknown major.
- Minor: additive optional fields or enum additions with declared fallback.
- Patch: clarification/test-vector correction with no instance-shape change.
- Producers include exact schema digest; consumers archive original bytes and validation result.
- Missing values remain null/absent as specified; zero is never a missing-value sentinel.
