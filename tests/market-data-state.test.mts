import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { MarketData } from '../src/types/index.ts';
import {
  AUSTRALIA_DESK_MARKET_SYMBOLS,
  AUSTRALIA_DESK_RESOURCE_SYMBOLS,
  buildAustraliaMarketDeskSnapshot,
} from '../src/services/australia-market-desk.ts';
import {
  getLatestMarketRequestState,
  getMarketDataDeliveryState,
  getMarketDataState,
  markLatestMarketRequestState,
  markMarketDataState,
  resetMarketDataStateForTests,
} from '../src/services/market-data-state.ts';

function quote(symbol: string, price: number): MarketData {
  return {
    symbol,
    name: symbol,
    display: symbol,
    price,
    change: 0,
    sparkline: [price],
  };
}

function marketQuotes(): MarketData[] {
  return [
    quote('^AXJO', 8_900),
    quote('BHP.AX', 46),
    quote('CBA.AX', 178),
    quote('CSL.AX', 116),
  ];
}

function resourceQuotes(): MarketData[] {
  return [
    quote('AUDUSD=X', 0.66),
    quote('HG=F', 5.1),
    quote('GC=F', 3_100),
    quote('MTF=F', 124),
    quote('BZ=F', 74),
    quote('CL=F', 70),
    quote('NG=F', 3.3),
  ];
}

