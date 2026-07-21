import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  buildAustraliaMacroContextModel,
  renderAustraliaMacroContext,
} from '../src/components/australia-macro-context.ts';

const macroPanelSource = readFileSync(
  new URL('../src/components/MacroTilesPanel.ts', import.meta.url),
  'utf8',
);

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
    assert.ok(model.quoteEvidence.flags.includes('missing-freshness-policy'));

    assert.deepEqual(model.marketSymbols, ['^AXJO', 'BHP.AX', 'CBA.AX', 'CSL.AX']);
    assert.ok(model.resourceSymbols.includes('AUDUSD=X'));
    assert.ok(model.resourceSymbols.includes('MTF=F'));
  });

  it('renders explicit session and quote trust language', () => {
    const html = renderAustraliaMacroContext(
      buildAustraliaMacroContextModel(new Date('2026-12-25T01:00:00Z')),
    );

    assert.match(html, /Australia \/ ASX Desk/);
    assert.match(html, /Holiday/);
    assert.match(html, /Christmas Day/);
    assert.match(html, /ASX · official · model-derived/);
    assert.match(html, /Yahoo Finance path/);
    assert.match(html, /not exchange-grade real-time data/);
    assert.match(html, /Retrieval time must not be presented as exchange observation time/);
  });

  it('warns rather than inventing a future calendar state', () => {
    const model = buildAustraliaMacroContextModel(new Date('2027-07-22T00:05:00Z'));

    assert.equal(model.status.session, 'unknown');
    assert.equal(model.status.calendarVerified, false);
    assert.ok(model.warnings.includes('ASX calendar year is not verified.'));
    assert.ok(model.sessionEvidence.flags.includes('low-confidence'));
  });
});

describe('Macro Tiles Australia mission wiring', () => {
  it('adds a mission-scoped Australia tab without removing existing macro tabs', () => {
    assert.match(macroPanelSource, /type Tab = 'au' \| 'us' \| 'eu' \| 'cn'/);
    assert.match(macroPanelSource, /australia-market-watch/);
    assert.match(macroPanelSource, /\['au', \.\.\.base\]/);
    assert.match(macroPanelSource, /buildAustraliaMacroContextModel\(new Date\(\)\)/);
    assert.match(macroPanelSource, /labels: Record<Tab, string> = \{ au: 'Australia', us: 'US', eu: 'Euro Area', cn: 'China' \}/);
  });

  it('bounds the Australia clock refresh and tears it down', () => {
    assert.match(macroPanelSource, /30_000/);
    assert.match(macroPanelSource, /clearInterval\(this\._asxClockTimer\)/);
    assert.match(macroPanelSource, /super\.destroy\(\)/);
  });
});
