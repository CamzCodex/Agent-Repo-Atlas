import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, it } from 'node:test';

import type { MarketData } from '../src/types/index.ts';
import {
  buildAustraliaMacroContextModel,
  renderAustraliaMacroContext,
} from '../src/components/australia-macro-context.ts';
import {
  AUSTRALIA_DESK_MARKET_SYMBOLS,
  AUSTRALIA_DESK_RESOURCE_SYMBOLS,
  buildAustraliaMarketDeskSnapshot,
} from '../src/services/australia-market-desk.ts';
import {
  AUSTRALIA_MARKET_CONTEXT_SCHEMA_VERSION,
  buildAustraliaMarketContextExport,
} from '../src/services/australia-market-context-export.ts';
import {
  markMarketDataState,
  resetMarketDataStateForTests,
} from '../src/services/market-data-state.ts';

const macroPanelSource = readFileSync(
  new URL('../src/components/MacroTilesPanel.ts', import.meta.url),
  'utf8',
);

function quote(symbol: string, price: number, change: number | null): MarketData {
  return {
    symbol,
    name: symbol,
    display: symbol,
    price,
    change,
    sparkline: [price * 0.99, price],
  };
}

function completeQuotes(change: number | null = 0.4): {
  markets: MarketData[];
  resources: MarketData[];
} {
  return {
    markets: [
      quote('^AXJO', 8_900.25, change),
      quote('BHP.AX', 46.2, -0.2),
      quote('CBA.AX', 178.1, 0.1),
      quote('CSL.AX', 116.3, 1.2),
    ],
    resources: [
      quote('AUDUSD=X', 0.66, 0.2),
      quote('HG=F', 5.1, -0.1),
      quote('GC=F', 3_100, 0.3),
      quote('MTF=F', 124, -0.4),
      quote('BZ=F', 74, 0.5),
      quote('CL=F', 70, 0.4),
      quote('NG=F', 3.3, -0.8),
    ],
  };
}

function markedSnapshot(change: number | null = 0.4) {
  const { markets, resources } = completeQuotes(change);
  markMarketDataState(
    markets,
    { mode: 'live', timestamp: Date.parse('2026-07-22T00:04:00Z'), offline: false },
    {
      latestAttemptState: { mode: 'unavailable', timestamp: null, offline: false },
      requestSymbols: AUSTRALIA_DESK_MARKET_SYMBOLS,
    },
  );
  markMarketDataState(
    resources,
    { mode: 'cached', timestamp: Date.parse('2026-07-22T00:00:00Z'), offline: false },
    {
      latestAttemptState: { mode: 'live', timestamp: Date.parse('2026-07-22T00:03:00Z'), offline: false },
      requestSymbols: AUSTRALIA_DESK_RESOURCE_SYMBOLS,
    },
  );
  return buildAustraliaMarketDeskSnapshot(markets, resources, {
    now: new Date('2026-07-22T00:05:00Z'),
  });
}

