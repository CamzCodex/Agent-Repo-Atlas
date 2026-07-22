/**
 * Unified market service module -- replaces legacy service:
 *   - src/services/markets.ts (Finnhub + Yahoo + CoinGecko)
 *
 * All data now flows through the MarketServiceClient RPCs.
 */

import { getRpcBaseUrl } from '@/services/rpc-client';
import type {
  ListMarketQuotesResponse,
  ListCommodityQuotesResponse,
  GetSectorSummaryResponse,
  ListCryptoQuotesResponse,
  ListCryptoSectorsResponse,
  CryptoSector,
  ListDefiTokensResponse,
  ListAiTokensResponse,
  ListOtherTokensResponse,
  MarketQuote as ProtoMarketQuote,
  CryptoQuote as ProtoCryptoQuote,
} from '@/generated/client/worldmonitor/market/v1/service_client';
import type { MarketData, CryptoData, TokenData } from '@/types';
import { createCircuitBreaker, type BreakerDataState } from '@/utils/circuit-breaker';
import { getHydratedData } from '@/services/bootstrap';
import { MarketServiceClient } from '@/services/generated-rpc-clients';
import {
  markLatestMarketRequestState,
  markMarketDataState,
} from '@/services/market-data-state';

const client = new MarketServiceClient(getRpcBaseUrl(), { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });
const MARKET_QUOTES_CACHE_TTL_MS = 5 * 60 * 1000;
const stockBreaker = createCircuitBreaker<ListMarketQuotesResponse>({ name: 'Market Quotes', cacheTtlMs: MARKET_QUOTES_CACHE_TTL_MS, persistCache: true });
const commodityBreaker = createCircuitBreaker<ListCommodityQuotesResponse>({ name: 'Commodity Quotes', cacheTtlMs: MARKET_QUOTES_CACHE_TTL_MS, persistCache: true });
const sectorBreaker = createCircuitBreaker<GetSectorSummaryResponse>({ name: 'Sector Summary v2', cacheTtlMs: MARKET_QUOTES_CACHE_TTL_MS, persistCache: true });
const cryptoBreaker = createCircuitBreaker<ListCryptoQuotesResponse>({ name: 'Crypto Quotes', persistCache: true });
const cryptoSectorsBreaker = createCircuitBreaker<ListCryptoSectorsResponse>({ name: 'Crypto Sectors', persistCache: true });
const defiBreaker = createCircuitBreaker<ListDefiTokensResponse>({ name: 'DeFi Tokens', persistCache: true });
const aiBreaker = createCircuitBreaker<ListAiTokensResponse>({ name: 'AI Tokens', persistCache: true });
const otherBreaker = createCircuitBreaker<ListOtherTokensResponse>({ name: 'Other Tokens', persistCache: true });

const emptyStockFallback: ListMarketQuotesResponse = { quotes: [], finnhubSkipped: false, skipReason: '', rateLimited: false };
const emptyCommodityFallback: ListCommodityQuotesResponse = { quotes: [] };
const emptySectorFallback: GetSectorSummaryResponse = { sectors: [] };
const emptyCryptoFallback: ListCryptoQuotesResponse = { quotes: [] };
const emptyCryptoSectorsFallback: ListCryptoSectorsResponse = { sectors: [] };
const emptyDefiTokensFallback: ListDefiTokensResponse = { tokens: [] };
const emptyAiTokensFallback: ListAiTokensResponse = { tokens: [] };
const emptyOtherTokensFallback: ListOtherTokensResponse = { tokens: [] };
const UNAVAILABLE_DATA_STATE: BreakerDataState = { mode: 'unavailable', timestamp: null, offline: false };

function toMarketData(proto: ProtoMarketQuote, meta?: { name?: string; display?: string }): MarketData {
  return {
    symbol: proto.symbol,
    name: meta?.name || proto.name,
    display: meta?.display || proto.display || proto.symbol,
    price: proto.price != null ? proto.price : null,
    change: proto.change ?? null,
    sparkline: proto.sparkline.length > 0 ? proto.sparkline : undefined,
  };
}

