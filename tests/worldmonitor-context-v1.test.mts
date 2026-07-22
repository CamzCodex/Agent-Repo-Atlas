import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { MarketData } from '../src/types/index.ts';
import { buildAustraliaMarketDeskSnapshot } from '../src/services/australia-market-desk.ts';
import { buildAustraliaMarketContextExport } from '../src/services/australia-market-context-export.ts';
import {
  WORLD_MONITOR_CONTEXT_V1_SCHEMA_VERSION,
  buildWorldMonitorContextV1,
  serializeWorldMonitorContextV1,
} from '../src/services/worldmonitor-context-v1.ts';
import {
  markMarketDataState,
  resetMarketDataStateForTests,
} from '../src/services/market-data-state.ts';

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

function sourceExport() {
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
  markMarketDataState(
    markets,
    { mode: 'live', timestamp: Date.parse('2026-07-22T00:00:00Z'), offline: false },
    {
      latestAttemptState: {
        mode: 'live',
        timestamp: Date.parse('2026-07-22T00:00:00Z'),
        offline: false,
      },
      requestSymbols: markets.map((item) => item.symbol),
    },
  );
  markMarketDataState(
    resources,
    { mode: 'cached', timestamp: Date.parse('2026-07-21T23:59:00Z'), offline: false },
    {
      latestAttemptState: { mode: 'unavailable', timestamp: null, offline: false },
      requestSymbols: resources.map((item) => item.symbol),
    },
  );
  return buildAustraliaMarketContextExport(
    buildAustraliaMarketDeskSnapshot(markets, resources, {
      now: new Date('2026-07-22T00:05:00Z'),
    }),
  );
}

const options = {
  version: 'camz-test',
  commit: '7cc3ac5fd4bad6347fb5123fb4a1b76cf480f895',
  environmentClass: 'test' as const,
  payloadId: 'wm-au-test-001',
};

describe('World Monitor neutral context v1 exporter', () => {
  beforeEach(() => resetMarketDataStateForTests());

  it('exports the official deterministic ASX session while excluding timing-uncertain quotes', () => {
    const context = buildWorldMonitorContextV1(sourceExport(), options);

    assert.equal(context.schemaVersion, WORLD_MONITOR_CONTEXT_V1_SCHEMA_VERSION);
    assert.equal(context.purpose, 'read-only-research-context');
    assert.equal(context.controls.readOnly, true);
    assert.equal(context.controls.noRecommendation, true);
    assert.equal(context.controls.noOrder, true);
    assert.equal(context.controls.noBroker, true);
    assert.equal(context.rightsSummary.exportDecision, 'internal-research-allowed');
    assert.equal(context.rightsSummary.blockedRecordCount, 0);
    assert.equal(context.events.length, 1);
    assert.equal(context.events[0]?.eventType, 'market-session');
    assert.deepEqual(
      context.observations.map((item) => item.measureId),
      ['market.session-open', 'market.early-close', 'market.calendar-verified'],
    );
    assert.equal(context.observations.some((item) => item.measureId.endsWith('-price')), false);
    assert.ok(context.warnings.some((warning) => warning.includes('11 quote observations were excluded')));
  });

  it('admits a fresh critical quote only when an actual observation time is present', () => {
    const source = sourceExport();
    const bhp = source.observations.find((item) => item.symbol === 'BHP.AX');
    assert.ok(bhp);
    bhp.evidence.observedAt = '2026-07-22T00:04:30.000Z';
    bhp.evidence.freshness = 'fresh';
    bhp.evidence.freshnessBasis = 'observed-at';
    bhp.evidence.flags = bhp.evidence.flags.filter((flag) => flag !== 'missing-observed-at');

    const context = buildWorldMonitorContextV1(source, options);
    const price = context.observations.find((item) => item.instrumentIds.includes('BHP.AX'));
    assert.ok(price);
    assert.equal(price.value, 46.2);
    assert.equal(price.criticality, 'critical');
    assert.equal(price.observationTime, '2026-07-22T00:04:30.000Z');
    assert.equal(price.sourceClass, 'undocumented');
    assert.equal(price.rights.exportPermission, 'internal-research-allowed');
  });

  it('serializes deterministically and never emits recommendation or execution fields', () => {
    const context = buildWorldMonitorContextV1(sourceExport(), options);
    const first = serializeWorldMonitorContextV1(context);
    const second = serializeWorldMonitorContextV1(context);
    assert.equal(first, second);
    assert.equal(first.endsWith('\n'), true);
    assert.deepEqual(JSON.parse(first), context);
    for (const forbidden of [
      'tradeRecommendation',
      'targetPrice',
      'positionSize',
      'orderInstruction',
      'brokerAction',
    ]) {
      assert.equal(first.includes(forbidden), false);
    }
  });

  it('requires an auditable producer commit', () => {
    assert.throws(
      () => buildWorldMonitorContextV1(sourceExport(), { ...options, commit: 'bad commit' }),
      /producer commit/,
    );
  });
});

