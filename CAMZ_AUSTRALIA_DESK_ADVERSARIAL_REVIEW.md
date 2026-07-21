# Australia / ASX Desk — Adversarial Review

Status: active red-team review  
Branch: `camz/australia-desk`  
Base: `camz/local-foundation`  
Scope: data integrity, time semantics, provenance, failure modes, security, usability, licensing, and downstream runtime integration.

## Executive finding

The Australia desk is directionally strong, but it is not yet ready to be described as a trustworthy Australian market-intelligence workstation without qualification.

The strongest parts are the conservative ASX calendar model, explicit separation of deterministic session state from market observations, visible missing-data handling, and the read-only downstream contract. The largest residual risks are false freshness when cached market data is read, semantic overreach from US/crypto panels selected by the Australia preset, a versioned mission-registry compatibility break, and an export contract that does not yet tell downstream consumers whether “freshness” came from an exchange observation clock or only a retrieval/cache clock.

No broker execution, order placement, portfolio mutation, or automatic trading path was found.

## Severity summary

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| AU-ADV-001 | Critical trust | A cached or persisted circuit-breaker response can be timestamped as freshly retrieved by the Australia panel. | Confirmed; fix required |
| AU-ADV-002 | High compatibility | Australia was appended directly to the stable v1 mission-preset list, breaking the full upstream contract suite. | Confirmed; fix required |
| AU-ADV-003 | High semantic | The preset auto-selects S&P 500 breadth, BTC/QQQ macro signals, and US mega-cap/CFTC liquidity panels as if they were Australia-native. | Confirmed; remove from default preset |
| AU-ADV-004 | High downstream integrity | The JSON envelope omits `freshnessBasis`, so a consumer can confuse fetched-at freshness with observed-at freshness. | Confirmed; fix required |
| AU-ADV-005 | High provenance | ASX model evidence records `fetchedAt: now` even though no live ASX schedule fetch occurs at panel render time. | Confirmed; fix required |
| AU-ADV-006 | Medium UI integrity | One combined “Quotes” evidence row can let fresh equities visually mask stale resources, or vice versa. | Confirmed; split evidence rows |
| AU-ADV-007 | Medium data validity | A finite zero or negative quote can remain “available” instead of failing closed as unavailable. | Confirmed; fix required |
| AU-ADV-008 | Medium scope | An index plus three companies is a useful context basket but not Australian market breadth. | Confirmed; label and constrain |
| AU-ADV-009 | Medium contract clarity | Exported prices lack currency/unit metadata. | Confirmed; add explicit or provider-native units |
| AU-ADV-010 | Medium rights | Copying undocumented provider-derived values into an MIT runtime or public report needs an explicit rights/redistribution review. | Confirmed governance risk |
| AU-ADV-011 | Medium maintenance | Only the 2026 ASX holiday calendar is verified; the safe `unknown` fallback prevents fabrication but creates a year-end operational deadline. | Controlled; calendar rollover required |
| AU-ADV-012 | Low performance | The Australia tab may fragment market-cache keys and duplicate RPC reads already initiated by the Markets and Commodities panels. | Plausible; measure before changing |
| AU-ADV-013 | Low calibration | Hard-coded evidence confidence values can look statistically calibrated when they are policy heuristics. | Confirmed presentation risk |
| AU-ADV-014 | Refuted | The model was suspected of ignoring a staggered ASX opening sequence. ASX moved to a single opening in June 2025; the model’s 10:00 boundary is deliberately conservative. | Refuted |

## Detailed findings

### AU-ADV-001 — False freshness through fallback data

World Monitor’s circuit breaker distinguishes `live`, `cached`, and `unavailable` data and retains the cache timestamp. The market service currently returns only the quote array, discarding that state. The Australia tab then assigns `new Date()` after any non-empty result.

That means these materially different events can be presented with the same fresh retrieval clock:

1. a successful live RPC;
2. a fresh in-memory cache hit;
3. a persisted cache hydration;
4. stale-while-revalidate data;
5. a last-successful in-process fallback.

Required correction:

- return a per-call immutable data-state envelope from the market service;
- carry the circuit-breaker timestamp rather than the panel completion time;
- mark last-successful fallback distinctly;
- never use a shared breaker’s mutable “last state” after an await, because concurrent symbol-set requests can race;
- test live, fresh-cache, stale-cache, unavailable, and partial-group refresh paths.

### AU-ADV-002 — Stable mission registry changed in place

The upstream suite explicitly locks the v1 role-preset IDs. Adding Australia directly to `MISSION_PRESETS` changed that public registry and failed the complete suite.

Required correction:

- preserve a stable core registry;
- register Australia as an extension;
- expose a combined available list to the UI;
- restrict the extension to the full and finance variants;
- ignore or reject a stored Australia mission on unsupported variants;
- retain explicit tests for core stability and extension uniqueness.

### AU-ADV-003 — Non-Australian panels selected by default

The current preset selects:

- `market-breadth`, whose panel is explicitly S&P 500 breadth;
- `macro-signals`, whose regime is built from BTC, QQQ, XLP, hash rate and crypto fear/greed;
- `liquidity-shifts`, whose stock basket is US mega-caps and whose institutional data is CFTC positioning.

