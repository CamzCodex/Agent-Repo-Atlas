import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const breakerUrl = pathToFileURL(resolve(root, 'src/utils/circuit-breaker.ts')).href;

interface Payload {
  value: string;
}

async function loadBreaker(suffix: string) {
  return import(`${breakerUrl}?t=${Date.now()}-${suffix}`);
}

describe('CircuitBreaker per-call data-state contract', () => {
  it('reports live and cached return paths with the original cache timestamp', async () => {
    const { createCircuitBreaker, clearAllCircuitBreakers } = await loadBreaker('live-cached');
    clearAllCircuitBreakers();

    try {
      const breaker = createCircuitBreaker<Payload>({
        name: 'per-call-state-live-cached',
        cacheTtlMs: 60_000,
        persistCache: false,
      });
      const fallback = { value: 'fallback' };
      const liveStates: Array<{ mode: string; timestamp: number | null; offline: boolean }> = [];
      const cachedStates: Array<{ mode: string; timestamp: number | null; offline: boolean }> = [];

      const live = await breaker.execute(async () => ({ value: 'live' }), fallback, {
        cacheKey: 'A',
        onDataState: (state) => liveStates.push(state),
      });
      assert.equal(live.value, 'live');
      assert.equal(liveStates.length, 1);
      assert.equal(liveStates[0]?.mode, 'live');
      assert.equal(typeof liveStates[0]?.timestamp, 'number');

      let liveFnCalled = false;
      const cached = await breaker.execute(async () => {
        liveFnCalled = true;
        return { value: 'unexpected' };
      }, fallback, {
        cacheKey: 'A',
        onDataState: (state) => cachedStates.push(state),
      });

      assert.equal(cached.value, 'live');
      assert.equal(liveFnCalled, false, 'fresh cache hit must not invoke the upstream function');
      assert.equal(cachedStates.length, 1);
      assert.equal(cachedStates[0]?.mode, 'cached');
      assert.equal(cachedStates[0]?.timestamp, liveStates[0]?.timestamp);
      assert.equal(cachedStates[0]?.offline, false);
    } finally {
      clearAllCircuitBreakers();
    }
  });

  it('keeps concurrent cache-key states isolated instead of relying on mutable global state', async () => {
    const { createCircuitBreaker, clearAllCircuitBreakers } = await loadBreaker('key-isolation');
    clearAllCircuitBreakers();
    const originalNow = Date.now;

    try {
      let now = 1_000;
      Date.now = () => now;
      const breaker = createCircuitBreaker<Payload>({
        name: 'per-call-state-key-isolation',
        cacheTtlMs: 10_000,
        persistCache: false,
      });
      breaker.recordSuccess({ value: 'A' }, 'A');
      now = 2_000;
      breaker.recordSuccess({ value: 'B' }, 'B');
      now = 2_500;

      const states = new Map<string, { mode: string; timestamp: number | null }>();
      const [a, b] = await Promise.all([
        breaker.execute(async () => ({ value: 'unexpected-A' }), { value: 'fallback' }, {
          cacheKey: 'A',
          onDataState: (state) => states.set('A', state),
        }),
        breaker.execute(async () => ({ value: 'unexpected-B' }), { value: 'fallback' }, {
          cacheKey: 'B',
          onDataState: (state) => states.set('B', state),
        }),
      ]);

      assert.equal(a.value, 'A');
      assert.equal(b.value, 'B');
      assert.deepEqual(states.get('A'), { mode: 'cached', timestamp: 1_000, offline: false });
      assert.deepEqual(states.get('B'), { mode: 'cached', timestamp: 2_000, offline: false });
    } finally {
      Date.now = originalNow;
      clearAllCircuitBreakers();
    }
  });

  it('reports stale cached data as cached during cooldown instead of unavailable', async () => {
    const { createCircuitBreaker, clearAllCircuitBreakers } = await loadBreaker('cooldown-stale');
    clearAllCircuitBreakers();
    const originalNow = Date.now;

    try {
      let now = 1_000;
      Date.now = () => now;
      const breaker = createCircuitBreaker<Payload>({
        name: 'per-call-state-cooldown-stale',
        cacheTtlMs: 5,
        maxFailures: 1,
        cooldownMs: 10_000,
        persistCache: false,
      });
      breaker.recordSuccess({ value: 'last-good' }, 'A');
      now = 2_000;
      breaker.recordFailure('upstream unavailable');
      now = 3_000;

      let returnedState: { mode: string; timestamp: number | null; offline: boolean } | null = null;
      const result = await breaker.execute(async () => ({ value: 'unexpected-live' }), { value: 'fallback' }, {
        cacheKey: 'A',
        onDataState: (state) => { returnedState = state; },
      });

      assert.equal(result.value, 'last-good');
      assert.deepEqual(returnedState, { mode: 'cached', timestamp: 1_000, offline: false });
    } finally {
      Date.now = originalNow;
      clearAllCircuitBreakers();
    }
  });

  it('passes a defensive state copy to the callback', async () => {
    const { createCircuitBreaker, clearAllCircuitBreakers } = await loadBreaker('defensive-copy');
    clearAllCircuitBreakers();

    try {
      const breaker = createCircuitBreaker<Payload>({
        name: 'per-call-state-copy',
        cacheTtlMs: 60_000,
        persistCache: false,
      });
      await breaker.execute(async () => ({ value: 'live' }), { value: 'fallback' }, {
        onDataState: (state) => {
          state.mode = 'unavailable';
          state.timestamp = null;
          state.offline = true;
        },
      });

      const internal = breaker.getDataState();
      assert.equal(internal.mode, 'live');
      assert.equal(typeof internal.timestamp, 'number');
      assert.equal(internal.offline, false);
    } finally {
      clearAllCircuitBreakers();
    }
  });
});
