// Browser-safe ASX cash-equity session model.
//
// This is the TypeScript twin of scripts/shared/asx-market-hours.cjs. The two
// implementations are kept deliberately dependency-free because browser code
// cannot import the CommonJS seeder helper and Railway seeders cannot import the
// browser bundle. tests/asx-market-hours-browser-parity.test.mts locks them to
// the same fixtures and metadata.

export const ASX_TIME_ZONE = 'Australia/Sydney';
export const ASX_HOURS_SOURCE_URL =
  'https://www.asx.com.au/markets/market-resources/trading-hours-calendar/cash-market-trading-hours';
export const ASX_CALENDAR_SOURCE_URL =
  'https://www.asx.com.au/markets/market-resources/trading-hours-calendar/cash-market-trading-hours/trading-calendar';
export const ASX_SOURCE_CHECKED_AT = '2026-07-22';

export type AsxCashEquityPhase =
  | 'pre-open'
  | 'opening-auction'
  | 'regular'
  | 'pre-close'
  | 'closing-auction'
  | 'post-close'
  | 'early-close'
  | 'closed'
  | 'holiday'
  | 'unknown';

export type AsxCashEquitySession = 'pre' | 'regular' | 'post' | 'closed' | 'holiday' | 'unknown';

export interface AsxCashEquityStatus {
  phase: AsxCashEquityPhase;
  session: AsxCashEquitySession;
  reason: string;
  timeZone: typeof ASX_TIME_ZONE;
  localDate: string | null;
  localTime: string | null;
  calendarVerified: boolean;
  earlyClose: boolean;
  holidayName: string | null;
}

interface SydneyParts {
  year: number;
  month: number;
  day: number;
  weekday: string;
  localDate: string;
  localTime: string;
  seconds: number;
}

interface VerifiedCalendar {
  closedDates: ReadonlyMap<string, string>;
  earlyCloseDates: ReadonlyMap<string, number>;
}

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
const PRE_OPEN_START = 7 * 60 * 60;
const OPENING_AUCTION_START = 9 * 60 * 60 + 59 * 60;
const REGULAR_START = 10 * 60 * 60;
const REGULAR_END = 16 * 60 * 60;
const PRE_CSPA_END = 16 * 60 * 60 + 10 * 60;
const CSPA_END = 16 * 60 * 60 + 11 * 60;
const POST_CLOSE_END = 16 * 60 * 60 + 21 * 60 + 30;

const ASX_2026_CLOSED_DATES: ReadonlyMap<string, string> = new Map([
  ['2026-01-01', "New Year's Day"],
  ['2026-01-26', 'Australia Day'],
  ['2026-04-03', 'Good Friday'],
  ['2026-04-06', 'Easter Monday'],
  ['2026-04-25', 'ANZAC Day'],
  ['2026-06-08', "King's Birthday"],
  ['2026-12-25', 'Christmas Day'],
  ['2026-12-28', 'Boxing Day (observed)'],
]);

// The official 2026 calendar states when normal trading ceases, but does not
// publish the complete shifted auction/post-close timetable on that page. Once
// the early close is reached the status therefore becomes conservatively closed
// rather than fabricating later phase boundaries.
const ASX_2026_EARLY_CLOSE_DATES: ReadonlyMap<string, number> = new Map([
  ['2026-12-24', 14 * 60 * 60 + 10 * 60],
  ['2026-12-31', 14 * 60 * 60 + 10 * 60],
]);

const VERIFIED_CALENDARS: ReadonlyMap<number, VerifiedCalendar> = new Map([
  [2026, {
    closedDates: ASX_2026_CLOSED_DATES,
    earlyCloseDates: ASX_2026_EARLY_CLOSE_DATES,
  }],
]);

function isValidDate(date: Date): boolean {
  return date instanceof Date && Number.isFinite(date.getTime());
}

function sydneyParts(date: Date): SydneyParts | null {
  const out: Record<string, string> = {};
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
    weekday: out.weekday ?? '',
    localDate,
    localTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
    seconds: hour * 60 * 60 + minute * 60 + second,
  };
}

function buildStatus(
  parts: SydneyParts | null,
  phase: AsxCashEquityPhase,
  session: AsxCashEquitySession,
  reason: string,
  options: Partial<Pick<AsxCashEquityStatus, 'calendarVerified' | 'earlyClose' | 'holidayName'>> = {},
): AsxCashEquityStatus {
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

export function getAsxCashEquityStatus(date: Date = new Date()): AsxCashEquityStatus {
  if (!isValidDate(date)) return buildStatus(null, 'unknown', 'unknown', 'invalid-date');

  let parts: SydneyParts | null;
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
  if (!calendar) return buildStatus(parts, 'unknown', 'unknown', 'calendar-year-unverified');

  const holidayName = calendar.closedDates.get(parts.localDate);
  if (holidayName) {
    return buildStatus(parts, 'holiday', 'holiday', 'official-holiday', {
      calendarVerified: true,
      holidayName,
    });
  }

  const earlyCloseAt = calendar.earlyCloseDates.get(parts.localDate) ?? null;
  const regularEnd = earlyCloseAt ?? REGULAR_END;
  const { seconds } = parts;

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

export function getAsxCashEquitySession(date: Date = new Date()): AsxCashEquitySession {
  return getAsxCashEquityStatus(date).session;
}

export function isAsxCashEquityMarketOpen(date: Date = new Date()): boolean {
  return getAsxCashEquityStatus(date).phase === 'regular';
}

/** True/false inside verified coverage; null for an unverified weekday or invalid date. */
export function isAsxCashEquityTradingDay(date: Date = new Date()): boolean | null {
  const status = getAsxCashEquityStatus(date);
  if (status.session === 'unknown') return null;
  if (status.reason === 'weekend' || status.session === 'holiday') return false;
  return true;
}

export const ASX_MARKET_HOURS_METADATA = Object.freeze({
  timeZone: ASX_TIME_ZONE,
  hoursSourceUrl: ASX_HOURS_SOURCE_URL,
  calendarSourceUrl: ASX_CALENDAR_SOURCE_URL,
  sourceCheckedAt: ASX_SOURCE_CHECKED_AT,
  verifiedCalendarYears: Object.freeze([...VERIFIED_CALENDARS.keys()]),
  normalTrading: Object.freeze({ start: '10:00:00', end: '16:00:00' }),
  conservativeOpeningNote: '09:59:45–10:00 randomized transition is reported as opening-auction',
});