describe('Australia adversarial v4 asynchronous controls', () => {
  it('uses a newest-request-wins epoch and explicit breaker states', () => {
    assert.match(macroPanelSource, /private _australiaLoadEpoch = 0/);
    assert.match(macroPanelSource, /const epoch = \+\+this\._australiaLoadEpoch/);
    assert.match(macroPanelSource, /epoch !== this\._australiaLoadEpoch/);
    assert.match(macroPanelSource, /this\.signal\.aborted/);
    assert.match(macroPanelSource, /shouldReplaceDisplayedState/);
    assert.match(macroPanelSource, /marketDataState: this\._australiaMarketDataState/);
    assert.match(macroPanelSource, /marketLatestAttemptState: this\._australiaMarketLatestAttemptState/);
    assert.doesNotMatch(macroPanelSource, /_australiaMarketFetchedAt/);
    assert.doesNotMatch(macroPanelSource, /_australiaResourceFetchedAt/);
  });

  it('falls back after Clipboard API rejection and prevents reentrant copies', () => {
    assert.match(macroPanelSource, /if \(button\.disabled \|\| this\.signal\.aborted\) return/);
    assert.match(macroPanelSource, /await navigator\.clipboard\.writeText\(text\)/);
    assert.match(macroPanelSource, /catch \{\s*copied = this\._copyWithTextarea\(text\)/);
    assert.match(macroPanelSource, /finally \{\s*textarea\.remove\(\)/);
    assert.match(macroPanelSource, /button\.disabled = true/);
    assert.match(macroPanelSource, /this\._australiaLoadEpoch \+= 1/);
  });
});

describe('Australia adversarial v4 machine contract', () => {
  beforeEach(() => resetMarketDataStateForTests());

  it('bumps the draft schema while preserving quote-group compatibility', () => {
    const context = buildAustraliaMarketContextExport(markedSnapshot());

    assert.equal(AUSTRALIA_MARKET_CONTEXT_SCHEMA_VERSION, 'worldmonitor-australia-context-v2');
    assert.equal(context.schemaVersion, AUSTRALIA_MARKET_CONTEXT_SCHEMA_VERSION);
    assert.deepEqual(context.quoteGroups.equities, {
      dataMode: 'live',
      dataOffline: false,
      latestAttemptMode: 'unavailable',
      latestAttemptOffline: false,
    });
    assert.deepEqual(context.quoteGroups.resources, {
      dataMode: 'cached',
      dataOffline: false,
      latestAttemptMode: 'live',
      latestAttemptOffline: false,
    });
    assert.equal(context.asx.sourceReviewStatus, 'current');
    assert.equal(context.asx.sourceReviewAgeMs, 0);
  });

  it('provides machine-readable no-action and rights controls', () => {
    const context = buildAustraliaMarketContextExport(markedSnapshot());

    assert.deepEqual(context.controls, {
      readOnly: true,
      recommendationsIncluded: false,
      priceTargetsIncluded: false,
      positionSizingIncluded: false,
      ordersIncluded: false,
      executionIncluded: false,
      brokerActionsIncluded: false,
      portfolioMutationIncluded: false,
      causationEstablished: false,
      providerRightsStatus: 'internal-research-only',
      redistributionRightsReviewed: false,
    });
    assert.ok(context.constraints.some((constraint) => constraint.includes('rights review')));
    assert.ok(context.constraints.some((constraint) => constraint.includes('not calibrated probabilities')));
  });
});

describe('Australia adversarial v4 visual honesty', () => {
  beforeEach(() => resetMarketDataStateForTests());

  it('renders missing or flat change neutrally rather than as a loss', () => {
    const snapshot = markedSnapshot(null);
    const html = renderAustraliaMacroContext(
      buildAustraliaMacroContextModel(new Date('2026-07-22T00:05:00Z'), snapshot),
      snapshot,
    );

    assert.match(html, /Change unavailable/);
    assert.match(html, /color:var\(--text-dim\);font-weight:600[^>]*>Change unavailable/);
  });

  it('uses the degraded session tone for an unverified calendar', () => {
    const model = buildAustraliaMacroContextModel(new Date('2027-07-22T00:05:00Z'));
    const html = renderAustraliaMacroContext(model);

    assert.equal(model.status.session, 'unknown');
    assert.equal(model.statusTone, '#e67e22');
    assert.match(html, /<strong style="color:#e67e22[^>]*>Session<\/strong>/);
  });

  it('labels the export control as read-only research context', () => {
    const snapshot = markedSnapshot();
    const html = renderAustraliaMacroContext(
      buildAustraliaMacroContextModel(new Date('2026-07-22T00:05:00Z'), snapshot),
      snapshot,
    );

    assert.match(html, /aria-label="Copy read-only Australia market context as JSON"/);
    assert.match(html, /no trading instructions/);
  });
});