Those panels may be useful optional global context, but selecting them by default under an Australia label overstates their geographic relevance.

Required correction: remove all three from the default Australia mission. Users can still add them manually.

### AU-ADV-004 — Freshness basis missing from export

The shared provenance model correctly tracks whether age is based on `observed-at`, `fetched-at`, or `none`. The Australia JSON export drops that field.

Required correction: export the provenance schema version, `freshnessBasis`, transformation description, and the relevant timestamps. Downstream systems must be able to say “fresh retrieval clock; exchange observation time unavailable.”

### AU-ADV-005 — ASX schedule evidence implies a live fetch

The session model is evaluated at the current time, but its official trading-hours/calendar source was statically verified on a recorded date. Setting both `observedAt` and `fetchedAt` to the render time conflates model evaluation with source retrieval.

Required correction:

- keep `observedAt` as the model evaluation time;
- expose the independent source verification date;
- do not claim a current schedule fetch;
- warn when the source verification age exceeds the review policy;
- do not put the calendar URL into a field named `termsUrl`.

### AU-ADV-006 — Mixed quote groups collapse into one evidence row

Equities and resources already maintain independent retrieval clocks, but the UI chooses the first available quote and renders one generic `Quotes` evidence line.

Required correction: render separate “ASX basket” and “AUD/resources” evidence rows and include the freshness basis in each label.

### AU-ADV-007 — Invalid price availability

Finite zero and negative values are normalized rather than rejected. For the fixed ASX, FX, metal and energy basket, a non-positive price should fail closed.

Required correction: require a finite price greater than zero; retain nullable change; mark an invalid quote as unavailable and preserve the provider warning.

### AU-ADV-008 — Basket is not breadth

The basket is intentionally compact: one benchmark plus three bellwethers. It cannot support claims about Australian market breadth, small caps, sector participation, or an investable universe.

Required correction: label it “ASX benchmark & bellwethers” and include a machine-readable constraint in the export.

### AU-ADV-009 — Missing price units

A numeric price without unit/currency is ambiguous across index points, AUD equities, AUD/USD, metals, coal, oil and gas.

Required correction:

- index: `index-points`;
- Australian equities: `AUD per share`;
- AUD/USD: `USD per AUD`;
- futures where the current provider contract does not guarantee a normalized unit: `provider-native` rather than an invented unit.

### AU-ADV-010 — Rights and licence boundary

World Monitor is AGPL-3.0-only. `Stock-Market-Agent-Runtime` is MIT. The market path is described as Yahoo-derived and undocumented.

Required controls:

- do not copy AGPL implementation into the MIT runtime without licence review;
- implement the consumer schema independently;
- treat provider-derived values as internal research context unless redistribution rights are confirmed;
- preserve source URLs and access classification;
- do not publish or repackage cached values merely because the JSON export is technically copyable.

### AU-ADV-011 — Calendar rollover

Failing to `unknown` outside 2026 is correct. The operational weakness is that the desk will intentionally degrade on the first unverified weekday of 2027.

Required control: verify and transcribe the next official ASX calendar before the final 2026 production release, with parity tests in both browser and seeder helpers.

### AU-ADV-012 — Possible duplicate market reads

The Australia tab requests a subset symbol key while the Markets and Commodities panels may request broader configured sets. Because breaker caches are keyed by sorted symbol sets, overlapping requests can occupy separate entries and cause additional RPC/cache work.

Required next step: instrument request keys and confirm actual duplication before changing behaviour. Do not trade correctness for cache-key reuse without evidence.

### AU-ADV-013 — Confidence is not calibrated probability

Values such as `0.65` are policy judgements, not empirically calibrated probabilities.

Required correction: label the basis as heuristic policy confidence or omit the numeric field until calibration exists.

### AU-ADV-014 — Opening-sequence concern refuted

ASX replaced the former staggered opening rotations with a single opening on 23 June 2025. The official current schedule places the randomized opening transition immediately before normal trading. Reporting `opening-auction` until 10:00 is conservative by seconds, not materially late, and avoids claiming continuous trading prematurely.

No code change is required for this concern. Preserve the source-check date and revisit only if ASX changes the schedule again.

## Immediate hardening order

1. Restore the stable mission-registry contract and variant-scope Australia as an extension.
2. Remove US/crypto-specific panels from the default Australia mission.
3. Preserve circuit-breaker mode and timestamp through the market service.
4. Correct ASX source-verification semantics.
5. Split equities/resources evidence in the UI.
6. Add freshness basis, units, basket limits, and rights constraints to the export.
7. Reject non-positive quotes.
8. Run focused tests, the complete upstream suite, TypeScript, and the Finance production build on the exact branch head.

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
- every freshness label names its clock basis;
- unavailable and invalid prices fail visibly;
- Australia defaults do not masquerade US/crypto indicators as domestic signals;
- core mission IDs remain stable;
- unsupported variants cannot apply the Australia extension;
- exported prices carry units or an explicit provider-native marker;
- the export preserves rights and no-trading constraints;
- all focused and upstream tests, type checking, and the Finance build pass on the exact head SHA.