describe('market quote array data-state metadata', () => {
  beforeEach(() => resetMarketDataStateForTests());

  it('returns null for unmarked arrays and defensive copies for marked arrays', () => {
    const data = marketQuotes();
    assert.equal(getMarketDataState(data), null);

    markMarketDataState(data, { mode: 'cached', timestamp: 1_000, offline: true }, {
      latestAttemptState: { mode: 'unavailable', timestamp: null, offline: false },
      requestSymbols: AUSTRALIA_DESK_MARKET_SYMBOLS,
    });
    const first = getMarketDataState(data);
    const delivery = getMarketDataDeliveryState(data);
    assert.deepEqual(first, { mode: 'cached', timestamp: 1_000, offline: true });
    assert.deepEqual(delivery, {
      dataState: { mode: 'cached', timestamp: 1_000, offline: true },
      latestAttemptState: { mode: 'unavailable', timestamp: null, offline: false },
      requestKey: [...AUSTRALIA_DESK_MARKET_SYMBOLS].sort().join(','),
    });

    assert.ok(first);
    first.mode = 'live';
    first.timestamp = 2_000;
    first.offline = false;
    assert.ok(delivery);
    delivery.dataState.mode = 'live';
    delivery.latestAttemptState.mode = 'live';
    assert.deepEqual(
      getMarketDataDeliveryState(data),
      {
        dataState: { mode: 'cached', timestamp: 1_000, offline: true },
        latestAttemptState: { mode: 'unavailable', timestamp: null, offline: false },
        requestKey: [...AUSTRALIA_DESK_MARKET_SYMBOLS].sort().join(','),
      },
      'consumer mutation must not rewrite stored evidence state',
    );
  });

  it('prefers breaker timestamps over a misleading panel-completion timestamp', () => {
    const markets = marketQuotes();
    const resources = resourceQuotes();
    markMarketDataState(markets, {
      mode: 'cached',
      timestamp: Date.parse('2026-07-21T23:30:00Z'),
      offline: false,
    }, { requestSymbols: AUSTRALIA_DESK_MARKET_SYMBOLS });
    markMarketDataState(resources, {
      mode: 'live',
      timestamp: Date.parse('2026-07-22T00:19:00Z'),
      offline: false,
    }, { requestSymbols: AUSTRALIA_DESK_RESOURCE_SYMBOLS });

    const snapshot = buildAustraliaMarketDeskSnapshot(markets, resources, {
      now: new Date('2026-07-22T00:20:00Z'),
      marketFetchedAt: '2026-07-22T00:20:00Z',
      resourceFetchedAt: '2026-07-22T00:20:00Z',
      quoteMaxAgeMs: 15 * 60 * 1000,
    });

    assert.ok(snapshot.markets.every((entry) => entry.dataMode === 'cached'));
    assert.ok(snapshot.markets.every((entry) => entry.provenance.fetchedAtMs === Date.parse('2026-07-21T23:30:00Z')));
    assert.ok(snapshot.markets.every((entry) => entry.provenance.freshness === 'stale'));
    assert.ok(snapshot.resources.every((entry) => entry.dataMode === 'live'));
    assert.ok(snapshot.resources.every((entry) => entry.provenance.fetchedAtMs === Date.parse('2026-07-22T00:19:00Z')));
    assert.ok(snapshot.resources.every((entry) => entry.provenance.freshness === 'fresh'));
    assert.ok(snapshot.warnings.includes('Australian equity observations are being served from cache.'));
    assert.ok(snapshot.warnings.includes('Australian equity observations are stale.'));
    assert.equal(snapshot.warnings.includes('AUD/resource observations are stale.'), false);
  });

  it('surfaces a later failed refresh even when the panel retains an older array', () => {
    const markets = marketQuotes();
    const resources = resourceQuotes();
    markMarketDataState(markets, {
      mode: 'live',
      timestamp: Date.parse('2026-07-22T00:18:00Z'),
      offline: false,
    }, { requestSymbols: AUSTRALIA_DESK_MARKET_SYMBOLS });
    markMarketDataState(resources, {
      mode: 'cached',
      timestamp: Date.parse('2026-07-22T00:00:00Z'),
      offline: false,
    }, { requestSymbols: AUSTRALIA_DESK_RESOURCE_SYMBOLS });

    markLatestMarketRequestState(AUSTRALIA_DESK_RESOURCE_SYMBOLS, {
      mode: 'unavailable',
      timestamp: null,
      offline: true,
    });
    assert.deepEqual(getLatestMarketRequestState(AUSTRALIA_DESK_RESOURCE_SYMBOLS), {
      mode: 'unavailable',
      timestamp: null,
      offline: true,
    });

    const snapshot = buildAustraliaMarketDeskSnapshot(markets, resources, {
      now: new Date('2026-07-22T00:20:00Z'),
    });

    assert.equal(snapshot.resourceGroupStatus.dataMode, 'cached');
    assert.equal(snapshot.resourceGroupStatus.latestAttemptMode, 'unavailable');
    assert.equal(snapshot.resourceGroupStatus.latestAttemptOffline, true);
    assert.ok(snapshot.resources.every((entry) => entry.quote !== null));
    assert.ok(snapshot.warnings.includes('Latest AUD/resource refresh is unavailable; displaying the last usable observations.'));
    assert.ok(snapshot.warnings.includes('One or more market groups are using offline-mode data.'));
  });

  it('does not invent a fetch clock when the displayed data state is unavailable', () => {
    const markets = marketQuotes();
    const resources = resourceQuotes();
    markMarketDataState(markets, { mode: 'unavailable', timestamp: null, offline: false }, {
      requestSymbols: AUSTRALIA_DESK_MARKET_SYMBOLS,
    });
    markMarketDataState(resources, { mode: 'unavailable', timestamp: null, offline: true }, {
      requestSymbols: AUSTRALIA_DESK_RESOURCE_SYMBOLS,
    });

    const snapshot = buildAustraliaMarketDeskSnapshot(markets, resources, {
      now: new Date('2026-07-22T00:20:00Z'),
      marketFetchedAt: '2026-07-22T00:20:00Z',
      resourceFetchedAt: '2026-07-22T00:20:00Z',
    });

    assert.ok(snapshot.markets.every((entry) => entry.dataMode === 'unavailable'));
    assert.ok(snapshot.markets.every((entry) => entry.provenance.fetchedAtMs === null));
    assert.ok(snapshot.markets.every((entry) => entry.provenance.freshness === 'unknown'));
    assert.ok(snapshot.resources.every((entry) => entry.offline));
    assert.ok(snapshot.warnings.includes('One or more market groups are using offline-mode data.'));
  });
});
