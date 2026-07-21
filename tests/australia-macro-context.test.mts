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

describe('Australia macro context model', () => {
  it('shows an official regular ASX session separately from both quote groups', () => {
    const model = buildAustraliaMacroContextModel(new Date('2026-07-22T00:05:00Z'));

    assert.equal(model.status.phase, 'regular');
    assert.equal(model.status.session, 'regular');
    assert.equal(model.status.calendarVerified, true);
    assert.equal(model.sessionEvidence.sourceClass, 'official');
    assert.equal(model.sessionEvidence.transformationKind, 'deterministic-model');
    assert.equal(model.sessionEvidence.freshness, 'fresh');
    assert.equal(model.sessionEvidence.freshnessBasis, 'observed-at');
    assert.equal(model.sessionEvidence.fetchedAtMs, null);

    assert.equal(model.marketEvidence.sourceClass, 'undocumented');
    assert.equal(model.resourceEvidence.sourceClass, 'undocumented');
    assert.equal(model.marketEvidence.transformationKind, 'normalized');
    assert.equal(model.resourceEvidence.transformationKind, 'normalized');
    assert.equal(model.marketEvidence.freshness, 'unknown');
    assert.equal(model.resourceEvidence.freshness, 'unknown');
    assert.ok(model.marketEvidence.flags.includes('unverified-access-method'));
    assert.ok(model.resourceEvidence.flags.includes('missing-observed-at'));
    assert.equal(model.quoteEvidence, model.marketEvidence);

    assert.deepEqual(model.marketSymbols, ['^AXJO', 'BHP.AX', 'CBA.AX', 'CSL.AX']);
    assert.ok(model.resourceSymbols.includes('AUDUSD=X'));
    assert.ok(model.resourceSymbols.includes('MTF=F'));
  });

  it('renders live cards while preserving source, timing, and basket warnings', () => {
    const now = new Date('2026-07-22T00:05:00Z');
    const snapshot = buildAustraliaMarketDeskSnapshot(
      markets,
      resources,
      { now, fetchedAt: '2026-07-22T00:00:00Z' },
    );
    const html = renderAustraliaMacroContext(
      buildAustraliaMacroContextModel(now, snapshot),
      snapshot,
    );

    assert.match(html, /Australia \/ ASX Desk/);
    assert.match(html, /ASX benchmark &amp; bellwethers/);
    assert.match(html, /AUD and resource transmission/);
    assert.match(html, /S&amp;P\/ASX 200/);
    assert.match(html, /8,900\.25/);
    assert.match(html, /BHP Group/);
    assert.match(html, /0\.6600/);
    assert.match(html, /ASX · official · model-derived/);
    assert.match(html, /Yahoo Finance path/);
    assert.match(html, /Fetch\/cache clock/);
    assert.match(html, /Missing Observed At/);
    assert.match(html, /ASX basket/);
    assert.match(html, /AUD\/resources/);
    assert.match(html, /not exchange-grade real-time data/);
    assert.match(html, /Retrieval\/cache time must not be presented as exchange observation time/);
    assert.match(html, /not ASX market breadth/);
    assert.match(html, /data-australia-context-export/);
    assert.match(html, /Copy context JSON/);
  });

  it('does not let a fresh equity group visually mask stale resources', () => {
    const now = new Date('2026-07-22T00:20:00Z');
    const snapshot = buildAustraliaMarketDeskSnapshot(markets, resources, {
      now,
      marketFetchedAt: '2026-07-22T00:19:00Z',
      resourceFetchedAt: '2026-07-21T23:30:00Z',
      quoteMaxAgeMs: 15 * 60 * 1000,
    });
    const model = buildAustraliaMacroContextModel(now, snapshot);
    const html = renderAustraliaMacroContext(model, snapshot);

    assert.equal(model.marketEvidence.freshness, 'fresh');
    assert.equal(model.resourceEvidence.freshness, 'stale');
    assert.match(model.marketEvidenceLabel, /fresh/);
    assert.match(model.resourceEvidenceLabel, /stale/);
    assert.match(html, /ASX basket[\s\S]*fresh/);
    assert.match(html, /AUD\/resources[\s\S]*stale/);
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
    assert.match(macroPanelSource, /this\._australiaMarketFetchedAt = fetchedAt/);
    assert.match(macroPanelSource, /this\._australiaResourceFetchedAt = fetchedAt/);
    assert.match(macroPanelSource, /marketFetchedAt: this\._australiaMarketFetchedAt/);
    assert.match(macroPanelSource, /resourceFetchedAt: this\._australiaResourceFetchedAt/);
  });

  it('copies a typed read-only context envelope rather than scraping panel HTML', () => {
    assert.match(macroPanelSource, /buildAustraliaMarketContextExport\(this\._buildAustraliaSnapshot\(now\)\)/);
    assert.match(macroPanelSource, /serializeAustraliaMarketContextExport\(context\)/);
    assert.match(macroPanelSource, /navigator\.clipboard\?\.writeText/);
    assert.match(macroPanelSource, /navigator\.clipboard\.writeText\(text\)/);
    assert.match(macroPanelSource, /finally \{\s*textarea\.remove\(\)/);
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
