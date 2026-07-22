# Australia / ASX Desk — Adversarial Review

Status: active red-team review

Branch: `camz/australia-desk`

Base: `camz/local-foundation`

Scope: data integrity, time semantics, provenance, failure modes, security, usability, licensing, and downstream runtime integration.

## Executive finding

The Australia desk is directionally strong, but it is not yet ready to be described as a fully accepted Australian market-intelligence workstation until the exact hardened head passes the focused contracts, complete upstream suite, TypeScript check, and Finance production build.

The strongest parts are the conservative ASX calendar model, explicit separation of deterministic session state from market observations, visible missing-data handling, and the read-only downstream contract. The adversarial pass has now implemented mitigations for false freshness, mission-registry drift, Australia/US semantic leakage, missing freshness basis, misleading ASX fetch clocks, mixed quote-group masking, invalid prices, missing units, and uncalibrated-confidence presentation.

The largest residual risks are provider/redistribution rights, 2027 calendar rollover, possible duplicate market reads from overlapping cache keys, and the absence of licensed Australia-specific breadth and macro feeds.

No broker execution, order placement, portfolio mutation, or automatic trading path was found.

## Severity summary

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| AU-ADV-001 | Critical trust | Cached or persisted circuit-breaker responses could be timestamped as freshly retrieved by the Australia panel. | Mitigated in branch; validation pending |
| AU-ADV-002 | High compatibility | Australia was appended directly to the stable v1 mission-preset list, breaking the full upstream contract suite. | Mitigated in branch; validation pending |
| AU-ADV-003 | High semantic | The preset auto-selected S&P 500 breadth, BTC/QQQ macro signals, and US mega-cap/CFTC liquidity panels as if they were Australia-native. | Mitigated in branch; validation pending |
| AU-ADV-004 | High downstream integrity | The JSON envelope omitted `freshnessBasis`, allowing fetched-at freshness to be confused with observed-at freshness. | Mitigated in branch; validation pending |
| AU-ADV-005 | High provenance | ASX model evidence recorded `fetchedAt: now` despite no live ASX schedule fetch at panel render time. | Mitigated in branch; validation pending |
| AU-ADV-006 | Medium UI integrity | One combined “Quotes” evidence row could let fresh equities visually mask stale resources, or vice versa. | Mitigated in branch; validation pending |
| AU-ADV-007 | Medium data validity | A finite zero or negative quote could remain “available” instead of failing closed. | Mitigated in branch; validation pending |
| AU-ADV-008 | Medium scope | An index plus three companies is useful context but not Australian market breadth. | Mitigated in labels/export; validation pending |
| AU-ADV-009 | Medium contract clarity | Exported prices lacked currency/unit metadata. | Mitigated in branch; validation pending |
| AU-ADV-010 | Medium rights | Copying undocumented provider-derived values into an MIT runtime or public report needs explicit rights and redistribution review. | Open governance risk |
| AU-ADV-011 | Medium maintenance | Only the 2026 ASX holiday calendar is verified; safe `unknown` fallback creates a year-end operational deadline. | Controlled; calendar rollover required |
| AU-ADV-012 | Low performance | The Australia tab may fragment market-cache keys and duplicate RPC reads already initiated by Markets and Commodities. | Plausible; measure before changing |
| AU-ADV-013 | Low calibration | Hard-coded evidence confidence values could look statistically calibrated when they are policy heuristics. | Mitigated in export/UI; validation pending |
| AU-ADV-014 | Refuted | The model was suspected of ignoring a staggered ASX opening sequence. ASX moved to a single opening in June 2025; the 10:00 boundary is deliberately conservative. | Refuted |

## Detailed findings

### AU-ADV-001 — False freshness through fallback data

World Monitor’s circuit breaker distinguishes `live`, `cached`, and `unavailable` data and retains the cache timestamp. The previous market-service path returned only quote arrays, and Macro Tiles assigned `new Date()` after any non-empty result.

That meant these materially different events could be presented with the same fresh retrieval clock:

1. a successful live RPC;
2. a fresh in-memory cache hit;
3. a persisted cache hydration;
4. stale-while-revalidate data;
5. a last-successful in-process fallback.

Implemented mitigation:

- the breaker reports immutable state for the exact return path through `onDataState`;
- concurrent cache keys no longer require reading shared mutable state after an await;
- stock and commodity results carry breaker state in a weakly held quote-array side channel;
- the Australia snapshot prefers the breaker timestamp over panel completion time;
- unavailable results with no timestamp cannot inherit a later panel timestamp;
- last-successful fallback retains its original timestamp and is labelled cached;
- live, cached, cooldown, concurrent-key, offline, unavailable, and partial-group paths have focused tests.

### AU-ADV-002 — Stable mission registry changed in place

The upstream suite explicitly locks the seven v1 role-preset IDs. Adding Australia directly to that public registry failed the complete suite.

Implemented mitigation:

- the stable core registry remains seven presets;
- Australia is registered as an extension;
- browser mission pickers receive the variant-filtered core-plus-extension list;
- the extension is restricted to full and Finance variants;
- unsupported variants do not expose or restore the Australia mission;
- tests lock core stability, extension uniqueness, and variant visibility.

### AU-ADV-003 — Non-Australian panels selected by default

The previous preset selected:

- `market-breadth`, whose panel is explicitly S&P 500 breadth;
- `macro-signals`, whose regime is built from BTC, QQQ, XLP, hash rate and crypto fear/greed;
- `liquidity-shifts`, whose stock basket is US mega-caps and whose institutional data is CFTC positioning.

Those panels may be useful optional global context, but selecting them by default under an Australia label overstated their geographic relevance.

Implemented mitigation: all three are removed from the default Australia mission and remain manually selectable global context.