function cloneMarketData(data: readonly MarketData[]): MarketData[] {
  return data.map((entry) => ({
    ...entry,
    ...(entry.sparkline ? { sparkline: [...entry.sparkline] } : {}),
  }));
}

function toCryptoData(proto: ProtoCryptoQuote): CryptoData {
  return {
    name: proto.name,
    symbol: proto.symbol,
    price: proto.price,
    change: proto.change,
    sparkline: proto.sparkline.length > 0 ? proto.sparkline : undefined,
  };
}

export interface MarketFetchResult {
  data: MarketData[];
  skipped?: boolean;
  reason?: string;
  rateLimited?: boolean;
  /** State associated with the data returned to this caller. */
  dataState?: BreakerDataState;
  /** State of the newest fetch invocation before any last-good fallback. */
  latestAttemptState?: BreakerDataState;
}

interface LastSuccessfulMarketResult {
  data: MarketData[];
  timestamp: number;
}

const MAX_LAST_SUCCESSFUL_KEYS = 64;
const lastSuccessfulByKey = new Map<string, LastSuccessfulMarketResult>();

function symbolSetKey(symbols: string[]): string {
  return [...new Set(symbols.map((symbol) => symbol.trim()))].sort().join(',');
}

function rememberLastSuccessful(setKey: string, data: MarketData[], state: BreakerDataState): void {
  const timestamp = state.timestamp;
  if (timestamp === null || !Number.isFinite(timestamp)) return;
  lastSuccessfulByKey.delete(setKey);
  lastSuccessfulByKey.set(setKey, { data: cloneMarketData(data), timestamp });
  while (lastSuccessfulByKey.size > MAX_LAST_SUCCESSFUL_KEYS) {
    const oldest = lastSuccessfulByKey.keys().next().value;
    if (oldest === undefined) break;
    lastSuccessfulByKey.delete(oldest);
  }
}

export async function fetchMultipleStocks(
  symbols: Array<{ symbol: string; name: string; display: string }>,
  options: { onBatch?: (results: MarketData[]) => void } = {},
): Promise<MarketFetchResult> {
  const symbolMetaMap = new Map<string, { symbol: string; name: string; display: string }>();
  const uppercaseMetaMap = new Map<string, { symbol: string; name: string; display: string }>();
  for (const s of symbols) {
    const trimmed = s.symbol.trim();
    if (!symbolMetaMap.has(trimmed)) symbolMetaMap.set(trimmed, s);
    const upper = trimmed.toUpperCase();
    if (!uppercaseMetaMap.has(upper)) uppercaseMetaMap.set(upper, s);
  }
  const allSymbolStrings = [...symbolMetaMap.keys()];
  const setKey = symbolSetKey(allSymbolStrings);
  let breakerState: BreakerDataState = { ...UNAVAILABLE_DATA_STATE };

  const resp = await stockBreaker.execute(async () => {
    return client.listMarketQuotes({ symbols: allSymbolStrings });
  }, emptyStockFallback, {
    cacheKey: setKey,
    shouldCache: (r) => r.quotes.length > 0,
    onDataState: (state) => { breakerState = state; },
  });
  const latestAttemptState = { ...breakerState };
  markLatestMarketRequestState(allSymbolStrings, latestAttemptState);

  const results = resp.quotes.map((q) => {
    const trimmed = q.symbol.trim();
    const meta = symbolMetaMap.get(trimmed) ?? uppercaseMetaMap.get(trimmed.toUpperCase()) ?? undefined;
    return toMarketData(q, meta);
  });

  markMarketDataState(results, breakerState, {
    latestAttemptState,
    requestSymbols: allSymbolStrings,
  });
  if (results.length > 0) {
    options.onBatch?.(results);
    rememberLastSuccessful(setKey, results, breakerState);
  }

  const lastSuccessful = lastSuccessfulByKey.get(setKey);
  const data = results.length > 0
    ? results
    : (lastSuccessful ? cloneMarketData(lastSuccessful.data) : []);
  let displayedState = { ...breakerState };
  if (results.length === 0 && lastSuccessful) {
    displayedState = {
      mode: 'cached',
      timestamp: lastSuccessful.timestamp,
      offline: breakerState.offline,
    };
    markMarketDataState(data, displayedState, {
      latestAttemptState,
      requestSymbols: allSymbolStrings,
    });
  }

  return {
    data,
    skipped: resp.finnhubSkipped || undefined,
    reason: resp.skipReason || undefined,
    rateLimited: resp.rateLimited || undefined,
    dataState: { ...displayedState },
    latestAttemptState,
  };
}

