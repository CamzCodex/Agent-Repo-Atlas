'use strict';

/**
 * ASX cash-equity session helper for the Australia-focused finance workspace.
 *
 * Session hours are interpreted in Australia/Sydney with Intl.formatToParts,
 * so daylight-saving transitions are handled by the runtime's IANA database.
 * The normal-day phase boundaries follow ASX's cash-market schedule checked on
 * 2026-07-22. Calendar closures and early closes are intentionally limited to
 * years whose official ASX Trade calendar has been transcribed below.
 *
 * Outside verified calendar coverage, weekday status is `unknown` rather than
 * pretending the exchange is open. That is deliberate: ASX may alter or add
 * non-business days, and a quote seeder should fetch defensively rather than
 * suppressing a refresh on an invented calendar.
 *
 * Hours source:
 * https://www.asx.com.au/markets/market-resources/trading-hours-calendar/cash-market-trading-hours
 * Calendar source:
 * https://www.asx.com.au/markets/market-resources/trading-hours-calendar/cash-market-trading-hours/trading-calendar
 */

const ASX_TIME_ZONE = 'Australia/Sydney';
const ASX_HOURS_SOURCE_URL =
  'https://www.asx.com.au/markets/market-resources/trading-hours-calendar/cash-market-trading-hours';
const ASX_CALENDAR_SOURCE_URL =
  'https://www.asx.com.au/markets/market-resources/trading-hours-calendar/cash-market-trading-hours/trading-calendar';
const ASX_SOURCE_CHECKED_AT = '2026-07-22';

