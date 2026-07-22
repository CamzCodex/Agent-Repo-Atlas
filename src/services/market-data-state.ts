import type { MarketData } from '@/types';
import type { BreakerDataState } from '@/utils/circuit-breaker';

export interface MarketDataDeliveryState {
  /** State associated with the exact array being returned to a consumer. */
  dataState: BreakerDataState;
  /** State of the newest fetch invocation for this symbol set. */
  latestAttemptState: BreakerDataState;
  requestKey: string | null;
}

let arrayStates = new WeakMap<readonly MarketData[], MarketDataDeliveryState>();
const latestAttemptByRequestKey = new Map<string, BreakerDataState>();
const MAX_REQUEST_KEYS = 128;

function copyState(state: BreakerDataState): BreakerDataState {
  return { ...state };
}

function requestKey(symbols: readonly string[]): string {
  return [...new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean))]
    .sort()
    .join(',');
}

function rememberLatestAttempt(key: string, state: BreakerDataState): void {
  if (!key) return;
  latestAttemptByRequestKey.delete(key);
  latestAttemptByRequestKey.set(key, copyState(state));
  while (latestAttemptByRequestKey.size > MAX_REQUEST_KEYS) {
    const oldest = latestAttemptByRequestKey.keys().next().value;
    if (oldest === undefined) break;
    latestAttemptByRequestKey.delete(oldest);
  }
}

export function markMarketDataState(
  data: readonly MarketData[],
  state: BreakerDataState,
  options: {
    latestAttemptState?: BreakerDataState;
    requestSymbols?: readonly string[];
  } = {},
): void {
  const key = options.requestSymbols ? requestKey(options.requestSymbols) : '';
  const latestAttemptState = options.latestAttemptState ?? state;
  arrayStates.set(data, {
    dataState: copyState(state),
    latestAttemptState: copyState(latestAttemptState),
    requestKey: key || null,
  });
  rememberLatestAttempt(key, latestAttemptState);
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
  };
}

export function markLatestMarketRequestState(
  symbols: readonly string[],
  state: BreakerDataState,
): void {
  rememberLatestAttempt(requestKey(symbols), state);
}

export function getLatestMarketRequestState(
  symbols: readonly string[],
): BreakerDataState | null {
  const state = latestAttemptByRequestKey.get(requestKey(symbols));
  return state ? copyState(state) : null;
}

/** Test-only reset for deterministic module-state isolation. */
export function resetMarketDataStateForTests(): void {
  arrayStates = new WeakMap<readonly MarketData[], MarketDataDeliveryState>();
  latestAttemptByRequestKey.clear();
}
