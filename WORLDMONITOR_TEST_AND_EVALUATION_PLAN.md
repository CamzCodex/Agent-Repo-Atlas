# World Monitor Test and Evaluation Plan

Last reviewed: 2026-07-22

## Layers

| Layer | Required coverage |
| --- | --- |
| Unit | Time parsing, freshness basis, rights, revisions, units, manifests, invalid values, mission variants, entity matching, no-trading controls |
| Concurrency | Older completion after newer invocation, mission change, destroy, partial groups, failed latest with retained display, duplicate keys, background completion |
| Provider | Drift, empty success, malformed artifact, future time, delay, revision, missed release, entitlement failure, rights-blocked export |
| Historical | Idempotent replay, revisions, point-in-time constituents, actions, symbol changes, delistings and survivorship bias |
| Security | SSRF/redirects, injection classes, bombs/limits, stale replay, invalid rights, prompt injection |
| Contract | Producer → neutral schema → runtime provider → ResearchBag → recommendation; citations/dissent/no-side-effects preserved |
| Evaluation | Contribution ablation, false-confidence rate, contradiction handling, calibration impact and reviewer override rate |

## Immediate WP1 gate

1. `git diff --check`.
2. Biome on changed source/tests.
3. Focused trust tests.
4. Complete restored upstream test suite.
5. `tsc --noEmit`.
6. Full dashboard build.
7. Finance build.
8. Exact published SHA workflow; run ID recorded.

An earlier SHA's success cannot satisfy step 8.

## Current WP1 evidence

- Focused trust suite: 40 tests, 10 suites, 0 failures.
- TypeScript, changed-file Biome, Markdown and JSON validation: passed.
- Full and Finance production bundles: passed with documented Vite warnings.
- Fallback-loader full suite: 16,128 tests; 16,107 passed; 15 failed; 6 skipped.
- Failure split: two sandbox-blocked `tsx` IPC generator subprocesses and thirteen
  missing dynamic-module exports in `redis-caching.test.mjs` under the fallback
  loader.
- Exact published-head Actions runs: none.

This evidence keeps WP1 red/pending. The fallback-loader failures require
confirmation using the repository's normal runner in hosted CI; they are not an
accepted exclusion.

## Cross-repo acceptance

- Neutral examples pass producer and consumer validators.
- Original payload digest appears in immutable Stock Runtime archive.
- Unknown major, missing provenance/rights/time, stale critical data and trading instructions fail closed.
- Missing values and dissent survive byte/semantic round trip.
- Recommendation identifies the distinct World Monitor contribution and invalidation conditions.
- Filesystem/network/broker spies prove zero order or portfolio side effects.

## Evaluation baselines

Compare stock decisions with and without World Monitor context on frozen, point-in-time evidence. Report usefulness and harm separately: correct risk escalation, false catalyst attribution, contradiction detection, confidence inflation and latency/cost. Do not promote on anecdotal examples.