const SYDNEY_PARTS_FMT = new Intl.DateTimeFormat('en-AU', {
  timeZone: ASX_TIME_ZONE,
  hourCycle: 'h23',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

// Seconds from Sydney midnight. ASX's opening transition is randomized during
// 09:59:45–10:00, so this helper conservatively reports `opening-auction` until
// 10:00 instead of claiming continuous trading up to 15 seconds too early.
const PRE_OPEN_START = 7 * 60 * 60;                  // 07:00:00
const OPENING_AUCTION_START = 9 * 60 * 60 + 59 * 60; // 09:59:00
const REGULAR_START = 10 * 60 * 60;                  // 10:00:00 conservative
const REGULAR_END = 16 * 60 * 60;                    // 16:00:00
const PRE_CSPA_END = 16 * 60 * 60 + 10 * 60;         // 16:10:00
const CSPA_END = 16 * 60 * 60 + 11 * 60;             // 16:11:00
const POST_CLOSE_END = 16 * 60 * 60 + 21 * 60 + 30;  // 16:21:30

// Official ASX Trade cash-market calendar for 2026. Keep names with the dates
// so diagnostics and UI callers can explain why a day is unavailable.
const ASX_2026_CLOSED_DATES = new Map([
  ['2026-01-01', "New Year's Day"],
  ['2026-01-26', 'Australia Day'],
  ['2026-04-03', 'Good Friday'],
  ['2026-04-06', 'Easter Monday'],
  ['2026-04-25', 'ANZAC Day'],
  ['2026-06-08', "King's Birthday"],
  ['2026-12-25', 'Christmas Day'],
  ['2026-12-28', 'Boxing Day (observed)'],
]);

// The official 2026 calendar states only when normal trading ceases. It does
// not publish the complete shifted auction/post-close timetable on that page,
// so status becomes conservatively `closed` from 14:10 rather than fabricating
// later phase boundaries.
const ASX_2026_EARLY_CLOSE_DATES = new Map([
  ['2026-12-24', 14 * 60 * 60 + 10 * 60],
  ['2026-12-31', 14 * 60 * 60 + 10 * 60],
]);

const VERIFIED_CALENDARS = new Map([
  [2026, {
    closedDates: ASX_2026_CLOSED_DATES,
    earlyCloseDates: ASX_2026_EARLY_CLOSE_DATES,
  }],
]);

function isValidDate(date) {
  return date instanceof Date && Number.isFinite(date.getTime());
}

function sydneyParts(date) {
  const out = {};
  for (const part of SYDNEY_PARTS_FMT.formatToParts(date)) out[part.type] = part.value;
  const year = Number(out.year);
  const month = Number(out.month);
  const day = Number(out.day);
  const hour = Number(out.hour);
  const minute = Number(out.minute);
  const second = Number(out.second);
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) return null;
  const localDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return {
    year,
    month,
    day,
    weekday: out.weekday,
    localDate,
    localTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
    seconds: hour * 60 * 60 + minute * 60 + second,
  };
}

function buildStatus(parts, phase, session, reason, options = {}) {
  return {
    phase,
    session,
    reason,
    timeZone: ASX_TIME_ZONE,
    localDate: parts?.localDate ?? null,
    localTime: parts?.localTime ?? null,
    calendarVerified: options.calendarVerified ?? false,
    earlyClose: options.earlyClose ?? false,
    holidayName: options.holidayName ?? null,
  };
}

/**
 * Detailed ASX cash-equity status.
 *
 * `phase` is one of:
 *   pre-open | opening-auction | regular | pre-close | closing-auction |
 *   post-close | early-close | closed | holiday | unknown
 *
 * `session` is the coarser compatibility value:
 *   pre | regular | post | closed | holiday | unknown
 */
function getAsxCashEquityStatus(date = new Date()) {
  if (!isValidDate(date)) {
    return buildStatus(null, 'unknown', 'unknown', 'invalid-date');
  }

  let parts;
  try {
    parts = sydneyParts(date);
  } catch {
    return buildStatus(null, 'unknown', 'unknown', 'timezone-format-failed');
  }
  if (!parts) return buildStatus(null, 'unknown', 'unknown', 'timezone-format-failed');

  if (parts.weekday === 'Sat' || parts.weekday === 'Sun') {
    return buildStatus(parts, 'closed', 'closed', 'weekend', { calendarVerified: true });
  }

  const calendar = VERIFIED_CALENDARS.get(parts.year);
  if (!calendar) {
    return buildStatus(parts, 'unknown', 'unknown', 'calendar-year-unverified');
  }

  const holidayName = calendar.closedDates.get(parts.localDate);
  if (holidayName) {
    return buildStatus(parts, 'holiday', 'holiday', 'official-holiday', {
      calendarVerified: true,
      holidayName,
    });
  }

  const earlyCloseAt = calendar.earlyCloseDates.get(parts.localDate) ?? null;
  const regularEnd = earlyCloseAt ?? REGULAR_END;
  const seconds = parts.seconds;

  if (seconds < PRE_OPEN_START) {
    return buildStatus(parts, 'closed', 'closed', 'before-pre-open', {
      calendarVerified: true,
      earlyClose: earlyCloseAt != null,
    });
  }
  if (seconds < OPENING_AUCTION_START) {
    return buildStatus(parts, 'pre-open', 'pre', 'pre-open', {
      calendarVerified: true,
      earlyClose: earlyCloseAt != null,
    });
  }
  if (seconds < REGULAR_START) {
    return buildStatus(parts, 'opening-auction', 'pre', 'opening-auction-or-transition', {
      calendarVerified: true,
      earlyClose: earlyCloseAt != null,
    });
  }
  if (seconds < regularEnd) {
    return buildStatus(parts, 'regular', 'regular', 'normal-trading', {
      calendarVerified: true,
      earlyClose: earlyCloseAt != null,
    });
  }

  if (earlyCloseAt != null) {
    return buildStatus(parts, 'early-close', 'closed', 'official-early-close-unmodelled-post-phases', {
      calendarVerified: true,
      earlyClose: true,
    });
  }

  if (seconds < PRE_CSPA_END) {
    return buildStatus(parts, 'pre-close', 'post', 'pre-cspa', { calendarVerified: true });
  }
  if (seconds < CSPA_END) {
    return buildStatus(parts, 'closing-auction', 'post', 'closing-auction', { calendarVerified: true });
  }
  if (seconds < POST_CLOSE_END) {
    return buildStatus(parts, 'post-close', 'post', 'post-close', { calendarVerified: true });
  }
  return buildStatus(parts, 'closed', 'closed', 'outside-modelled-trading-phases', {
    calendarVerified: true,
  });
}

function getAsxCashEquitySession(date = new Date()) {
  return getAsxCashEquityStatus(date).session;
}

function isAsxCashEquityMarketOpen(date = new Date()) {
  return getAsxCashEquityStatus(date).phase === 'regular';
}

/**
 * @returns {boolean|null} true/false inside verified coverage; null for an
 * unverified weekday calendar year or an invalid date.
 */
function isAsxCashEquityTradingDay(date = new Date()) {
  const status = getAsxCashEquityStatus(date);
  if (status.session === 'unknown') return null;
  if (status.reason === 'weekend' || status.session === 'holiday') return false;
  return true;
}

const ASX_MARKET_HOURS_METADATA = Object.freeze({
  timeZone: ASX_TIME_ZONE,
  hoursSourceUrl: ASX_HOURS_SOURCE_URL,
  calendarSourceUrl: ASX_CALENDAR_SOURCE_URL,
  sourceCheckedAt: ASX_SOURCE_CHECKED_AT,
  verifiedCalendarYears: Object.freeze([...VERIFIED_CALENDARS.keys()]),
  normalTrading: Object.freeze({ start: '10:00:00', end: '16:00:00' }),
  conservativeOpeningNote: '09:59:45–10:00 randomized transition is reported as opening-auction',
});

module.exports = {
  ASX_MARKET_HOURS_METADATA,
  getAsxCashEquityStatus,
  getAsxCashEquitySession,
  isAsxCashEquityMarketOpen,
  isAsxCashEquityTradingDay,
};
