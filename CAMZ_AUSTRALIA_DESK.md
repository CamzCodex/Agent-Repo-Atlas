# Camz World Monitor — Australia / ASX Desk

This branch adds the first usable Australia-focused workspace on top of the validated `camz/local-foundation` branch.

- Base enhancement: `camz/local-foundation`
- Australia branch: `camz/australia-desk`
- Upstream provenance: `.worldmonitor-upstream.json`
- Platform licence: `AGPL-3.0-only`
- Adversarial register: `CAMZ_AUSTRALIA_DESK_ADVERSARIAL_REVIEW.md`

## What changed

### Australia / ASX mission extension

Open the **Mission** menu in the full or Finance variant and choose **Australia / ASX Desk**.

Australia is an extension layered on top of the stable seven-preset v1 core. It is not exposed in the tech, commodity, energy, or happy variants.

The preset:

- centres the map on Oceania;
- uses a seven-day context window;
- enables markets, commodities, FX, macro indicators, central-bank, economic-calendar, supply-chain, trade-policy, sanctions, energy, gold, news and world-clock panels;
- enables stock-exchange, financial-centre, central-bank, commodity-hub, trade-route, waterway, AIS, pipeline, economic, sanctions, weather, outage, natural-event and minerals map layers.

S&P 500 breadth, BTC/QQQ macro signals, and US mega-cap/CFTC liquidity panels are deliberately **not** selected by default. They remain opt-in global context rather than being presented as Australia-native signals.

The workspace is intended to answer questions such as:

- Is an ASX move local, global, commodity-driven or China-sensitive?
- Is AUD confirming or contradicting the equity move?
- Are copper, gold, coal, oil or gas transmitting a macro shock?
- Are shipping routes, sanctions, infrastructure outages or Asia-Pacific events relevant?
- Is the ASX actually trading, in auction, post-close, on holiday or outside verified calendar coverage?

### Mission-scoped Australia tab

When the Australia mission is active, **Macro Indicators** gains an Australia tab and selects it automatically. Other missions retain the existing US, Euro Area and China tabs without additional Australia surface area.

The Australia tab renders:

- the current Sydney-local ASX phase and verified-calendar state;
- seeded ASX 200, BHP, CBA and CSL cards;
- AUD/USD, copper, gold, Newcastle coal, Brent, WTI and natural-gas cards;
- positive/negative change cues;
- explicit freshness clock basis on each card;
- separate ASX-basket and AUD/resources evidence rows;
- undocumented-access, stale, future, invalid and missing-observation-time flags;
- warnings that the data is seeded context rather than exchange-grade real-time data;
- a visible reminder that four equities are a benchmark/bellwether sample, not ASX market breadth.

The tab refreshes the Sydney session clock every 30 seconds while active. Equity and resource retrieval clocks remain independent. Retrieval/cache time is never presented as the exchange observation timestamp.

## Seeded Australian market universe

The browser and Railway stock mirrors both contain:

| Symbol | Display | Role |
| --- | --- | --- |
| `^AXJO` | ASX 200 | Australian market benchmark |
| `BHP.AX` | BHP | Diversified resources bellwether |
| `CBA.AX` | CBA | Domestic banking and rates bellwether |
| `CSL.AX` | CSL | Global healthcare/export bellwether |

The existing commodity/FX basket contains the main Australia transmission channels used by the desk:

- `AUDUSD=X` — AUD/USD;
- `HG=F` — copper;
- `GC=F` — gold;
- `MTF=F` — Newcastle coal;
- `BZ=F` and `CL=F` — Brent and WTI crude;
- `NG=F` — natural gas.

These symbols use World Monitor's existing Yahoo-derived seeding path. That path is explicitly treated as **undocumented and delayed**, not exchange-grade real-time data. A zero, negative, non-finite, or missing price fails closed as unavailable.

## ASX session model

Two lockstep implementations exist:

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

ASX moved from staggered rotations to a single opening in June 2025. The model conservatively keeps the randomized transition in `opening-auction` until 10:00 rather than claiming continuous trading seconds early.

The official 2026 ASX Trade calendar is transcribed. A weekday outside a verified calendar year returns `unknown`; it does not silently assume the market is open.

The model evaluation time is recorded as `observedAt`. The official source-check date is stored separately. Rendering the panel does not claim that ASX trading hours were fetched live at that moment, and the desk warns when the source review age exceeds 90 days.

