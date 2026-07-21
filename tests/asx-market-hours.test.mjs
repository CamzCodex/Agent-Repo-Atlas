import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ASX_MARKET_HOURS_METADATA,
  getAsxCashEquitySession,
  getAsxCashEquityStatus,
  isAsxCashEquityMarketOpen,
  isAsxCashEquityTradingDay,
} from '../scripts/shared/asx-market-hours.cjs';

function localClock(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-AU', {
      timeZone,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.hour}:${parts.minute}`;
}

// Explicit UTC instants only. Sydney is UTC+10 in July 2026 and UTC+11 in
// January 2026. Adelaide is always 30 minutes behind Sydney in these fixtures.
const ORDINARY_DAY_FIXTURES = [
  ['2026-07-21T20:59:59Z', 'closed', 'closed', '06:59:59 Sydney — before pre-open'],
  ['2026-07-21T21:00:00Z', 'pre-open', 'pre', '07:00:00 Sydney — pre-open begins'],
  ['2026-07-21T23:58:59Z', 'pre-open', 'pre', '09:58:59 Sydney — still pre-open'],
  ['2026-07-21T23:59:00Z', 'opening-auction', 'pre', '09:59:00 Sydney — opening auction'],
  ['2026-07-22T00:00:00Z', 'regular', 'regular', '10:00:00 Sydney — conservative regular open'],
  ['2026-07-22T05:59:59Z', 'regular', 'regular', '15:59:59 Sydney — regular'],
  ['2026-07-22T06:00:00Z', 'pre-close', 'post', '16:00:00 Sydney — Pre-CSPA'],
  ['2026-07-22T06:10:00Z', 'closing-auction', 'post', '16:10:00 Sydney — CSPA'],
  ['2026-07-22T06:11:00Z', 'post-close', 'post', '16:11:00 Sydney — post close'],
  ['2026-07-22T06:21:29Z', 'post-close', 'post', '16:21:29 Sydney — final post-close second'],
  ['2026-07-22T06:21:30Z', 'closed', 'closed', '16:21:30 Sydney — modelled sessions finished'],
];

describe('getAsxCashEquityStatus', () => {
  for (const [iso, phase, session, label] of ORDINARY_DAY_FIXTURES) {
    it(label, () => {
      const status = getAsxCashEquityStatus(new Date(iso));
      assert.equal(status.phase, phase);
      assert.equal(status.session, session);
      assert.equal(status.calendarVerified, true);
      assert.equal(status.localDate, '2026-07-22');
    });
  }

  it('uses Australia/Sydney IANA rules across daylight saving', () => {
    const instant = new Date('2026-01-13T23:00:00Z');
    const status = getAsxCashEquityStatus(instant);
    assert.equal(status.localDate, '2026-01-14');
    assert.equal(status.localTime, '10:00:00');
    assert.equal(status.phase, 'regular');
    assert.equal(localClock(instant, 'Australia/Adelaide'), '09:30');
  });

  it('keeps the same Sydney/Adelaide half-hour relationship outside DST', () => {
    const instant = new Date('2026-07-22T00:00:00Z');
    assert.equal(localClock(instant, 'Australia/Sydney'), '10:00');
    assert.equal(localClock(instant, 'Australia/Adelaide'), '09:30');
    assert.equal(getAsxCashEquitySession(instant), 'regular');
  });

  it('returns holiday with the official closure name', () => {
    const fixtures = [
      ['2026-01-01T01:00:00Z', "New Year's Day"],
      ['2026-01-25T23:00:00Z', 'Australia Day'],
      ['2026-04-03T01:00:00Z', 'Good Friday'],
      ['2026-04-05T23:00:00Z', 'Easter Monday'],
      ['2026-06-08T02:00:00Z', "King's Birthday"],
      ['2026-12-25T01:00:00Z', 'Christmas Day'],
      ['2026-12-28T01:00:00Z', 'Boxing Day (observed)'],
    ];
    for (const [iso, holidayName] of fixtures) {
      const status = getAsxCashEquityStatus(new Date(iso));
      assert.equal(status.phase, 'holiday', holidayName);
      assert.equal(status.session, 'holiday', holidayName);
      assert.equal(status.holidayName, holidayName);
      assert.equal(isAsxCashEquityTradingDay(new Date(iso)), false);
    }
  });

  it('reports weekends closed even outside verified calendar years', () => {
    const date = new Date('2027-07-10T02:00:00Z'); // Saturday noon Sydney
    const status = getAsxCashEquityStatus(date);
    assert.equal(status.phase, 'closed');
    assert.equal(status.reason, 'weekend');
    assert.equal(status.calendarVerified, true);
    assert.equal(isAsxCashEquityTradingDay(date), false);
  });

  it('returns unknown for an unsupported weekday calendar year', () => {
    const date = new Date('2027-07-07T02:00:00Z'); // Wednesday noon Sydney
    const status = getAsxCashEquityStatus(date);
    assert.equal(status.phase, 'unknown');
    assert.equal(status.session, 'unknown');
    assert.equal(status.reason, 'calendar-year-unverified');
    assert.equal(status.calendarVerified, false);
    assert.equal(isAsxCashEquityTradingDay(date), null);
  });

  it('conservatively closes from the official 14:10 early close', () => {
    const before = getAsxCashEquityStatus(new Date('2026-12-24T03:09:59Z')); // 14:09:59 AEDT
    const after = getAsxCashEquityStatus(new Date('2026-12-24T03:10:00Z'));  // 14:10:00 AEDT
    assert.equal(before.phase, 'regular');
    assert.equal(before.earlyClose, true);
    assert.equal(after.phase, 'early-close');
    assert.equal(after.session, 'closed');
    assert.equal(after.reason, 'official-early-close-unmodelled-post-phases');
    assert.equal(isAsxCashEquityTradingDay(new Date('2026-12-24T03:10:00Z')), true);
  });

  it('returns unknown instead of throwing for invalid dates', () => {
    const status = getAsxCashEquityStatus(new Date('not-a-date'));
    assert.equal(status.phase, 'unknown');
    assert.equal(status.reason, 'invalid-date');
    assert.equal(status.localDate, null);
    assert.equal(isAsxCashEquityTradingDay(new Date('not-a-date')), null);
  });
});

describe('ASX coarse helpers and metadata', () => {
  it('marks only the regular phase as open', () => {
    assert.equal(isAsxCashEquityMarketOpen(new Date('2026-07-22T00:00:00Z')), true);
    assert.equal(isAsxCashEquityMarketOpen(new Date('2026-07-21T23:59:30Z')), false);
    assert.equal(isAsxCashEquityMarketOpen(new Date('2026-07-22T06:05:00Z')), false);
  });

  it('publishes source and calendar coverage metadata', () => {
    assert.equal(ASX_MARKET_HOURS_METADATA.timeZone, 'Australia/Sydney');
    assert.deepEqual(ASX_MARKET_HOURS_METADATA.verifiedCalendarYears, [2026]);
    assert.match(ASX_MARKET_HOURS_METADATA.hoursSourceUrl, /^https:\/\/www\.asx\.com\.au\//);
    assert.match(ASX_MARKET_HOURS_METADATA.calendarSourceUrl, /^https:\/\/www\.asx\.com\.au\//);
    assert.equal(ASX_MARKET_HOURS_METADATA.sourceCheckedAt, '2026-07-22');
  });
});
