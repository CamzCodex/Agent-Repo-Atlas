# Camz World Monitor — Australia / ASX Desk

This branch adds the first usable Australia-focused workspace on top of the validated `camz/local-foundation` branch.

- Base enhancement: `camz/local-foundation`
- Australia branch: `camz/australia-desk`
- Upstream provenance: `.worldmonitor-upstream.json`
- Platform licence: `AGPL-3.0-only`

## What changed

### Australia / ASX mission preset

Open the **Mission** menu in World Monitor and choose **Australia / ASX Desk**.

The preset:

- centres the map on Oceania;
- uses a seven-day context window;
- enables markets, commodities, FX, macro, central-bank, economic-calendar, supply-chain, energy, gold, breadth, liquidity and sanctions panels;
- enables stock-exchange, central-bank, commodity-hub, trade-route, waterway, pipeline, economic, sanctions, weather, outage, natural-event and minerals map layers.

The workspace is deliberately cross-domain. It is intended to answer questions such as:

- Is an ASX move local, global, commodity-driven or China-sensitive?
- Is AUD confirming or contradicting the equity move?
- Are copper, gold, coal, oil or gas transmitting a macro shock?
- Are shipping routes, sanctions, infrastructure outages or Asia-Pacific events relevant?
- Is the ASX actually trading, in auction, post-close, on holiday or outside verified calendar coverage?

### Mission-scoped Australia tab

When the Australia mission is active, **Macro Indicators** gains an Australia tab and selects it automatically. Other missions retain the existing US, Euro Area and China tabs without additional Australia surface area.

The Australia tab renders:

- the current Sydney-local ASX phase and verified-calendar state;
- live seeded ASX 200, BHP, CBA and CSL cards;
- AUD/USD, copper, gold, Newcastle coal, Brent, WTI and natural-gas cards;
- positive/negative change cues;
- compact freshness/source-state badges;
- explicit undocumented-access and missing-observation-time flags;
- session and quote evidence summaries;
- warnings that the data is seeded context rather than exchange-grade real-time data.

The tab refreshes the Sydney session clock every 30 seconds while active. Quote freshness is recomputed from the last successful retrieval time; the panel does not pretend that retrieval time is the exchange observation timestamp.

## Seeded Australian market universe

The stock/index basket now contains:

| Symbol | Display | Role |
| --- | --- | --- |
| `^AXJO` | ASX 200 | Australian market benchmark |
| `BHP.AX` | BHP | Diversified resources bellwether |
| `CBA.AX` | CBA | Domestic banking and rates bellwether |
| `CSL.AX` | CSL | Global healthcare/export bellwether |

The existing commodity/FX basket already contains the main Australia transmission channels used by the desk:

- `AUDUSD=X` — AUD/USD;
- `HG=F` — copper;
- `GC=F` — gold;
- `MTF=F` — Newcastle coal;
- `BZ=F` and `CL=F` — Brent and WTI crude;
- `NG=F` — natural gas.

These symbols use World Monitor's existing Yahoo-derived seeding path. That path is explicitly treated as **undocumented and delayed**, not exchange-grade real-time data.

## ASX session model

Two lockstep implementations now exist:

- `scripts/shared/asx-market-hours.cjs` for seeders and relay code;
- `src/shared/asx-market-hours.ts` for browser and client services.

The shared model covers:

- pre-open;
- opening auction/transition;
- regular trading;
- Pre-CSPA;
- closing auction;
- post-close;
- official holiday;
- official early close;
- closed;
- unknown.

It uses `Australia/Sydney` through the runtime IANA timezone database. Sydney/Adelaide daylight-saving differences therefore remain date-aware instead of relying on hard-coded UTC offsets.

The official 2026 ASX Trade calendar is transcribed. A weekday outside a verified calendar year returns `unknown`; it does not silently assume the market is open.

## Evidence model

`src/services/australia-market-desk.ts` builds a deterministic Australia desk snapshot from market and commodity quotes. `src/components/australia-macro-context.ts` turns that snapshot into a sanitized, evidence-labelled workstation view.

The snapshot keeps these evidence classes separate:

1. **ASX session state**
   - provider: ASX;
   - source class: official;
   - transformation: deterministic calendar/session model;
   - observation time: explicit;
   - confidence falls when the calendar year is unverified.

2. **Market and commodity observations**
   - provider: World Monitor seeded market path;
   - source class: undocumented;
   - transformation: normalized;
   - retrieval time: explicit when supplied;
   - exchange observation time: currently unavailable;
   - missing, stale and future-dated values remain visible as flags.

The desk deliberately does not collapse those facts into a universal trust score.

## Validation commands

From the branch root:

```bash
nvm use
npm ci

npx biome check \
  shared/stocks.json \
  src/shared/asx-market-hours.ts \
  src/services/australia-market-desk.ts \
  src/services/mission-presets.ts \
  src/components/australia-macro-context.ts \
  src/components/MacroTilesPanel.ts \
  tests/asx-market-hours-browser-parity.test.mts \
  tests/australia-market-desk.test.mts \
  tests/australia-macro-context.test.mts

npx tsx --test \
  tests/asx-market-hours.test.mjs \
  tests/asx-market-hours-browser-parity.test.mts \
  tests/finance-observation-provenance.test.mts \
  tests/australia-market-desk.test.mts \
  tests/australia-macro-context.test.mts

npm run typecheck
npm run build:finance
```

For upstream CI parity, restore the preserved workflow files, build the full dashboard artifacts required by built-output tests, and then run the complete suite:

```bash
npm run camz:restore-workflows
VITE_VARIANT=full ./node_modules/.bin/vite build
npm run test:data
```

## Trust rules

- Do not call the Yahoo-derived values exchange-real-time.
- Do not infer an upstream observation timestamp from the local retrieval timestamp.
- Do not suppress `unknown` calendar state.
- Do not treat the mission preset as an investment recommendation.
- Do not add broker execution or automatic order routing.
- Keep official, licensed, public-API, undocumented, estimated, deterministic and AI-derived evidence visibly distinct.

## Next implementation slice

The next step is a read-only Australia context export for `Stock-Market-Agent-Runtime` that preserves:

- symbol and current normalized quote;
- ASX session evidence;
- retrieval age and missing observation-time flags;
- provider/source class and transformation metadata;
- missing-symbol and degraded-provider warnings;
- geopolitical, commodity, shipping and China-sensitive context without implying causation.
