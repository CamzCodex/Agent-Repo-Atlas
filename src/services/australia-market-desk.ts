import type { MarketData } from '@/types';
import type { BreakerDataMode, BreakerDataState } from '@/utils/circuit-breaker';
import {
  ASX_MARKET_HOURS_METADATA,
  getAsxCashEquityStatus,
  type AsxCashEquityStatus,
} from '@/shared/asx-market-hours';
import {
  assessFinanceObservationProvenance,
  formatFinanceObservationProvenance,
  type FinanceObservationProvenanceAssessment,
} from '@/shared/finance-observation-provenance';
import { getMarketDataState } from '@/services/market-data-state';

export const AUSTRALIA_DESK_MARKET_SYMBOLS = [
  '^AXJO',
  'BHP.AX',
  'CBA.AX',
  'CSL.AX',
] as const;

export const AUSTRALIA_DESK_RESOURCE_SYMBOLS = [
  'AUDUSD=X',
  'HG=F',
  'GC=F',
  'MTF=F',
  'BZ=F',
  'CL=F',
  'NG=F',
] as const;

export const AUSTRALIA_DESK_BASKET_LIMITATION =
  'Australian equities are a compact benchmark/bellwether basket, not ASX market breadth or an investable universe.';

export type AustraliaDeskMarketSymbol = typeof AUSTRALIA_DESK_MARKET_SYMBOLS[number];
export type AustraliaDeskResourceSymbol = typeof AUSTRALIA_DESK_RESOURCE_SYMBOLS[number];
export type AustraliaDeskDataMode = BreakerDataMode | 'unknown';
export type AustraliaSourceReviewStatus = 'current' | 'overdue' | 'future' | 'invalid';

export interface AustraliaQuoteGroupStatus {
  /** State associated with the observations currently displayed. */
  dataMode: AustraliaDeskDataMode;
  dataOffline: boolean;
  /** State of the newest refresh attempt, even when older data is retained. */
  latestAttemptMode: AustraliaDeskDataMode;
  latestAttemptOffline: boolean;
}

export interface AustraliaDeskObservation {
  symbol: string;
  label: string;
  quote: MarketData | null;
  dataMode: AustraliaDeskDataMode;
  offline: boolean;
  provenance: FinanceObservationProvenanceAssessment;
  provenanceLabel: string;
}

export interface AustraliaMarketDeskSnapshot {
  generatedAt: string;
  asxSourceCheckedAt: string;
  asxSourceReviewAgeMs: number | null;
  asxSourceReviewStatus: AustraliaSourceReviewStatus;
  asxStatus: AsxCashEquityStatus;
  asxStatusProvenance: FinanceObservationProvenanceAssessment;
  asxStatusProvenanceLabel: string;
  marketGroupStatus: AustraliaQuoteGroupStatus;
  resourceGroupStatus: AustraliaQuoteGroupStatus;
  markets: AustraliaDeskObservation[];
  resources: AustraliaDeskObservation[];
  missingSymbols: string[];
  warnings: string[];
}

export interface AustraliaMarketDeskOptions {
  now?: Date;
  /** Compatibility fallback for quote arrays not produced by the market service. */
  fetchedAt?: string | number | Date;
  marketFetchedAt?: string | number | Date;
  resourceFetchedAt?: string | number | Date;
  /** Explicit state wins over WeakMap compatibility metadata. */
  marketDataState?: BreakerDataState | null;
  resourceDataState?: BreakerDataState | null;
  marketLatestAttemptState?: BreakerDataState | null;
  resourceLatestAttemptState?: BreakerDataState | null;
  quoteMaxAgeMs?: number;
}

const DEFAULT_QUOTE_MAX_AGE_MS = 15 * 60 * 1000;
const ASX_SOURCE_REVIEW_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const ASX_SOURCE_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_SPARKLINE_POINTS = 256;