### AU-ADV-004 — Freshness basis missing from export

The shared provenance model tracks whether age is based on `observed-at`, `fetched-at`, or `none`. The original Australia JSON export dropped that field.

Implemented mitigation: the envelope exports the provenance schema version, `freshnessBasis`, live/cache/unavailable mode, offline state, transformation description/version, and relevant timestamps.

### AU-ADV-005 — ASX schedule evidence implied a live fetch

The session model is evaluated at the current time, but its official trading-hours/calendar source was statically verified on a recorded date. Setting both `observedAt` and `fetchedAt` to render time conflated model evaluation with source retrieval.

Implemented mitigation:

- `observedAt` remains the model evaluation time;
- the independent source verification date is exported as `sourceCheckedAt`;
- no current schedule fetch is claimed;
- a 90-day source-review warning is emitted;
- the calendar URL is retained in notes rather than misusing `termsUrl`.

### AU-ADV-006 — Mixed quote groups collapsed into one evidence row

Equities and resources maintain independent retrieval clocks, but the original UI rendered one generic `Quotes` evidence line.

Implemented mitigation: the UI renders separate “ASX basket” and “AUD/resources” evidence rows, including live/cache/offline mode and freshness clock basis.

### AU-ADV-007 — Invalid price availability

Finite zero and negative values were normalized rather than rejected. For the fixed ASX, FX, metal and energy basket, a non-positive price should fail closed.

Implemented mitigation: prices must be finite and greater than zero; invalid values become unavailable while nullable change remains permitted.

### AU-ADV-008 — Basket is not breadth

The basket is intentionally compact: one benchmark plus three bellwethers. It cannot support claims about Australian market breadth, small caps, sector participation, or an investable universe.

Implemented mitigation: the UI says “ASX benchmark & bellwethers”, and the machine-readable export carries an explicit compact-basket constraint.

### AU-ADV-009 — Missing price units

A numeric price without unit or currency is ambiguous across index points, AUD equities, AUD/USD, metals, coal, oil and gas.

Implemented mitigation:

- index: `index-points`;
- Australian equities: `AUD-per-share`;
- AUD/USD: `USD-per-AUD`;
- futures whose current provider contract does not guarantee a normalized unit: `provider-native` rather than an invented unit.

### AU-ADV-010 — Rights and licence boundary

World Monitor is AGPL-3.0-only. `Stock-Market-Agent-Runtime` is MIT. The market path is described as Yahoo-derived and undocumented.

Required controls:

- do not copy AGPL implementation into the MIT runtime without licence review;
- implement the consumer schema independently;
- treat provider-derived values as internal research context unless redistribution rights are confirmed;
- preserve source URLs and access classification;
- do not publish or repackage cached values merely because the JSON export is technically copyable.

The export now carries an internal-research rights constraint, but legal/provider review remains outside this code change.

### AU-ADV-011 — Calendar rollover

Failing to `unknown` outside 2026 is correct. The operational weakness is that the desk will intentionally degrade on the first unverified weekday of 2027.

Required control: verify and transcribe the next official ASX calendar before the final 2026 production release, with parity tests in both browser and seeder helpers.

### AU-ADV-012 — Possible duplicate market reads

The Australia tab requests a subset symbol key while Markets and Commodities may request broader configured sets. Because breaker caches are keyed by sorted symbol sets, overlapping requests can occupy separate entries and cause additional RPC/cache work.

Required next step: instrument request keys and confirm actual duplication before changing behaviour. Do not trade correctness for cache-key reuse without evidence.

### AU-ADV-013 — Confidence is not calibrated probability

Values such as `0.65` are policy judgements, not empirically calibrated probabilities.

Implemented mitigation: the UI warns that confidence values are policy heuristics, and every exported evidence object carries `confidenceMeaning: policy-heuristic-not-calibrated`.

### AU-ADV-014 — Opening-sequence concern refuted

ASX replaced former staggered opening rotations with a single opening on 23 June 2025. The official current schedule places the randomized opening transition immediately before normal trading. Reporting `opening-auction` until 10:00 is conservative by seconds, not materially late, and avoids claiming continuous trading prematurely.

No code change is required for this concern. Preserve the source-check date and revisit only if ASX changes the schedule again.

## Immediate hardening order

1. Run focused cache, mission, ASX, rendering, and export contracts.
2. Run the complete upstream suite to catch compatibility drift.
3. Type-check the browser application.
4. Build the Finance production variant.
5. Record the exact accepted head and run IDs in the draft PR.
6. Instrument overlapping market request keys before making performance changes.
7. Complete provider/redistribution rights review before public context redistribution.
8. Verify the 2027 ASX calendar before year-end release.

## Deferred improvements

- Australia-specific primary feeds from RBA, ABS, ASIC and ASX, with client/server feed parity and source-risk metadata.
- RBA cash-rate and Australian CPI/employment tiles from official or licensed data.
- ASX sector breadth and advance/decline data from a licensed source.
- Australia-specific earnings and corporate-action calendar.
- Request-key instrumentation to quantify duplicate market reads.
- Independently implemented runtime consumer after local AMCP reconciliation and licence review.

## Acceptance standard

The desk is acceptable only when:

- cached data cannot be made fresh by a panel render;
- every freshness label names its clock basis and breaker mode;
- unavailable and invalid prices fail visibly;
- Australia defaults do not masquerade US/crypto indicators as domestic signals;
- core mission IDs remain stable;
- unsupported variants cannot expose or restore the Australia extension;
- exported prices carry units or an explicit provider-native marker;
- exported confidence is visibly heuristic rather than calibrated;
- the export preserves rights and no-trading constraints;
- all focused and upstream tests, type checking, and the Finance build pass on the exact head SHA.