export async function fetchStockQuote(
  symbol: string,
  name: string,
  display: string,
): Promise<MarketData> {
  const result = await fetchMultipleStocks([{ symbol, name, display }]);
  return result.data[0] || { symbol, name, display, price: null, change: null };
}

export function warmCommodityCache(quotes: ListCommodityQuotesResponse): void {
  const symbols = quotes.quotes.map((q) => q.symbol);
  const cacheKey = [...symbols].sort().join(',');
  commodityBreaker.recordSuccess(quotes, cacheKey);
}

export function warmSectorCache(resp: GetSectorSummaryResponse): void {
  sectorBreaker.recordSuccess(resp);
}

export async function fetchCommodityQuotes(
  commodities: Array<{ symbol: string; name: string; display: string }>,
  options: { onBatch?: (results: MarketData[]) => void } = {},
): Promise<MarketFetchResult> {
  const symbols = commodities.map((c) => c.symbol);
  const meta = new Map(commodities.map((c) => [c.symbol, c]));
  const cacheKey = [...symbols].sort().join(',');
  let breakerState: BreakerDataState = { ...UNAVAILABLE_DATA_STATE };

  const resp = await commodityBreaker.execute(async () => {
    return client.listCommodityQuotes({ symbols });
  }, emptyCommodityFallback, {
    cacheKey,
    shouldCache: (r: ListCommodityQuotesResponse) => r.quotes.length > 0,
    onDataState: (state) => { breakerState = state; },
  });
  const latestAttemptState = { ...breakerState };
  markLatestMarketRequestState(symbols, latestAttemptState);

  const results: MarketData[] = resp.quotes.map((q) => {
    const m = meta.get(q.symbol);
    return {
      symbol: q.symbol,
      name: m?.name ?? q.name,
      display: m?.display ?? q.display ?? q.symbol,
      price: q.price,
      change: q.change,
      sparkline: q.sparkline?.length > 0 ? q.sparkline : undefined,
    };
  });

  markMarketDataState(results, breakerState, {
    latestAttemptState,
    requestSymbols: symbols,
  });
  if (results.length > 0) options.onBatch?.(results);
  return {
    data: results,
    dataState: { ...breakerState },
    latestAttemptState,
  };
}

export async function fetchSectors(): Promise<GetSectorSummaryResponse> {
  return sectorBreaker.execute(async () => {
    return client.getSectorSummary({ period: '' });
  }, emptySectorFallback, {
    shouldCache: (r: GetSectorSummaryResponse) => {
      if (r.sectors.length === 0) return false;
      const withValuations = r as GetSectorSummaryResponse & { valuations?: unknown };
      return Object.prototype.hasOwnProperty.call(withValuations, 'valuations');
    },
  });
}

let lastSuccessfulCrypto: CryptoData[] = [];

