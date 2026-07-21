import type { MarketData } from '@/types';
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

export type AustraliaDeskMarketSymbol = typeof AUSTRALIA_DESK_MARKET_SYMBOLS[number];
export type AustraliaDeskResourceSymbol = typeof AUSTRALIA_DESK_RESOURCE_SYMBOLS[number];

export interface AustraliaDeskObservation {
  symbol: string;
  label: string;
  quote: MarketData | null;
  provenance: FinanceObservationProvenanceAssessment;
  provenanceLabel: string;
}

export interface AustraliaMarketDeskSnapshot {
  generatedAt: string;
  asxStatus: AsxCashEquityStatus;
  asxStatusProvenance: FinanceObservationProvenanceAssessment;
  asxStatusProvenanceLabel: string;
  markets: AustraliaDeskObservation[];
  resources: AustraliaDeskObservation[];
  missingSymbols: string[];
  warnings: string[];
}

export interface AustraliaMarketDeskOptions {
  now?: Date;
  /** Compatibility fallback for callers whose quote groups share one retrieval clock. */
  fetchedAt?: string | number | Date;
  marketFetchedAt?: string | number | Date;
  resourceFetchedAt?: string | number | Date;
  quoteMaxAgeMs?: number;
}

const DEFAULT_QUOTE_MAX_AGE_MS = 15 * 60 * 1000;

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
  return {
    symbol: quote.symbol,
    name: quote.name,
    display: quote.display,
    price: typeof price === 'number' && Number.isFinite(price) ? price : null,
    change: typeof change === 'number' && Number.isFinite(change) ? change : null,
    ...(Array.isArray(quote.sparkline)
      ? { sparkline: quote.sparkline.filter((value) => Number.isFinite(value)) }
      : {}),
  };
}

function buildQuoteObservation(
  symbol: AustraliaDeskMarketSymbol | AustraliaDeskResourceSymbol,
  quoteMap: ReadonlyMap<string, MarketData>,
  fetchedAt: string | number | Date | undefined,
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
      ? ['Current market API does not expose the upstream observation timestamp.']
      : ['Symbol is absent from the current seeded cache.'],
  }, nowMs);

  return {
    symbol,
    label: LABELS[symbol],
    quote,
    provenance,
    provenanceLabel: formatFinanceObservationProvenance(provenance),
  };
}

function quoteMap(quotes: readonly MarketData[]): Map<string, MarketData> {
  const result = new Map<string, MarketData>();
  for (const quote of quotes) {
    if (!quote || typeof quote.symbol !== 'string' || !quote.symbol) continue;
    if (!result.has(quote.symbol)) result.set(quote.symbol, quote);
  }
  return result;
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
  const marketFetchedAt = options.marketFetchedAt ?? options.fetchedAt;
  const resourceFetchedAt = options.resourceFetchedAt ?? options.fetchedAt;

  const asxStatusProvenance = assessFinanceObservationProvenance({
    provider: 'ASX',
    sourceClass: 'official',
    sourceUrl: ASX_MARKET_HOURS_METADATA.hoursSourceUrl,
    termsUrl: ASX_MARKET_HOURS_METADATA.calendarSourceUrl,
    observedAt: now,
    fetchedAt: now,
    maxAgeMs: 60_000,
    transformation: {
      kind: 'deterministic-model',
      description: 'ASX cash-market phase derived in Australia/Sydney from the verified calendar',
      version: 'asx-market-hours-v1',
    },
    confidence: asxStatus.calendarVerified ? 1 : 0.35,
    notes: [
      `Calendar source checked ${ASX_MARKET_HOURS_METADATA.sourceCheckedAt}.`,
      asxStatus.calendarVerified
        ? 'The local calendar year is verified.'
        : 'The local weekday calendar year is not verified; status is intentionally unknown.',
    ],
  }, nowMs);

  const marketsMap = quoteMap(marketQuotes);
  const resourcesMap = quoteMap(commodityQuotes);
  const markets = AUSTRALIA_DESK_MARKET_SYMBOLS.map((symbol) =>
    buildQuoteObservation(symbol, marketsMap, marketFetchedAt, nowMs, quoteMaxAgeMs));
  const resources = AUSTRALIA_DESK_RESOURCE_SYMBOLS.map((symbol) =>
    buildQuoteObservation(symbol, resourcesMap, resourceFetchedAt, nowMs, quoteMaxAgeMs));
  const missingSymbols = [...markets, ...resources]
    .filter((observation) => observation.quote === null)
    .map((observation) => observation.symbol);

  const warnings: string[] = [];
  if (!asxStatus.calendarVerified) warnings.push('ASX calendar year is unverified.');
  if (missingSymbols.length > 0) warnings.push(`${missingSymbols.length} Australia-desk symbols are unavailable.`);
  if ([...markets, ...resources].some((observation) =>
    observation.provenance.flags.includes('unverified-access-method'))) {
    warnings.push('Market observations use an undocumented upstream access path.');
  }
  if ([...markets, ...resources].some((observation) =>
    observation.provenance.flags.includes('missing-observed-at'))) {
    warnings.push('Quote observation time is unavailable; retrieval time is not exchange time.');
  }
  if (markets.some((observation) => observation.provenance.freshness === 'stale')) {
    warnings.push('Australian equity observations are stale.');
  }
  if (resources.some((observation) => observation.provenance.freshness === 'stale')) {
    warnings.push('AUD/resource observations are stale.');
  }

  return {
    generatedAt,
    asxStatus,
    asxStatusProvenance,
    asxStatusProvenanceLabel: formatFinanceObservationProvenance(asxStatusProvenance),
    markets,
    resources,
    missingSymbols,
    warnings,
  };
}
