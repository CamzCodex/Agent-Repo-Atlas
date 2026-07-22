import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import type { MarketData, PanelConfig } from '../src/types/index.ts';
import {
  ALL_PANELS,
  DEFAULT_MAP_LAYERS,
} from '../src/config/panels.ts';
import {
  applyMissionPresetToState,
  getMissionPreset,
} from '../src/services/mission-presets.ts';
import {
  AUSTRALIA_DESK_BASKET_LIMITATION,
  AUSTRALIA_DESK_MARKET_SYMBOLS,
  AUSTRALIA_DESK_RESOURCE_SYMBOLS,
  buildAustraliaMarketDeskSnapshot,
} from '../src/services/australia-market-desk.ts';

interface StocksConfig {
  symbols: Array<{ symbol: string; name: string; display: string }>;
  yahooOnly: string[];
}

interface CommoditiesConfig {
  commodities: Array<{ symbol: string; name: string; display: string }>;
}

const stocks = JSON.parse(readFileSync(new URL('../shared/stocks.json', import.meta.url), 'utf8')) as StocksConfig;
const commodities = JSON.parse(readFileSync(new URL('../shared/commodities.json', import.meta.url), 'utf8')) as CommoditiesConfig;

function currentPanelSettings(): Record<string, PanelConfig> {
  return Object.fromEntries(
    Object.entries(ALL_PANELS).map(([key, config]) => [key, { ...config }]),
  );
}

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

const marketQuotes = [
  quote('^AXJO', 8900, 0.4),
  quote('BHP.AX', 46.2, -0.2),
  quote('CBA.AX', 178.1, 0.1),
  quote('CSL.AX', 116.3, 1.2),
];

const commodityQuotes = [
  quote('AUDUSD=X', 0.66, 0.2),
  quote('HG=F', 5.1, -0.1),
  quote('GC=F', 3100, 0.3),
  quote('MTF=F', 124, -0.4),
  quote('BZ=F', 74, 0.5),
  quote('CL=F', 70, 0.4),
  quote('NG=F', 3.3, -0.8),
];

describe('Australia / ASX mission preset', () => {
  it('centres the map on Oceania and selects the finance-in-context workspace', () => {
    const preset = getMissionPreset('australia-market-watch');
    assert.ok(preset);
    assert.equal(preset.label, 'Australia / ASX Desk');
    assert.equal(preset.view, 'oceania');
    assert.equal(preset.timeRange, '7d');
    assert.ok(preset.panels.includes('markets'));
    assert.ok(preset.panels.includes('commodities'));
    assert.ok(preset.panels.includes('macro-tiles'));
    assert.ok(preset.panels.includes('supply-chain'));

    const applied = applyMissionPresetToState(
      'australia-market-watch',
      currentPanelSettings(),
      DEFAULT_MAP_LAYERS,
      'finance',
    );

    for (const panel of [
      'markets',
      'commodities',
      'macro-tiles',
      'economic-calendar',
      'centralbanks',
      'supply-chain',
      'energy-complex',
      'gold-intelligence',
    ]) {
      assert.equal(applied.panelSettings[panel]?.enabled, true, `${panel} should be enabled`);
      assert.ok(applied.panelOrder.includes(panel), `${panel} should be ordered`);
    }

    assert.equal(applied.mapLayers.stockExchanges, true);
    assert.equal(applied.mapLayers.centralBanks, true);
    assert.equal(applied.mapLayers.commodityHubs, true);
    assert.equal(applied.mapLayers.tradeRoutes, true);
    assert.equal(applied.mapLayers.waterways, true);
  });
});

describe('Australia desk seeded universe', () => {
  it('keeps the ASX index and bellwethers in the market seed basket', () => {
    const configured = new Set(stocks.symbols.map((entry) => entry.symbol));
    const yahooOnly = new Set(stocks.yahooOnly);

    assert.deepEqual(AUSTRALIA_DESK_MARKET_SYMBOLS, ['^AXJO', 'BHP.AX', 'CBA.AX', 'CSL.AX']);
    for (const symbol of AUSTRALIA_DESK_MARKET_SYMBOLS) {
      assert.ok(configured.has(symbol), `${symbol} must be configured`);
      assert.ok(yahooOnly.has(symbol), `${symbol} must use the existing Yahoo-only path`);
    }
  });

  it('covers AUD and resource transmission channels in commodity quotes', () => {
    const configured = new Set(commodities.commodities.map((entry) => entry.symbol));
    for (const symbol of AUSTRALIA_DESK_RESOURCE_SYMBOLS) {
      assert.ok(configured.has(symbol), `${symbol} must be configured`);
    }
  });
});