const LABELS: Readonly<Record<AustraliaDeskMarketSymbol | AustraliaDeskResourceSymbol, string>> = {
  '^AXJO': 'S&P/ASX 200',
  'BHP.AX': 'BHP Group',
  'CBA.AX': 'Commonwealth Bank',
  'CSL.AX': 'CSL',
  'AUDUSD=X': 'AUD/USD',
  'HG=F': 'Copper',
  'GC=F': 'Gold',
  'MTF=F': 'Newcastle Coal',
  'BZ=F': 'Brent Crude',
  'CL=F': 'WTI Crude',
  'NG=F': 'Natural Gas',
};

function normalizeQuote(quote: MarketData | undefined): MarketData | null {
  if (!quote) return null;
  const price = quote.price;
  const change = quote.change;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  const sparkline = Array.isArray(quote.sparkline)
    ? quote.sparkline
      .filter((value) => Number.isFinite(value) && value > 0)
      .slice(-MAX_SPARKLINE_POINTS)
    : undefined;
  return {
    symbol: quote.symbol.trim(),
    name: quote.name,
    display: quote.display,
    price,
    change: typeof change === 'number' && Number.isFinite(change) ? change : null,
    ...(sparkline ? { sparkline } : {}),
  };
}

function buildQuoteObservation(
  symbol: AustraliaDeskMarketSymbol | AustraliaDeskResourceSymbol,
  quoteMap: ReadonlyMap<string, MarketData>,
  fetchedAt: string | number | Date | undefined,
  groupStatus: AustraliaQuoteGroupStatus,
  nowMs: number,
  quoteMaxAgeMs: number,
): AustraliaDeskObservation {
  const quote = normalizeQuote(quoteMap.get(symbol));
  const provenance = assessFinanceObservationProvenance({
    provider: 'World Monitor market seed (Yahoo Finance path)',
    sourceClass: 'undocumented',
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
    fetchedAt,
    maxAgeMs: quoteMaxAgeMs,
    transformation: {
      kind: 'normalized',
      description: 'Seeded quote normalized to World Monitor market fields',
      version: 'australia-market-desk-v1',
    },
    confidence: quote ? 0.65 : 0.2,
    notes: quote
      ? [
          'Current market API does not expose the upstream observation timestamp.',
          `Displayed-value breaker mode: ${groupStatus.dataMode}${groupStatus.dataOffline ? ' (offline)' : ''}.`,
          `Latest refresh-attempt mode: ${groupStatus.latestAttemptMode}${groupStatus.latestAttemptOffline ? ' (offline)' : ''}.`,
          'When present, freshness is based on the breaker retrieval/cache timestamp rather than exchange time.',
          'Confidence is a heuristic policy label, not a calibrated probability.',
        ]
      : [
          'Symbol is absent or carries a non-positive/invalid price in the current seeded cache.',
          `Latest refresh-attempt mode: ${groupStatus.latestAttemptMode}${groupStatus.latestAttemptOffline ? ' (offline)' : ''}.`,
          'Confidence is a heuristic policy label, not a calibrated probability.',
        ],
  }, nowMs);

  return {
    symbol,
    label: LABELS[symbol],
    quote,
    dataMode: groupStatus.dataMode,
    offline: groupStatus.dataOffline,
    provenance,
    provenanceLabel: formatFinanceObservationProvenance(provenance),
  };
}

function quoteMap(quotes: readonly MarketData[]): Map<string, MarketData> {
  const result = new Map<string, MarketData>();
  for (const quote of quotes) {
    if (!quote || typeof quote.symbol !== 'string') continue;
    const symbol = quote.symbol.trim();
    if (!symbol) continue;
    const existing = result.get(symbol);
    if (!existing || (normalizeQuote(existing) === null && normalizeQuote(quote) !== null)) {
      result.set(symbol, quote);
    }
  }
  return result;
}

