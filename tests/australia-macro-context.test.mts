import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import type { MarketData } from '../src/types/index.ts';
import {
  buildAustraliaMacroContextModel,
  renderAustraliaMacroContext,
} from '../src/components/australia-macro-context.ts';
import { buildAustraliaMarketDeskSnapshot } from '../src/services/australia-market-desk.ts';

const macroPanelSource = readFileSync(
  new URL('../src/components/MacroTilesPanel.ts', import.meta.url),
  'utf8',
);

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

describe('Australia macro context model', () => {
  it('shows an official regular ASX session separately from the quote path', () => {
    const model = buildAustraliaMacroContextModel(new Date('2026-07-22T00:05:00Z'));

    assert.equal(model.status.phase, 'regular');
    assert.equal(model.status.session, 'regular');
    assert.equal(model.status.calendarVerified, true);
    assert.equal(model.sessionEvidence.sourceClass, 'official');
    assert.equal(model.sessionEvidence.transformationKind, 'deterministic-model');
    assert.equal(model.sessionEvidence.freshness, 'fresh');

    assert.equal(model.quoteEvidence.sourceClass, 'undocumented');
    assert.equal(model.quoteEvidence.transformationKind, 'normalized');
    assert.equal(model.quoteEvidence.freshness, 'unknown');
    assert.ok(model.quoteEvidence.flags.includes('unverified-access-method'));
    assert.ok(model.quoteEvidence.flags.includes('missing-observed-at'));

    assert.deepEqual(model.marketSymbols, ['^AXJO', 'BHP.AX', 'CBA.AX', 'CSL.AX']);
    assert.ok(model.resourceSymbols.includes('AUDUSD=X'));
    assert.ok(model.resourceSymbols.includes('MTF=F'));
  });

  it('renders live cards while preserving source and timing warnings', () => {
    const now = new Date('2026-07-22T00:05:00Z');
    const snapshot = buildAustraliaMarketDeskSnapshot(
      [
        quote('^AXJO', 8900.25, 0.4),
        quote('BHP.AX', 46.2, -0.2),
        quote('CBA.AX', 178.1, 0.1),
        quote('CSL.AX', 116.3, 1.2),
      ],
      [
        quote('AUDUSD=X', 0.66, 0.2),
        quote('HG=F', 5.1, -0.1),
        quote('GC=F', 3100, 0.3),
        quote('MTF=F', 124, -0.4),
        quote('BZ=F', 74, 0.5),
        quote('CL=F', 70, 0.4),
        quote('NG=F', 3.3, -0.8),
      ],
      { now, fetchedAt: '2026-07-22T00:00:00Z' },
    );
    const html = renderAustraliaMacroContext(
      buildAustraliaMacroContextModel(now, snapshot),
      snapshot,
    );

    assert.match(html, /Australia \/ ASX Desk/);
    assert.match(html, /Australian equities/);
    assert.match(html, /AUD and resource transmission/);
    assert.match(html, /S&amp;P\/ASX 200/);
    assert.match(html, /8,900\.25/);
    assert.match(html, /BHP Group/);
    assert.match(html, /0\.6600/);
    assert.match(html, /ASX · official · model-derived/);
    assert.match(html, /Yahoo Finance path/);
    assert.match(html, /Missing Observed At/);
    assert.match(html, /not exchange-grade real-time data/);
    assert.match(html, /Retrieval time must not be presented as exchange observation time/);
    assert.match(html, /data-australia-context-export/);
    assert.match(html, /Copy context JSON/);
  });

  it('renders official holiday context even before quote data arrives', () => {
    const html = renderAustraliaMacroContext(
      buildAustraliaMacroContextModel(new Date('2026-12-25T01:00:00Z')),
    );

    assert.match(html, /Holiday/);
    assert.match(html, /Christmas Day/);
    assert.match(html, /\^AXJO/);
    assert.match(html, /AUDUSD=X/);
    assert.doesNotMatch(html, /data-australia-context-export/);
  });

  it('warns rather than inventing a future calendar state', () => {
    const model = buildAustraliaMacroContextModel(new Date('2027-07-22T00:05:00Z'));

    assert.equal(model.status.session, 'unknown');
    assert.equal(model.status.calendarVerified, false);
    assert.ok(model.warnings.includes('ASX calendar year is unverified.'));
    assert.ok(model.sessionEvidence.flags.includes('low-confidence'));
  });
});

describe('Macro Tiles Australia mission wiring', () => {
  it('adds a mission-scoped Australia tab without removing existing macro tabs', () => {
    assert.match(macroPanelSource, /type Tab = 'au' \| 'us' \| 'eu' \| 'cn'/);
    assert.match(macroPanelSource, /australia-market-watch/);
    assert.match(macroPanelSource, /\['au', \.\.\.base\]/);
    assert.match(macroPanelSource, /buildAustraliaMacroContextModel\(now, snapshot\)/);
    assert.match(macroPanelSource, /labels: Record<Tab, string> = \{ au: 'Australia', us: 'US', eu: 'Euro Area', cn: 'China' \}/);
  });

  it('loads stock and commodity cards through the existing circuit-breaker services', () => {
    assert.match(macroPanelSource, /fetchMultipleStocks\(marketDefinitions\)/);
    assert.match(macroPanelSource, /fetchCommodityQuotes\(resourceDefinitions\)/);
    assert.match(macroPanelSource, /buildAustraliaMarketDeskSnapshot/);
    assert.match(macroPanelSource, /this\._australiaFetchedAt = new Date\(\)/);
  });

  it('copies a typed read-only context envelope rather than scraping panel HTML', () => {
    assert.match(macroPanelSource, /buildAustraliaMarketContextExport\(this\._buildAustraliaSnapshot\(now\)\)/);
    assert.match(macroPanelSource, /serializeAustraliaMarketContextExport\(context\)/);
    assert.match(macroPanelSource, /navigator\.clipboard\?\.writeText\(text\)/);
    assert.match(macroPanelSource, /data-australia-context-export/);
  });

  it('bounds timers and tears them down', () => {
    assert.match(macroPanelSource, /30_000/);
    assert.match(macroPanelSource, /1_500/);
    assert.match(macroPanelSource, /clearInterval\(this\._asxClockTimer\)/);
    assert.match(macroPanelSource, /clearTimeout\(this\._copyFeedbackTimer\)/);
    assert.match(macroPanelSource, /super\.destroy\(\)/);
  });
});
