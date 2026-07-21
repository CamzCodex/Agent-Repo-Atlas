import type { MarketData } from '@/types';
import type { BreakerDataState } from '@/utils/circuit-breaker';

const states = new WeakMap<readonly MarketData[], BreakerDataState>();

export function markMarketDataState(
  data: readonly MarketData[],
  state: BreakerDataState,
): void {
  states.set(data, { ...state });
}

export function getMarketDataState(
  data: readonly MarketData[],
): BreakerDataState | null {
  const state = states.get(data);
  return state ? { ...state } : null;
}
