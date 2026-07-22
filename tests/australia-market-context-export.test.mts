import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { MarketData } from '../src/types/index.ts';
import { buildAustraliaMarketDeskSnapshot } from '../src/services/australia-market-desk.ts';
import {
  AUSTRALIA_MARKET_CONTEXT_SCHEMA_VERSION,
  buildAustraliaMarketContextExport,
  serializeAustraliaMarketContextExport,
} from '../src/services/australia-market-context-export.ts';
import {
  markMarketDataState,
  resetMarketDataStateForTests,
} from '../src/services/market-data-state.ts';
import { FINANCE_OBSERVATION_PROVENANCE_VERSION } from '../src/shared/finance-observation-provenance.ts';

function quote(symbol: string, price: number, change: number): MarketData {
  return {
    symbol,
    name: symbol,
    display: symbol,
    price,
    change,
    sparkline: [price * 0.99, price],
  };
}

function snapshot() {
  const markets = [
    quote('^AXJO', 8900.25, 0.4),
    quote('BHP.AX', 46.2, -0.2),
    quote('CBA.AX', 178.1, 0.1),
    quote('CSL.AX', 116.3, 1.2),
  ];
  const resources = [
    quote('AUDUSD=X', 0.66, 0.2),
    quote('HG=F', 5.1, -0.1),
    quote('GC=F', 3100, 0.3),
    quote('MTF=F', 124, -0.4),
    quote('BZ=F', 74, 0.5),
    quote('CL=F', 70, 0.4),
    quote('NG=F', 3.3, -0.8),
  ];
  markMarketDataState(markets, {
    mode: 'live',
    timestamp: Date.parse('2026-07-22T00:00:00Z'),
    offline: false,
  }, {
    latestAttemptState: {
      mode: 'unavailable',
      timestamp: null,
      offline: false,
    },
    requestSymbols: markets.map((entry) => entry.symbol),
  });
  markMarketDataState(resources, {
    mode: 'cached',
    timestamp: Date.parse('2026-07-21T23:59:00Z'),
    offline: false,
  }, {
    latestAttemptState: {
      mode: 'live',
      timestamp: Date.parse('2026-07-22T00:04:00Z'),
      offline: false,
    },
    requestSymbols: resources.map((entry) => entry.symbol),
  });
  return buildAustraliaMarketDeskSnapshot(markets, resources, {
    now: new Date('2026-07-22T00:05:00Z'),
  });
}