function sourceCheckAgeMs(nowMs: number): number | null {
  const checkedAtMs = Date.parse(`${ASX_MARKET_HOURS_METADATA.sourceCheckedAt}T00:00:00Z`);
  if (!Number.isFinite(nowMs) || !Number.isFinite(checkedAtMs)) return null;
  return nowMs - checkedAtMs;
}

function sourceReviewStatus(ageMs: number | null): AustraliaSourceReviewStatus {
  if (ageMs === null || !Number.isFinite(ageMs)) return 'invalid';
  if (ageMs < -ASX_SOURCE_FUTURE_TOLERANCE_MS) return 'future';
  if (ageMs > ASX_SOURCE_REVIEW_MAX_AGE_MS) return 'overdue';
  return 'current';
}

function timestampFromState(
  state: BreakerDataState | null,
  compatibilityTimestamp: string | number | Date | undefined,
): string | number | Date | undefined {
  if (!state) return compatibilityTimestamp;
  return state.timestamp ?? undefined;
}

function groupStatus(
  dataState: BreakerDataState | null,
  latestAttemptState: BreakerDataState | null,
): AustraliaQuoteGroupStatus {
  return {
    dataMode: dataState?.mode ?? 'unknown',
    dataOffline: dataState?.offline ?? false,
    latestAttemptMode: latestAttemptState?.mode ?? dataState?.mode ?? 'unknown',
    latestAttemptOffline: latestAttemptState?.offline ?? dataState?.offline ?? false,
  };
}