## Evidence model

`src/services/australia-market-desk.ts` builds a deterministic Australia desk snapshot from market and commodity quotes. `src/components/australia-macro-context.ts` turns that snapshot into a sanitized, evidence-labelled workstation view.

The snapshot keeps these evidence classes separate:

1. **ASX session state**
   - provider: ASX;
   - source class: official;
   - transformation: deterministic calendar/session model;
   - model evaluation time: explicit;
   - official source-check date: explicit and separate;
   - confidence falls when the calendar year is unverified.

2. **ASX benchmark and bellwether observations**
   - provider: World Monitor seeded market path;
   - source class: undocumented;
   - transformation: normalized;
   - retrieval/cache clock: explicit when available;
   - exchange observation time: currently unavailable.

3. **AUD and resource observations**
   - independent retrieval/cache clock;
   - the same missing, stale, future, invalid, and undocumented-access controls;
   - no ability for a fresh equity response to make older resource data look fresh.

The desk deliberately does not collapse those facts into a universal trust score.

## Read-only context export

`src/services/australia-market-context-export.ts` defines `worldmonitor-australia-context-v1`, a JSON envelope for downstream research systems.

The **Copy context JSON** control exports the typed snapshot rather than scraping rendered HTML. The envelope contains:

- schema version, generation time, region and intended use;
- ASX phase, session, local clock, calendar verification, source-check date and official evidence;
- each index/equity/FX/commodity observation with price, percentage change, asset class, currency and quote unit;
- provider, access class, transformation description/version and source URL;
- observed/fetched clocks, `freshnessBasis`, age, freshness, heuristic confidence, flags and notes;
- missing symbols and degraded-provider warnings;
- explicit constraints excluding recommendations, position sizing, target prices, orders and execution instructions;
- an explicit compact-basket limitation;
- an internal-research rights constraint for provider-derived values.

Futures whose current provider contract does not guarantee a normalized unit are labelled `provider-native`; the system does not invent a unit.

The export is intentionally read-only. Downstream systems may use it as evidence, but must not silently turn associations into causation or trading instructions.

## Validation commands

From the branch root:

```bash
nvm use
npm ci

npx biome check \
  shared/stocks.json \
  scripts/shared/stocks.json \
  src/shared/asx-market-hours.ts \
  src/services/australia-market-desk.ts \
  src/services/australia-market-context-export.ts \
  src/services/mission-presets.ts \
  src/components/australia-macro-context.ts \
  src/components/MacroTilesPanel.ts \
  tests/asx-market-hours-browser-parity.test.mts \
  tests/australia-market-desk.test.mts \
  tests/australia-macro-context.test.mts \
  tests/australia-market-context-export.test.mts \
  tests/australia-mission-extension.test.mts \
  tests/macro-tiles-china-ui.test.mts

npx tsx --test \
  tests/asx-market-hours.test.mjs \
  tests/asx-market-hours-browser-parity.test.mts \
  tests/finance-observation-provenance.test.mts \
  tests/australia-market-desk.test.mts \
  tests/australia-macro-context.test.mts \
  tests/australia-market-context-export.test.mts \
  tests/australia-mission-extension.test.mts \
  tests/macro-tiles-china-ui.test.mts

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
- Do not infer an upstream observation timestamp from a retrieval/cache timestamp.
- Always preserve and label `freshnessBasis`.
- Do not suppress `unknown` calendar state.
- Do not call the four-equity basket Australian market breadth.
- Do not treat the mission preset as an investment recommendation.
- Do not add broker execution or automatic order routing.
- Keep official, licensed, public-API, undocumented, estimated, deterministic and AI-derived evidence visibly distinct.
- Do not redistribute or republish provider-derived values without a separate rights review.

## Next implementation slice

The next governed step is a read-only provider in `Stock-Market-Agent-Runtime` that validates `worldmonitor-australia-context-v1` and adds it to the evidence-weighted research bag.

That adapter should:

- be implemented independently rather than copying AGPL source into the MIT runtime;
- fail closed on schema mismatch or malformed provenance;
- preserve `freshnessBasis`, missing-symbol, stale-data and unavailable-observation-time flags;
- keep geopolitical, commodity, shipping and China-sensitive context separate from price observations;
- expose source URLs, units and transformation metadata to talkback/reporting;
- preserve the internal-research rights constraint;
- contribute context and dissent, never order routing or automatic trading.