describe('Australia market context export v2', () => {
  beforeEach(() => resetMarketDataStateForTests());

  it('builds a versioned read-only envelope with honest ASX source clocks', () => {
    const context = buildAustraliaMarketContextExport(snapshot());

    assert.equal(AUSTRALIA_MARKET_CONTEXT_SCHEMA_VERSION, 'worldmonitor-australia-context-v2');
    assert.equal(context.schemaVersion, AUSTRALIA_MARKET_CONTEXT_SCHEMA_VERSION);
    assert.equal(context.generatedAt, '2026-07-22T00:05:00.000Z');
    assert.equal(context.region, 'AU');
    assert.equal(context.intendedUse, 'read-only-research-context');
    assert.equal(context.asx.phase, 'regular');
    assert.equal(context.asx.calendarVerified, true);
    assert.equal(context.asx.sourceCheckedAt, '2026-07-22');
    assert.equal(context.asx.sourceReviewStatus, 'current');
    assert.equal(context.asx.sourceReviewAgeMs, 0);
    assert.equal(context.asx.evidence.provenanceSchemaVersion, FINANCE_OBSERVATION_PROVENANCE_VERSION);
    assert.equal(context.asx.evidence.sourceClass, 'official');
    assert.equal(context.asx.evidence.transformationKind, 'deterministic-model');
    assert.equal(context.asx.evidence.freshnessBasis, 'observed-at');
    assert.equal(context.asx.evidence.observedAt, '2026-07-22T00:05:00.000Z');
    assert.equal(context.asx.evidence.fetchedAt, null);
    assert.equal(context.asx.evidence.termsUrl, null);
    assert.equal(context.asx.evidence.confidenceMeaning, 'policy-heuristic-not-calibrated');
    assert.equal(context.observations.length, 11);
    assert.deepEqual(context.missingSymbols, []);
  });

  it('preserves displayed state separately from the latest refresh attempt', () => {
    const context = buildAustraliaMarketContextExport(snapshot());

    assert.deepEqual(context.groups.australianEquities, {
      dataMode: 'live',
      dataOffline: false,
      latestAttemptMode: 'unavailable',
      latestAttemptOffline: false,
    });
    assert.deepEqual(context.groups.audAndResources, {
      dataMode: 'cached',
      dataOffline: false,
      latestAttemptMode: 'live',
      latestAttemptOffline: false,
    });
    assert.ok(context.warnings.some((warning) => warning.includes('Latest Australian equity refresh is unavailable')));
  });

  it('classifies units and preserves delivery modes without trading authority', () => {
    const context = buildAustraliaMarketContextExport(snapshot());
    const bySymbol = new Map(context.observations.map((entry) => [entry.symbol, entry]));

    assert.equal(bySymbol.get('^AXJO')?.assetClass, 'index');
    assert.equal(bySymbol.get('^AXJO')?.quoteUnit, 'index-points');
    assert.equal(bySymbol.get('^AXJO')?.currency, null);
    assert.equal(bySymbol.get('^AXJO')?.dataMode, 'live');
    assert.equal(bySymbol.get('^AXJO')?.offline, false);
    assert.equal(bySymbol.get('BHP.AX')?.assetClass, 'equity');
    assert.equal(bySymbol.get('BHP.AX')?.quoteUnit, 'AUD-per-share');
    assert.equal(bySymbol.get('BHP.AX')?.currency, 'AUD');
    assert.equal(bySymbol.get('AUDUSD=X')?.assetClass, 'fx');
    assert.equal(bySymbol.get('AUDUSD=X')?.quoteUnit, 'USD-per-AUD');
    assert.equal(bySymbol.get('AUDUSD=X')?.currency, 'USD');
    assert.equal(bySymbol.get('AUDUSD=X')?.dataMode, 'cached');
    assert.equal(bySymbol.get('HG=F')?.assetClass, 'commodity');
    assert.equal(bySymbol.get('HG=F')?.quoteUnit, 'provider-native');
    assert.equal(bySymbol.get('HG=F')?.currency, null);
    assert.equal(bySymbol.get('^AXJO')?.price, 8900.25);
    assert.equal(bySymbol.get('^AXJO')?.changePercent, 0.4);
    assert.equal(bySymbol.get('^AXJO')?.evidence.observedAt, null);
    assert.equal(bySymbol.get('^AXJO')?.evidence.fetchedAt, '2026-07-22T00:00:00.000Z');
    assert.equal(bySymbol.get('^AXJO')?.evidence.freshnessBasis, 'fetched-at');
    assert.equal(bySymbol.get('^AXJO')?.evidence.confidenceMeaning, 'policy-heuristic-not-calibrated');
    assert.ok(bySymbol.get('^AXJO')?.evidence.flags.includes('missing-observed-at'));
    assert.ok(bySymbol.get('^AXJO')?.evidence.flags.includes('unverified-access-method'));

    assert.deepEqual(context.controls, {
      readOnly: true,
      investmentRecommendationIncluded: false,
      targetPriceIncluded: false,
      positionSizingIncluded: false,
      orderInstructionIncluded: false,
      executionInstructionIncluded: false,
      causationEstablished: false,
      providerRightsStatus: 'internal-research-only',
      redistributionRightsReviewed: false,
    });
    for (const forbiddenKey of ['targetPrice', 'positionSize', 'orderInstruction', 'tradeRecommendation']) {
      assert.equal(Object.hasOwn(context, forbiddenKey), false, `${forbiddenKey} must not be a top-level action field`);
    }
    assert.ok(context.constraints.some((constraint) => constraint.includes('not an investment recommendation')));
    assert.ok(context.constraints.some((constraint) => constraint.includes('No order')));
    assert.ok(context.constraints.some((constraint) => constraint.includes('not Australian market breadth')));
    assert.ok(context.constraints.some((constraint) => constraint.includes('rights review')));
    assert.ok(context.constraints.some((constraint) => constraint.includes('not calibrated probabilities')));
  });

  it('preserves missing data and degraded evidence visibly', () => {
    const degraded = buildAustraliaMarketDeskSnapshot(
      [quote('^AXJO', 8900.25, 0.4)],
      [],
      {
        now: new Date('2026-07-22T00:45:00Z'),
        fetchedAt: '2026-07-22T00:00:00Z',
        quoteMaxAgeMs: 15 * 60 * 1000,
      },
    );
    const context = buildAustraliaMarketContextExport(degraded);
    const asx = context.observations.find((entry) => entry.symbol === '^AXJO');
    const bhp = context.observations.find((entry) => entry.symbol === 'BHP.AX');

    assert.equal(asx?.dataMode, 'unknown');
    assert.equal(asx?.evidence.freshness, 'stale');
    assert.ok(asx?.evidence.flags.includes('stale-observation'));
    assert.equal(bhp?.quoteAvailable, false);
    assert.equal(bhp?.price, null);
    assert.ok(context.missingSymbols.includes('BHP.AX'));
    assert.ok(context.warnings.some((warning) => warning.includes('unavailable or invalid')));
  });

  it('serializes deterministically with no undefined fields', () => {
    const context = buildAustraliaMarketContextExport(snapshot());
    const first = serializeAustraliaMarketContextExport(context);
    const second = serializeAustraliaMarketContextExport(context);

    assert.equal(first, second);
    assert.equal(first.endsWith('\n'), true);
    assert.equal(first.includes('undefined'), false);
    assert.deepEqual(JSON.parse(first), context);
  });
});
