import type { MarketData } from '@/types';
import type { BreakerDataState } from '@/utils/circuit-breaker';

export interface MarketDataDeliveryState {
  /** State associated with the exact array being returned to a consumer. */
  dataState: BreakerDataState;
  /** State of the newest fetch invocation for this symbol set. */
  latestAttemptState: BreakerDataState;
  requestKey: string | null;
  requestToken: MarketRequestToken | null;
}

export interface MarketRequestToken {
  requestId: string;
  requestKey: string;
  invocationSequence: number;
  startedAtMs: number;
  completedAtMs: number | null;
  state: BreakerDataState | null;
}

let arrayStates = new WeakMap<readonly MarketData[], MarketDataDeliveryState>();
const latestRequestByKey = new Map<string, MarketRequestToken>();
let nextInvocationSequence = 0;
const MAX_REQUEST_KEYS = 128;

function copyState(state: BreakerDataState): BreakerDataState {
  return { ...state };
}

function requestKey(symbols: readonly string[]): string {
  return [...new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean))]
    .sort()
    .join(',');
}

function copyRequestToken(token: MarketRequestToken): MarketRequestToken {
  return {
    ...token,
    state: token.state ? copyState(token.state) : null,
  };
}

function rememberLatestRequest(token: MarketRequestToken): void {
  const current = latestRequestByKey.get(token.requestKey);
  if (current && current.invocationSequence > token.invocationSequence) return;

  latestRequestByKey.delete(token.requestKey);
  latestRequestByKey.set(token.requestKey, copyRequestToken(token));
  while (latestRequestByKey.size > MAX_REQUEST_KEYS) {
    const oldest = latestRequestByKey.keys().next().value;
    if (oldest === undefined) break;
    latestRequestByKey.delete(oldest);
  }
}

export function beginMarketRequest(
  symbols: readonly string[],
  options: { requestId?: string; startedAtMs?: number } = {},
): MarketRequestToken {
  const invocationSequence = ++nextInvocationSequence;
  const token: MarketRequestToken = {
    requestId: options.requestId ?? `market-request-${invocationSequence}`,
    requestKey: requestKey(symbols),
    invocationSequence,
    startedAtMs: options.startedAtMs ?? Date.now(),
    completedAtMs: null,
    state: null,
  };
  rememberLatestRequest(token);
  return copyRequestToken(token);
}

export function completeMarketRequest(
  token: MarketRequestToken,
  state: BreakerDataState,
  completedAtMs: number = Date.now(),
): MarketRequestToken {
  const completed: MarketRequestToken = {
    ...token,
    completedAtMs,
    state: copyState(state),
  };
  rememberLatestRequest(completed);
  return copyRequestToken(completed);
}

export function markMarketDataState(
  data: readonly MarketData[],
  state: BreakerDataState,
  options: {
    latestAttemptState?: BreakerDataState;
    requestSymbols?: readonly string[];
    requestToken?: MarketRequestToken;
  } = {},
): void {
  const key = options.requestSymbols ? requestKey(options.requestSymbols) : '';
  const latestAttemptState = options.latestAttemptState ?? state;
  arrayStates.set(data, {
    dataState: copyState(state),
    latestAttemptState: copyState(latestAttemptState),
    requestKey: key || null,
    requestToken: options.requestToken ? copyRequestToken(options.requestToken) : null,
  });
}

/** Compatibility accessor for callers that only understand displayed-data state. */
export function getMarketDataState(
  data: readonly MarketData[],
): BreakerDataState | null {
  const state = arrayStates.get(data)?.dataState;
  return state ? copyState(state) : null;
}

export function getMarketDataDeliveryState(
  data: readonly MarketData[],
): MarketDataDeliveryState | null {
  const state = arrayStates.get(data);
  if (!state) return null;
  return {
    dataState: copyState(state.dataState),
    latestAttemptState: copyState(state.latestAttemptState),
    requestKey: state.requestKey,
    requestToken: state.requestToken ? copyRequestToken(state.requestToken) : null,
  };
}

export function getLatestMarketRequestToken(
  symbols: readonly string[],
): MarketRequestToken | null {
  const token = latestRequestByKey.get(requestKey(symbols));
  return token ? copyRequestToken(token) : null;
}

export function getLatestMarketRequestState(
  symbols: readonly string[],
): BreakerDataState | null {
  const state = latestRequestByKey.get(requestKey(symbols))?.state;
  return state ? copyState(state) : null;
}

/** Test-only reset for deterministic module-state isolation. */
export function resetMarketDataStateForTests(): void {
  arrayStates = new WeakMap<readonly MarketData[], MarketDataDeliveryState>();
  latestRequestByKey.clear();
  nextInvocationSequence = 0;
}