export async function fetchCrypto(): Promise<CryptoData[]> {
  const hydrated = getHydratedData('cryptoQuotes') as ListCryptoQuotesResponse | undefined;
  if (hydrated?.quotes?.length) {
    const mapped = hydrated.quotes.map(toCryptoData).filter(c => c.price > 0);
    if (mapped.length > 0) { lastSuccessfulCrypto = mapped; return mapped; }
  }

  const resp = await cryptoBreaker.execute(async () => {
    return client.listCryptoQuotes({ ids: [] });
  }, emptyCryptoFallback);

  const results = resp.quotes
    .map(toCryptoData)
    .filter(c => c.price > 0);

  if (results.length > 0) {
    lastSuccessfulCrypto = results;
    return results;
  }

  return lastSuccessfulCrypto;
}

let lastSuccessfulSectors: CryptoSector[] = [];

export async function fetchCryptoSectors(): Promise<CryptoSector[]> {
  const hydrated = getHydratedData('cryptoSectors') as ListCryptoSectorsResponse | undefined;
  if (hydrated?.sectors?.length) {
    lastSuccessfulSectors = hydrated.sectors;
    return hydrated.sectors;
  }

  const resp = await cryptoSectorsBreaker.execute(async () => {
    return client.listCryptoSectors({});
  }, emptyCryptoSectorsFallback);

  if (resp.sectors.length > 0) {
    lastSuccessfulSectors = resp.sectors;
    return resp.sectors;
  }
  return lastSuccessfulSectors;
}

function toTokenData(q: ProtoCryptoQuote): TokenData {
  const raw = q as unknown as { change?: number; change24h?: number };
  return {
    name: q.name,
    symbol: q.symbol,
    price: q.price ?? 0,
    change24h: (raw.change ?? raw.change24h) ?? 0,
    change7d: q.change7d ?? 0,
  };
}

let lastSuccessfulDefi: TokenData[] = [];
let lastSuccessfulAi: TokenData[] = [];
let lastSuccessfulOther: TokenData[] = [];

export async function fetchDefiTokens(): Promise<TokenData[]> {
  const hydrated = getHydratedData('defiTokens') as ListDefiTokensResponse | undefined;
  if (hydrated?.tokens?.length) {
    const mapped = hydrated.tokens.map(toTokenData).filter(t => t.price > 0);
    if (mapped.length > 0) { lastSuccessfulDefi = mapped; return mapped; }
  }

  const resp = await defiBreaker.execute(async () => {
    return client.listDefiTokens({});
  }, emptyDefiTokensFallback);

  const results = resp.tokens.map(toTokenData).filter(t => t.price > 0);
  if (results.length > 0) { lastSuccessfulDefi = results; return results; }
  return lastSuccessfulDefi;
}

export async function fetchAiTokens(): Promise<TokenData[]> {
  const hydrated = getHydratedData('aiTokens') as ListAiTokensResponse | undefined;
  if (hydrated?.tokens?.length) {
    const mapped = hydrated.tokens.map(toTokenData).filter(t => t.price > 0);
    if (mapped.length > 0) { lastSuccessfulAi = mapped; return mapped; }
  }

  const resp = await aiBreaker.execute(async () => {
    return client.listAiTokens({});
  }, emptyAiTokensFallback);

  const results = resp.tokens.map(toTokenData).filter(t => t.price > 0);
  if (results.length > 0) { lastSuccessfulAi = results; return results; }
  return lastSuccessfulAi;
}

export async function fetchOtherTokens(): Promise<TokenData[]> {
  const hydrated = getHydratedData('otherTokens') as ListOtherTokensResponse | undefined;
  if (hydrated?.tokens?.length) {
    const mapped = hydrated.tokens.map(toTokenData).filter(t => t.price > 0);
    if (mapped.length > 0) { lastSuccessfulOther = mapped; return mapped; }
  }

  const resp = await otherBreaker.execute(async () => {
    return client.listOtherTokens({});
  }, emptyOtherTokensFallback);

  const results = resp.tokens.map(toTokenData).filter(t => t.price > 0);
  if (results.length > 0) { lastSuccessfulOther = results; return results; }
  return lastSuccessfulOther;
}
