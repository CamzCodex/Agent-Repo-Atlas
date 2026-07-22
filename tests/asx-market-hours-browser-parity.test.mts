import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import {
  ASX_MARKET_HOURS_METADATA,
  getAsxCashEquityStatus,
  getAsxCashEquitySession,
  isAsxCashEquityMarketOpen,
  isAsxCashEquityTradingDay,
} from '../src/shared/asx-market-hours.ts';

const require = createRequire(import.meta.url);
const seederModel = require('../scripts/shared/asx-market-hours.cjs') as {
  ASX_MARKET_HOURS_METADATA: typeof ASX_MARKET_HOURS_METADATA;
  getAsxCashEquityStatus: typeof getAsxCashEquityStatus;
  getAsxCashEquitySession: typeof getAsxCashEquitySession;
  isAsxCashEquityMarketOpen: typeof isAsxCashEquityMarketOpen;
  isAsxCashEquityTradingDay: typeof isAsxCashEquityTradingDay;
};

const FIXTURES = [
  ['2026-07-22T00:00:00Z', 'winter regular open'],
  ['2026-01-15T23:30:00Z', 'summer regular open'],
  ['2026-12-25T01:00:00Z', 'official holiday'],
  ['2026-12-24T03:30:00Z', 'official early close'],
  ['2026-07-25T00:00:00Z', 'weekend'],
  ['2027-07-22T00:00:00Z', 'unverified future weekday calendar'],
] as const;

describe('ASX browser/seeder session parity', () => {
  for (const [iso, label] of FIXTURES) {
    it(label, () => {
      const date = new Date(iso);
      assert.deepEqual(getAsxCashEquityStatus(date), seederModel.getAsxCashEquityStatus(date));
      assert.equal(getAsxCashEquitySession(date), seederModel.getAsxCashEquitySession(date));
      assert.equal(isAsxCashEquityMarketOpen(date), seederModel.isAsxCashEquityMarketOpen(date));
      assert.equal(isAsxCashEquityTradingDay(date), seederModel.isAsxCashEquityTradingDay(date));
    });
  }

  it('handles invalid dates identically', () => {
    const invalid = new Date(Number.NaN);
    assert.deepEqual(getAsxCashEquityStatus(invalid), seederModel.getAsxCashEquityStatus(invalid));
    assert.equal(isAsxCashEquityTradingDay(invalid), null);
  });

  it('publishes the same source metadata in both runtime planes', () => {
    assert.deepEqual(ASX_MARKET_HOURS_METADATA, seederModel.ASX_MARKET_HOURS_METADATA);
    assert.deepEqual(ASX_MARKET_HOURS_METADATA.verifiedCalendarYears, [2026]);
    assert.equal(ASX_MARKET_HOURS_METADATA.timeZone, 'Australia/Sydney');
  });
});
