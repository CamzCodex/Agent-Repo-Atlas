import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { MarketData } from '../src/types/index.ts';
import { buildAustraliaMarketDeskSnapshot } from '../src/services/australia-market-desk.ts';
import {
  beginMarketRequest,
  completeMarketRequest,
  getLatestMarketRequestToken,
  getLatestMarketRequestState,
  getMarketDataDeliveryState,
  getMarketDataState,
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

const MARKET_SYMBOLS = ['^AXJO', 'BHP.AX', 'CBA.AX', 'CSL.AX'];
const RESOURCE_SYMBOLS = ['AUDUSD=X', 'HG=F', 'GC=F', 'MTF=F', 'BZ=F', 'CL=F', 'NG=F'];

describe('market quote array delivery-state metadata', () => {
  beforeEach(() => resetMarketDataStateForTests());

  it('returns defensive displayed/latest states and a bounded request-key lookup', () => {
    const data = marketQuotes();
    assert.equal(getMarketDataState(data), null);
    assert.equal(getMarketDataDeliveryState(data), null);

    const requestToken = completeMarketRequest(
      beginMarketRequest(MARKET_SYMBOLS, { requestId: 'request-1', startedAtMs: 100 }),
      { mode: 'unavailable', timestamp: null, offline: false },
      200,
    );

    markMarketDataState(
      data,
      { mode: 'cached', timestamp: 1_000, offline: true },
      {
        latestAttemptState: { mode: 'unavailable', timestamp: null, offline: false },
        requestSymbols: MARKET_SYMBOLS,
        requestToken,
      },
    );

    const delivery = getMarketDataDeliveryState(data);
    assert.deepEqual(delivery, {
      dataState: { mode: 'cached', timestamp: 1_000, offline: true },
      latestAttemptState: { mode: 'unavailable', timestamp: null, offline: false },
      requestKey: 'BHP.AX,CBA.AX,CSL.AX,^AXJO',
      requestToken: {
        requestId: 'request-1',
        requestKey: 'BHP.AX,CBA.AX,CSL.AX,^AXJO',
        invocationSequence: 1,
        startedAtMs: 100,
        completedAtMs: 200,
        state: { mode: 'unavailable', timestamp: null, offline: false },
      },
    });
    assert.deepEqual(
      getLatestMarketRequestState([...MARKET_SYMBOLS].reverse()),
      { mode: 'unavailable', timestamp: null, offline: false },
      'request lookup must be order independent',
    );

    assert.ok(delivery);
    delivery.dataState.mode = 'live';
    delivery.latestAttemptState.mode = 'live';
    delivery.requestKey = null;
    assert.ok(delivery.requestToken?.state);
    delivery.requestToken.state.mode = 'live';
    const displayedOnly = getMarketDataState(data);
    assert.deepEqual(displayedOnly, { mode: 'cached', timestamp: 1_000, offline: true });
    displayedOnly!.mode = 'live';
    assert.deepEqual(
      getMarketDataDeliveryState(data),
      {
        dataState: { mode: 'cached', timestamp: 1_000, offline: true },
        latestAttemptState: { mode: 'unavailable', timestamp: null, offline: false },
        requestKey: 'BHP.AX,CBA.AX,CSL.AX,^AXJO',
        requestToken: {
          requestId: 'request-1',
          requestKey: 'BHP.AX,CBA.AX,CSL.AX,^AXJO',
          invocationSequence: 1,
          startedAtMs: 100,
          completedAtMs: 200,
          state: { mode: 'unavailable', timestamp: null, offline: false },
        },
      },
      'consumer mutation must not rewrite stored evidence state',
    );
  });

  it('keeps invocation order authoritative when an older request completes last', () => {
    const older = beginMarketRequest(MARKET_SYMBOLS, {
      requestId: 'older',
      startedAtMs: 100,
    });
    const newer = beginMarketRequest(MARKET_SYMBOLS, {
      requestId: 'newer',
      startedAtMs: 200,
    });

    completeMarketRequest(
      newer,
      { mode: 'live', timestamp: 250, offline: false },
      300,
    );
    completeMarketRequest(
      older,
      { mode: 'cached', timestamp: 150, offline: true },
      400,
    );

    assert.deepEqual(getLatestMarketRequestToken([...MARKET_SYMBOLS].reverse()), {
      requestId: 'newer',
      requestKey: 'BHP.AX,CBA.AX,CSL.AX,^AXJO',
      invocationSequence: 2,
      startedAtMs: 200,
      completedAtMs: 300,
      state: { mode: 'live', timestamp: 250, offline: false },
    });
  });

  it('does not let an older completion replace a newer in-flight invocation', () => {
    const older = beginMarketRequest(MARKET_SYMBOLS, { requestId: 'older', startedAtMs: 100 });
    const newer = beginMarketRequest(MARKET_SYMBOLS, { requestId: 'newer', startedAtMs: 200 });

    completeMarketRequest(
      older,
      { mode: 'unavailable', timestamp: null, offline: false },
      300,
    );

    assert.deepEqual(getLatestMarketRequestToken(MARKET_SYMBOLS), newer);
    assert.equal(getLatestMarketRequestState(MARKET_SYMBOLS), null);
  });

  it('prefers displayed-data timestamps and exposes a failed latest refresh separately', () => {
    const markets = marketQuotes();
    const resources = resourceQuotes();
    markMarketDataState(
      markets,
      {
        mode: 'cached',
        timestamp: Date.parse('2026-07-21T23:30:00Z'),
        offline: false,
      },
      {
        latestAttemptState: { mode: 'unavailable', timestamp: null, offline: false },
        requestSymbols: MARKET_SYMBOLS,
      },
    );
    markMarketDataState(
      resources,
      {
        mode: 'live',
        timestamp: Date.parse('2026-07-22T00:19:00Z'),
        offline: false,
      },
      {
        latestAttemptState: {
          mode: 'live',
          timestamp: Date.parse('2026-07-22T00:19:00Z'),
          offline: false,
        },
        requestSymbols: RESOURCE_SYMBOLS,
      },
    );

    const snapshot = buildAustraliaMarketDeskSnapshot(markets, resources, {
      now: new Date('2026-07-22T00:20:00Z'),
      // Old panel-completion timestamps must be ignored because each array
      // carries stronger per-call breaker evidence.
      marketFetchedAt: '2026-07-22T00:20:00Z',
      resourceFetchedAt: '2026-07-22T00:20:00Z',
      quoteMaxAgeMs: 15 * 60 * 1000,
    });

    assert.deepEqual(snapshot.marketGroupStatus, {
      dataMode: 'cached',
      dataOffline: false,
      latestAttemptMode: 'unavailable',
      latestAttemptOffline: false,
    });
    assert.deepEqual(snapshot.resourceGroupStatus, {
      dataMode: 'live',
      dataOffline: false,
      latestAttemptMode: 'live',
      latestAttemptOffline: false,
    });
    assert.ok(snapshot.markets.every((entry) => entry.dataMode === 'cached'));
    assert.ok(snapshot.markets.every((entry) => entry.latestAttemptMode === 'unavailable'));
    assert.ok(snapshot.markets.every((entry) => entry.provenance.fetchedAtMs === Date.parse('2026-07-21T23:30:00Z')));
    assert.ok(snapshot.markets.every((entry) => entry.provenance.freshness === 'stale'));
    assert.ok(snapshot.resources.every((entry) => entry.dataMode === 'live'));
    assert.ok(snapshot.resources.every((entry) => entry.latestAttemptMode === 'live'));
    assert.ok(snapshot.resources.every((entry) => entry.provenance.fetchedAtMs === Date.parse('2026-07-22T00:19:00Z')));
    assert.ok(snapshot.resources.every((entry) => entry.provenance.freshness === 'fresh'));
    assert.ok(snapshot.warnings.includes('Australian equity observations are being served from cache.'));
    assert.ok(snapshot.warnings.includes('Latest Australian equity refresh is unavailable; displaying the last usable observations.'));
    assert.ok(snapshot.warnings.includes('Australian equity observations are stale.'));
    assert.equal(snapshot.warnings.includes('AUD/resource observations are stale.'), false);
  });

  it('reports a live but empty latest fetch while retaining last-good displayed values', () => {
    const markets = marketQuotes();
    const resources = resourceQuotes();
    markMarketDataState(
      markets,
      { mode: 'cached', timestamp: Date.parse('2026-07-22T00:10:00Z'), offline: false },
      {
        latestAttemptState: {
          mode: 'live',
          timestamp: Date.parse('2026-07-22T00:19:00Z'),
          offline: false,
        },
        requestSymbols: MARKET_SYMBOLS,
      },
    );

    const snapshot = buildAustraliaMarketDeskSnapshot(markets, resources, {
      now: new Date('2026-07-22T00:20:00Z'),
    });

    assert.equal(snapshot.marketGroupStatus.dataMode, 'cached');
    assert.equal(snapshot.marketGroupStatus.latestAttemptMode, 'live');
    assert.ok(snapshot.warnings.includes(
      'Latest Australian equity refresh returned no usable observations; displaying the last usable observations.',
    ));
  });

  it('does not invent a fetch clock when the displayed data state is unavailable', () => {
    const markets = marketQuotes();
    const resources = resourceQuotes();
    markMarketDataState(
      markets,
      { mode: 'unavailable', timestamp: null, offline: false },
      {
        latestAttemptState: { mode: 'unavailable', timestamp: null, offline: false },
        requestSymbols: MARKET_SYMBOLS,
      },
    );
    markMarketDataState(
      resources,
      { mode: 'unavailable', timestamp: null, offline: true },
      {
        latestAttemptState: { mode: 'unavailable', timestamp: null, offline: true },
        requestSymbols: RESOURCE_SYMBOLS,
      },
    );

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