export function buildAustraliaMarketDeskSnapshot(
  marketQuotes: readonly MarketData[],
  commodityQuotes: readonly MarketData[],
  options: AustraliaMarketDeskOptions = {},
): AustraliaMarketDeskSnapshot {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const generatedAt = Number.isFinite(nowMs) ? now.toISOString() : '';
  const asxStatus = getAsxCashEquityStatus(now);
  const quoteMaxAgeMs = Number.isFinite(options.quoteMaxAgeMs)
    ? Math.max(0, options.quoteMaxAgeMs ?? DEFAULT_QUOTE_MAX_AGE_MS)
    : DEFAULT_QUOTE_MAX_AGE_MS;
  const marketState = options.marketDataState ?? getMarketDataState(marketQuotes);
  const resourceState = options.resourceDataState ?? getMarketDataState(commodityQuotes);
  const marketAttemptState = options.marketLatestAttemptState ?? marketState;
  const resourceAttemptState = options.resourceLatestAttemptState ?? resourceState;
  const marketGroupStatus = groupStatus(marketState, marketAttemptState);
  const resourceGroupStatus = groupStatus(resourceState, resourceAttemptState);
  const marketFetchedAt = timestampFromState(
    marketState,
    options.marketFetchedAt ?? options.fetchedAt,
  );
  const resourceFetchedAt = timestampFromState(
    resourceState,
    options.resourceFetchedAt ?? options.fetchedAt,
  );

  const asxStatusProvenance = assessFinanceObservationProvenance({
    provider: 'ASX',
    sourceClass: 'official',
    sourceUrl: ASX_MARKET_HOURS_METADATA.hoursSourceUrl,
    observedAt: now,
    maxAgeMs: 60_000,
    transformation: {
      kind: 'deterministic-model',
      description: 'ASX cash-market phase derived in Australia/Sydney from the verified calendar',
      version: 'asx-market-hours-v1',
    },
    confidence: asxStatus.calendarVerified ? 1 : 0.35,
    notes: [
      `Trading-hours and calendar sources last checked ${ASX_MARKET_HOURS_METADATA.sourceCheckedAt}.`,
      `Calendar source: ${ASX_MARKET_HOURS_METADATA.calendarSourceUrl}`,
      'The model evaluation time is not a live ASX schedule retrieval time.',
      'Confidence is a heuristic policy label, not a calibrated probability.',
      asxStatus.calendarVerified
        ? 'The local calendar year is verified.'
        : 'The local weekday calendar year is not verified; status is intentionally unknown.',
    ],
  }, nowMs);

  const marketsMap = quoteMap(marketQuotes);
  const resourcesMap = quoteMap(commodityQuotes);
  const markets = AUSTRALIA_DESK_MARKET_SYMBOLS.map((symbol) =>
    buildQuoteObservation(symbol, marketsMap, marketFetchedAt, marketGroupStatus, nowMs, quoteMaxAgeMs));
  const resources = AUSTRALIA_DESK_RESOURCE_SYMBOLS.map((symbol) =>
    buildQuoteObservation(symbol, resourcesMap, resourceFetchedAt, resourceGroupStatus, nowMs, quoteMaxAgeMs));
  const missingSymbols = [...markets, ...resources]
    .filter((observation) => observation.quote === null)
    .map((observation) => observation.symbol);

  const reviewAgeMs = sourceCheckAgeMs(nowMs);
  const reviewStatus = sourceReviewStatus(reviewAgeMs);
  const warnings: string[] = [AUSTRALIA_DESK_BASKET_LIMITATION];
  if (!asxStatus.calendarVerified) warnings.push('ASX calendar year is unverified.');
  if (reviewStatus === 'overdue') {
    warnings.push('ASX trading-hours/calendar sources are past the 90-day review interval.');
  } else if (reviewStatus === 'future') {
    warnings.push('ASX source-check date is future-dated relative to the model clock.');
  } else if (reviewStatus === 'invalid') {
    warnings.push('ASX source-check date could not be evaluated.');
  }
  if (missingSymbols.length > 0) warnings.push(`${missingSymbols.length} Australia-desk symbols are unavailable or invalid.`);
  if ([...markets, ...resources].some((observation) =>
    observation.provenance.flags.includes('unverified-access-method'))) {
    warnings.push('Market observations use an undocumented upstream access path.');
  }
  if ([...markets, ...resources].some((observation) =>
    observation.provenance.flags.includes('missing-observed-at'))) {
    warnings.push('Quote observation time is unavailable; retrieval time is not exchange time.');
  }
  if (marketGroupStatus.dataMode === 'cached') warnings.push('Australian equity observations are being served from cache.');
  if (resourceGroupStatus.dataMode === 'cached') warnings.push('AUD/resource observations are being served from cache.');
  if (marketGroupStatus.latestAttemptMode === 'unavailable' && markets.some((entry) => entry.quote !== null)) {
    warnings.push('Latest Australian equity refresh is unavailable; displaying the last usable observations.');
  }
  if (resourceGroupStatus.latestAttemptMode === 'unavailable' && resources.some((entry) => entry.quote !== null)) {
    warnings.push('Latest AUD/resource refresh is unavailable; displaying the last usable observations.');
  }
  if (
    marketGroupStatus.dataOffline
    || marketGroupStatus.latestAttemptOffline
    || resourceGroupStatus.dataOffline
    || resourceGroupStatus.latestAttemptOffline
  ) {
    warnings.push('One or more market groups are using offline-mode data.');
  }
  if (markets.some((observation) => observation.provenance.freshness === 'stale')) {
    warnings.push('Australian equity observations are stale.');
  }
  if (resources.some((observation) => observation.provenance.freshness === 'stale')) {
    warnings.push('AUD/resource observations are stale.');
  }

  return {
    generatedAt,
    asxSourceCheckedAt: ASX_MARKET_HOURS_METADATA.sourceCheckedAt,
    asxSourceReviewAgeMs: reviewAgeMs,
    asxSourceReviewStatus: reviewStatus,
    asxStatus,
    asxStatusProvenance,
    asxStatusProvenanceLabel: formatFinanceObservationProvenance(asxStatusProvenance),
    marketGroupStatus,
    resourceGroupStatus,
    markets,
    resources,
    missingSymbols,
    warnings: Array.from(new Set(warnings)),
  };
}
