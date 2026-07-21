import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assessFinanceObservationProvenance,
  FINANCE_OBSERVATION_PROVENANCE_VERSION,
  formatFinanceObservationProvenance,
} from '../src/shared/finance-observation-provenance.ts';

const NOW = Date.parse('2026-07-22T06:00:00Z');

describe('assessFinanceObservationProvenance', () => {
  it('assesses a fresh official observation using observed time', () => {
    const assessment = assessFinanceObservationProvenance({
      provider: 'Reserve Bank of Australia',
      sourceClass: 'official',
      sourceUrl: 'https://www.rba.gov.au/statistics/',
      termsUrl: 'https://www.rba.gov.au/copyright/',
      observedAt: '2026-07-22T05:55:00Z',
      fetchedAt: '2026-07-22T05:56:00Z',
      maxAgeMs: 15 * 60 * 1000,
      transformation: { kind: 'normalized', version: 'rba-normalizer-v1' },
      confidence: 1,
    }, NOW);

    assert.equal(assessment.schemaVersion, FINANCE_OBSERVATION_PROVENANCE_VERSION);
    assert.equal(assessment.freshness, 'fresh');
    assert.equal(assessment.freshnessBasis, 'observed-at');
    assert.equal(assessment.ageMs, 5 * 60 * 1000);
    assert.equal(assessment.confidence, 1);
    assert.deepEqual(assessment.flags, []);
    assert.equal(
      formatFinanceObservationProvenance(assessment),
      'Reserve Bank of Australia · official · normalized · fresh · 5m old',
    );
  });

  it('falls back to fetched time without falsely claiming an observed timestamp', () => {
    const assessment = assessFinanceObservationProvenance({
      provider: 'Finnhub',
      sourceClass: 'licensed',
      sourceUrl: 'https://finnhub.io/',
      fetchedAt: NOW - 30_000,
      maxAgeMs: 60_000,
      transformation: { kind: 'none' },
    }, NOW);

    assert.equal(assessment.freshness, 'fresh');
    assert.equal(assessment.freshnessBasis, 'fetched-at');
    assert.equal(assessment.ageMs, 30_000);
    assert.deepEqual(assessment.flags, ['missing-observed-at']);
    assert.match(formatFinanceObservationProvenance(assessment), /fresh · <1m old$/);
  });

  it('marks a stale observation against its explicit policy', () => {
    const assessment = assessFinanceObservationProvenance({
      provider: 'FRED',
      sourceClass: 'official',
      sourceUrl: 'https://fred.stlouisfed.org/',
      observedAt: NOW - 25 * 60 * 60 * 1000,
      fetchedAt: NOW - 60_000,
      maxAgeMs: 24 * 60 * 60 * 1000,
      transformation: { kind: 'normalized' },
    }, NOW);

    assert.equal(assessment.freshness, 'stale');
    assert.equal(assessment.freshnessBasis, 'observed-at');
    assert.ok(assessment.flags.includes('stale-observation'));
    assert.match(formatFinanceObservationProvenance(assessment), /stale · 25h old$/);
  });

  it('distinguishes estimated values from their access method', () => {
    const assessment = assessFinanceObservationProvenance({
      provider: 'World Monitor ETF-flow proxy',
      sourceClass: 'public-api',
      sourceUrl: 'https://example.invalid/source',
      observedAt: NOW - 5 * 60 * 1000,
      fetchedAt: NOW - 4 * 60 * 1000,
      maxAgeMs: 30 * 60 * 1000,
      transformation: {
        kind: 'estimated',
        description: 'Volume × direction × documented multiplier',
        version: 'flow-estimate-v1',
      },
      confidence: 0.7,
    }, NOW);

    assert.equal(assessment.sourceClass, 'public-api');
    assert.equal(assessment.transformationKind, 'estimated');
    assert.ok(assessment.flags.includes('estimated-value'));
    assert.ok(!assessment.flags.includes('unverified-access-method'));
  });

  it('flags undocumented access and AI-derived interpretation separately', () => {
    const assessment = assessFinanceObservationProvenance({
      provider: 'Yahoo chart endpoint',
      sourceClass: 'undocumented',
      sourceUrl: 'https://query1.finance.yahoo.com/',
      observedAt: NOW - 60_000,
      fetchedAt: NOW,
      maxAgeMs: 5 * 60 * 1000,
      transformation: { kind: 'ai-derived', version: 'market-implication-v1' },
      confidence: 0.4,
    }, NOW);

    assert.ok(assessment.flags.includes('unverified-access-method'));
    assert.ok(assessment.flags.includes('ai-derived-value'));
    assert.ok(assessment.flags.includes('low-confidence'));
    assert.equal(assessment.freshness, 'fresh');
  });

  it('detects timestamps beyond the allowed future skew', () => {
    const assessment = assessFinanceObservationProvenance({
      provider: 'Clock-skewed feed',
      sourceClass: 'public-api',
      sourceUrl: 'https://example.invalid/feed',
      observedAt: NOW + 6 * 60 * 1000,
      fetchedAt: NOW,
      maxAgeMs: 60 * 60 * 1000,
      futureToleranceMs: 5 * 60 * 1000,
      transformation: { kind: 'none' },
    }, NOW);

    assert.equal(assessment.freshness, 'future');
    assert.equal(assessment.ageMs, -6 * 60 * 1000);
    assert.ok(assessment.flags.includes('future-timestamp'));
    assert.match(formatFinanceObservationProvenance(assessment), /future · 6m ahead$/);
  });

  it('does not call data fresh when no max-age policy exists', () => {
    const assessment = assessFinanceObservationProvenance({
      provider: 'BIS public file',
      sourceClass: 'public-file',
      sourceUrl: 'https://www.bis.org/statistics/',
      observedAt: NOW - 24 * 60 * 60 * 1000,
      fetchedAt: NOW,
      transformation: { kind: 'normalized' },
    }, NOW);

    assert.equal(assessment.freshness, 'unknown');
    assert.ok(assessment.flags.includes('missing-freshness-policy'));
  });

  it('survives malformed evidence and returns explicit flags', () => {
    const assessment = assessFinanceObservationProvenance({
      provider: '   ',
      sourceClass: 'unknown',
      observedAt: 'not-a-date',
      fetchedAt: 'also-not-a-date',
      maxAgeMs: -1,
      futureToleranceMs: -1,
      confidence: 2,
      transformation: { kind: 'unknown' },
      notes: ['  first note  ', '', 'second note'],
    }, NOW);

    assert.equal(assessment.provider, 'Unknown provider');
    assert.equal(assessment.freshness, 'invalid');
    assert.equal(assessment.freshnessBasis, 'none');
    assert.equal(assessment.confidence, null);
    assert.deepEqual(assessment.notes, ['first note', 'second note']);
    for (const flag of [
      'unknown-provider',
      'unknown-source-class',
      'missing-source-url',
      'invalid-observed-at',
      'invalid-fetched-at',
      'invalid-confidence',
    ] as const) {
      assert.ok(assessment.flags.includes(flag), `missing ${flag}`);
    }
  });

  it('handles a completely absent evidence bundle without throwing', () => {
    const assessment = assessFinanceObservationProvenance(undefined, NOW);
    assert.equal(assessment.provider, 'Unknown provider');
    assert.equal(assessment.freshness, 'unknown');
    assert.equal(assessment.ageMs, null);
    assert.ok(assessment.flags.includes('unknown-provider'));
    assert.ok(assessment.flags.includes('missing-observed-at'));
    assert.ok(assessment.flags.includes('missing-freshness-policy'));
  });
});