describe('Australia market desk evidence model', () => {
  it('separates model evaluation from ASX source verification and quote access', () => {
    const snapshot = buildAustraliaMarketDeskSnapshot(marketQuotes, commodityQuotes, {
      now: new Date('2026-07-22T00:05:00Z'),
      fetchedAt: '2026-07-22T00:00:00Z',
    });

    assert.equal(snapshot.asxSourceCheckedAt, '2026-07-22');
    assert.equal(snapshot.asxSourceReviewAgeMs, 5 * 60 * 1000);
    assert.equal(snapshot.asxSourceReviewStatus, 'current');
    assert.equal(snapshot.asxStatus.phase, 'regular');
    assert.equal(snapshot.asxStatus.calendarVerified, true);
    assert.equal(snapshot.asxStatusProvenance.sourceClass, 'official');
    assert.equal(snapshot.asxStatusProvenance.transformationKind, 'deterministic-model');
    assert.equal(snapshot.asxStatusProvenance.freshness, 'fresh');
    assert.equal(snapshot.asxStatusProvenance.freshnessBasis, 'observed-at');
    assert.equal(snapshot.asxStatusProvenance.observedAtMs, Date.parse('2026-07-22T00:05:00Z'));
    assert.equal(snapshot.asxStatusProvenance.fetchedAtMs, null);
    assert.equal(snapshot.asxStatusProvenance.termsUrl, null);

    assert.deepEqual(snapshot.marketGroupStatus, {
      dataMode: 'unknown',
      dataOffline: false,
      latestAttemptMode: 'unknown',
      latestAttemptOffline: false,
    });
    assert.equal(snapshot.markets.length, AUSTRALIA_DESK_MARKET_SYMBOLS.length);
    assert.equal(snapshot.resources.length, AUSTRALIA_DESK_RESOURCE_SYMBOLS.length);
    assert.deepEqual(snapshot.missingSymbols, []);

    const asxQuote = snapshot.markets[0];
    assert.equal(asxQuote?.symbol, '^AXJO');
    assert.equal(asxQuote?.dataMode, 'unknown');
    assert.equal(asxQuote?.latestAttemptMode, 'unknown');
    assert.equal(asxQuote?.provenance.sourceClass, 'undocumented');
    assert.equal(asxQuote?.provenance.freshness, 'fresh');
    assert.equal(asxQuote?.provenance.freshnessBasis, 'fetched-at');
    assert.ok(asxQuote?.provenance.flags.includes('unverified-access-method'));
    assert.ok(asxQuote?.provenance.flags.includes('missing-observed-at'));
    assert.ok(asxQuote?.provenance.notes.some((note) => note.includes('not a calibrated probability')));
    assert.ok(snapshot.warnings.includes(AUSTRALIA_DESK_BASKET_LIMITATION));
    assert.ok(snapshot.warnings.includes('Market observations use an undocumented upstream access path.'));
    assert.ok(snapshot.warnings.includes('Quote observation time is unavailable; retrieval time is not exchange time.'));
  });

  it('fails visibly when a symbol is missing or retrieval age is stale', () => {
    const snapshot = buildAustraliaMarketDeskSnapshot(
      marketQuotes.filter((entry) => entry.symbol !== 'CSL.AX'),
      commodityQuotes,
      {
        now: new Date('2026-07-22T00:45:00Z'),
        fetchedAt: '2026-07-22T00:00:00Z',
        quoteMaxAgeMs: 15 * 60 * 1000,
      },
    );

    assert.ok(snapshot.missingSymbols.includes('CSL.AX'));
    assert.equal(snapshot.markets.find((entry) => entry.symbol === 'CSL.AX')?.quote, null);
    assert.ok(snapshot.markets.every((entry) => entry.provenance.freshness === 'stale'));
    assert.ok(snapshot.resources.every((entry) => entry.provenance.freshness === 'stale'));
    assert.ok(snapshot.warnings.some((warning) => warning.includes('unavailable or invalid')));
    assert.ok(snapshot.warnings.includes('Australian equity observations are stale.'));
    assert.ok(snapshot.warnings.includes('AUD/resource observations are stale.'));
  });

  it('keeps equity and resource freshness independent after a partial refresh', () => {
    const snapshot = buildAustraliaMarketDeskSnapshot(marketQuotes, commodityQuotes, {
      now: new Date('2026-07-22T00:20:00Z'),
      marketFetchedAt: '2026-07-22T00:19:00Z',
      resourceFetchedAt: '2026-07-21T23:30:00Z',
      quoteMaxAgeMs: 15 * 60 * 1000,
    });

    assert.ok(snapshot.markets.every((entry) => entry.provenance.freshness === 'fresh'));
    assert.ok(snapshot.resources.every((entry) => entry.provenance.freshness === 'stale'));
    assert.equal(snapshot.markets[0]?.provenance.fetchedAtMs, Date.parse('2026-07-22T00:19:00Z'));
    assert.equal(snapshot.resources[0]?.provenance.fetchedAtMs, Date.parse('2026-07-21T23:30:00Z'));
    assert.equal(snapshot.warnings.includes('Australian equity observations are stale.'), false);
    assert.ok(snapshot.warnings.includes('AUD/resource observations are stale.'));
  });

  it('distinguishes displayed last-good data from an unavailable latest refresh', () => {
    const snapshot = buildAustraliaMarketDeskSnapshot(marketQuotes, commodityQuotes, {
      now: new Date('2026-07-22T00:20:00Z'),
      marketDataState: {
        mode: 'cached',
        timestamp: Date.parse('2026-07-22T00:10:00Z'),
        offline: false,
      },
      marketLatestAttemptState: { mode: 'unavailable', timestamp: null, offline: false },
      resourceDataState: {
        mode: 'live',
        timestamp: Date.parse('2026-07-22T00:19:00Z'),
        offline: false,
      },
      resourceLatestAttemptState: {
        mode: 'live',
        timestamp: Date.parse('2026-07-22T00:19:00Z'),
        offline: false,
      },
    });

    assert.deepEqual(snapshot.marketGroupStatus, {
      dataMode: 'cached',
      dataOffline: false,
      latestAttemptMode: 'unavailable',
      latestAttemptOffline: false,
    });
    assert.equal(snapshot.markets[0]?.dataMode, 'cached');
    assert.equal(snapshot.markets[0]?.latestAttemptMode, 'unavailable');
    assert.equal(snapshot.markets[0]?.provenance.fetchedAtMs, Date.parse('2026-07-22T00:10:00Z'));
    assert.ok(snapshot.warnings.includes('Australian equity observations are being served from cache.'));
    assert.ok(snapshot.warnings.includes(
      'Latest Australian equity refresh is unavailable; displaying the last usable observations.',
    ));
  });

  it('prefers a later valid duplicate and bounds normalized sparklines', () => {
    const oversizedSparkline = Array.from({ length: 400 }, (_, index) => index + 1);
    const snapshot = buildAustraliaMarketDeskSnapshot(
      [
        quote('^AXJO', 0, 0),
        { ...quote(' ^AXJO ', 8901, 0.5), sparkline: [-1, 0, Number.NaN, ...oversizedSparkline] },
        ...marketQuotes.slice(1),
      ],
      commodityQuotes,
      {
        now: new Date('2026-07-22T00:05:00Z'),
        fetchedAt: '2026-07-22T00:00:00Z',
      },
    );

    const asx = snapshot.markets[0];
    assert.equal(asx?.quote?.symbol, '^AXJO');
    assert.equal(asx?.quote?.price, 8901);
    assert.equal(asx?.quote?.sparkline?.length, 256);
    assert.equal(asx?.quote?.sparkline?.[0], 145);
    assert.equal(asx?.quote?.sparkline?.at(-1), 400);
    assert.equal(snapshot.missingSymbols.includes('^AXJO'), false);
  });

  it('rejects zero, negative, and invalid prices instead of exposing false availability', () => {
    const snapshot = buildAustraliaMarketDeskSnapshot(
      [
        quote('^AXJO', 0, 0),
        quote('BHP.AX', -1, 1),
        { ...quote('CBA.AX', 178.1, 0.1), price: Number.NaN },
        quote('CSL.AX', 116.3, 1.2),
      ],
      commodityQuotes,
      {
        now: new Date('2026-07-22T00:05:00Z'),
        marketFetchedAt: '2026-07-22T00:00:00Z',
        resourceFetchedAt: '2026-07-22T00:00:00Z',
      },
    );

    assert.deepEqual(snapshot.missingSymbols.slice(0, 3), ['^AXJO', 'BHP.AX', 'CBA.AX']);
    assert.equal(snapshot.markets[0]?.quote, null);
    assert.equal(snapshot.markets[1]?.quote, null);
    assert.equal(snapshot.markets[2]?.quote, null);
    assert.ok(snapshot.warnings.some((warning) => warning.includes('unavailable or invalid')));
  });

  it('returns unknown rather than inventing an unverified future ASX calendar', () => {
    const snapshot = buildAustraliaMarketDeskSnapshot([], [], {
      now: new Date('2027-07-22T00:05:00Z'),
      fetchedAt: '2027-07-22T00:00:00Z',
    });

    assert.equal(snapshot.asxStatus.session, 'unknown');
    assert.equal(snapshot.asxStatus.calendarVerified, false);
    assert.equal(snapshot.asxSourceReviewStatus, 'overdue');
    assert.ok((snapshot.asxSourceReviewAgeMs ?? 0) > 90 * 24 * 60 * 60 * 1000);
    assert.ok(snapshot.warnings.includes('ASX calendar year is unverified.'));
    assert.ok(snapshot.warnings.includes('ASX trading-hours/calendar sources are past the 90-day review interval.'));
    assert.ok(snapshot.asxStatusProvenance.flags.includes('low-confidence'));
  });
});
