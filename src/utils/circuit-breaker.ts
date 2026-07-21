interface CircuitState {
  failures: number;
  cooldownUntil: number;
  lastError?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export type BreakerDataMode = 'live' | 'cached' | 'unavailable';

export interface BreakerDataState {
  mode: BreakerDataMode;
  timestamp: number | null;
  offline: boolean;
}

export interface CircuitBreakerOptions<T = unknown> {
  name: string;
  maxFailures?: number;
  cooldownMs?: number;
  cacheTtlMs?: number;
  /** Persist cache to IndexedDB across page reloads. Default: false.
   *  Opt-in only — cached payloads must be JSON-safe (no Date objects).
   *  Auto-disabled when cacheTtlMs === 0. */
  persistCache?: boolean;
  /** Revive deserialized data after loading from persistent storage.
   *  Use this to convert JSON-parsed strings back to Date objects or other
   *  non-JSON-safe types. Called only on data loaded from IndexedDB. */
  revivePersistedData?: (data: T) => T;
  /** Maximum in-memory cache entries before LRU eviction. Default: 256. */
  maxCacheEntries?: number;
  /** Override the global 24h persistent stale ceiling for this breaker.
   *  Persistent entries older than this are discarded during hydration.
   *  Useful for time-sensitive data (e.g. risk scores → 1h). */
  persistentStaleCeilingMs?: number;
}

const DEFAULT_MAX_FAILURES = 2;
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const PERSISTENT_STALE_CEILING_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CACHE_KEY = '__default__';
const DEFAULT_MAX_CACHE_ENTRIES = 256;

function isDesktopOfflineMode(): boolean {
  if (typeof window === 'undefined') return false;
  const hasTauri = Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__);
  return hasTauri && typeof navigator !== 'undefined' && navigator.onLine === false;
}

export class CircuitBreaker<T> {
  private state: CircuitState = { failures: 0, cooldownUntil: 0 };
  private cache = new Map<string, CacheEntry<T>>();
  private name: string;
  private maxFailures: number;
  private cooldownMs: number;
  private cacheTtlMs: number;
  private persistEnabled: boolean;
  private revivePersistedData: ((data: T) => T) | undefined;
  private persistentLoadedKeys = new Set<string>();
  private persistentLoadPromises = new Map<string, Promise<void>>();
  private lastDataState: BreakerDataState = { mode: 'unavailable', timestamp: null, offline: false };
  private backgroundRefreshPromises = new Map<string, Promise<void>>();
  private maxCacheEntries: number;
  private persistentStaleCeilingMs: number;

  constructor(options: CircuitBreakerOptions<T>) {
    this.name = options.name;
    this.maxFailures = options.maxFailures ?? DEFAULT_MAX_FAILURES;
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.persistEnabled = this.cacheTtlMs === 0
      ? false
      : (options.persistCache ?? false);
    this.revivePersistedData = options.revivePersistedData;
    this.maxCacheEntries = options.maxCacheEntries ?? DEFAULT_MAX_CACHE_ENTRIES;
    const rawCeiling = options.persistentStaleCeilingMs ?? PERSISTENT_STALE_CEILING_MS;
    this.persistentStaleCeilingMs = Number.isFinite(rawCeiling) && rawCeiling >= 0
      ? rawCeiling
      : PERSISTENT_STALE_CEILING_MS;
  }

  private resolveCacheKey(cacheKey?: string): string {
    const key = cacheKey?.trim();
    return key && key.length > 0 ? key : DEFAULT_CACHE_KEY;
  }

  private isStateOnCooldown(): boolean {
    if (Date.now() < this.state.cooldownUntil) return true;
    if (this.state.cooldownUntil > 0) {
      this.state.failures = 0;
      this.state.cooldownUntil = 0;
    }
    return false;
  }

  private getPersistKey(cacheKey: string): string {
    return cacheKey === DEFAULT_CACHE_KEY
      ? `breaker:${this.name}`
      : `breaker:${this.name}:${cacheKey}`;
  }

  private getCacheEntry(cacheKey: string): CacheEntry<T> | null {
    return this.cache.get(cacheKey) ?? null;
  }

  private isCacheEntryFresh(entry: CacheEntry<T>, now = Date.now()): boolean {
    return now - entry.timestamp < this.cacheTtlMs;
  }

  private touchCacheKey(cacheKey: string): void {
    const entry = this.cache.get(cacheKey);
    if (entry !== undefined) {
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, entry);
    }
  }

  private evictCacheKey(cacheKey: string): void {
    this.cache.delete(cacheKey);
    this.backgroundRefreshPromises.delete(cacheKey);
    this.persistentLoadPromises.delete(cacheKey);
    this.persistentLoadedKeys.delete(cacheKey);
  }

  private evictOldest(): void {
    const oldest = this.cache.keys().next().value;
    if (oldest !== undefined) {
      this.evictCacheKey(oldest);
      if (this.persistEnabled) this.deletePersistentCache(oldest);
    }
  }

  private evictIfNeeded(): void {
    while (this.cache.size > this.maxCacheEntries) this.evictOldest();
  }

  private publishDataState(
    state: BreakerDataState,
    onDataState?: (state: BreakerDataState) => void,
  ): void {
    this.lastDataState = state;
    onDataState?.({ ...state });
  }

  private hydratePersistentCache(cacheKey: string): Promise<void> {
    if (this.persistentLoadedKeys.has(cacheKey)) return Promise.resolve();

    const existingPromise = this.persistentLoadPromises.get(cacheKey);
    if (existingPromise) return existingPromise;

    const loadPromise = (async () => {
      try {
        const { getPersistentCache } = await import('../services/persistent-cache');
        const entry = await getPersistentCache<T>(this.getPersistKey(cacheKey));
        if (entry == null || entry.data === undefined || entry.data === null) return;

        const age = Date.now() - entry.updatedAt;
        if (age > this.persistentStaleCeilingMs) return;

        if (this.getCacheEntry(cacheKey) === null) {
          const data = this.revivePersistedData ? this.revivePersistedData(entry.data) : entry.data;
          this.cache.set(cacheKey, { data, timestamp: entry.updatedAt });
          this.evictIfNeeded();
          const withinTtl = (Date.now() - entry.updatedAt) < this.cacheTtlMs;
          this.lastDataState = {
            mode: withinTtl ? 'cached' : 'unavailable',
            timestamp: entry.updatedAt,
            offline: false,
          };
        }
      } catch (err) {
        console.warn(`[${this.name}] Persistent cache hydration failed:`, err);
      } finally {
        this.persistentLoadedKeys.add(cacheKey);
        this.persistentLoadPromises.delete(cacheKey);
      }
    })();

    this.persistentLoadPromises.set(cacheKey, loadPromise);
    return loadPromise;
  }

  private writePersistentCache(data: T, cacheKey: string): void {
    import('../services/persistent-cache').then(({ setPersistentCache }) => {
      setPersistentCache(this.getPersistKey(cacheKey), data).catch(() => {});
    }).catch(() => {});
  }

  private deletePersistentCache(cacheKey: string): void {
    import('../services/persistent-cache').then(({ deletePersistentCache }) => {
      deletePersistentCache(this.getPersistKey(cacheKey)).catch(() => {});
    }).catch(() => {});
  }

  private deleteAllPersistentCache(): void {
    import('../services/persistent-cache').then(({ deletePersistentCache, deletePersistentCacheByPrefix }) => {
      const baseKey = this.getPersistKey(DEFAULT_CACHE_KEY);
      deletePersistentCache(baseKey).catch(() => {});
      deletePersistentCacheByPrefix(`${baseKey}:`).catch(() => {});
    }).catch(() => {});
  }

  isOnCooldown(): boolean {
    return this.isStateOnCooldown();
  }

  getCooldownRemaining(): number {
    if (!this.isStateOnCooldown()) return 0;
    return Math.max(0, Math.ceil((this.state.cooldownUntil - Date.now()) / 1000));
  }

  getStatus(): string {
    if (this.lastDataState.offline) {
      return this.lastDataState.mode === 'cached'
        ? 'offline mode (serving cached data)'
        : 'offline mode (live API unavailable)';
    }
    if (this.isOnCooldown()) {
      return `temporarily unavailable (retry in ${this.getCooldownRemaining()}s)`;
    }
    return 'ok';
  }

  getDataState(): BreakerDataState {
    return { ...this.lastDataState };
  }

  getCached(cacheKey?: string): T | null {
    const resolvedKey = this.resolveCacheKey(cacheKey);
    const entry = this.getCacheEntry(resolvedKey);
    if (entry !== null && this.isCacheEntryFresh(entry)) {
      this.touchCacheKey(resolvedKey);
      return entry.data;
    }
    return null;
  }

  getCachedOrDefault(defaultValue: T, cacheKey?: string): T {
    const resolvedKey = this.resolveCacheKey(cacheKey);
    return this.getCacheEntry(resolvedKey)?.data ?? defaultValue;
  }

  getKnownCacheKeys(): string[] {
    return [...this.cache.keys()];
  }

  private markSuccess(timestamp: number, onDataState?: (state: BreakerDataState) => void): void {
    this.state.failures = 0;
    this.state.cooldownUntil = 0;
    this.state.lastError = undefined;
    this.publishDataState({ mode: 'live', timestamp, offline: false }, onDataState);
  }

  private writeCacheEntry(data: T, cacheKey: string, timestamp: number): void {
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, { data, timestamp });
    this.evictIfNeeded();
    if (this.persistEnabled) this.writePersistentCache(data, cacheKey);
  }

  recordSuccess(data: T, cacheKey?: string): void {
    const resolvedKey = this.resolveCacheKey(cacheKey);
    const now = Date.now();
    this.markSuccess(now);
    this.writeCacheEntry(data, resolvedKey, now);
  }

  clearCache(cacheKey?: string): void {
    if (cacheKey !== undefined) {
      const resolvedKey = this.resolveCacheKey(cacheKey);
      this.evictCacheKey(resolvedKey);
      if (this.persistEnabled) this.deletePersistentCache(resolvedKey);
      return;
    }

    this.cache.clear();
    this.backgroundRefreshPromises.clear();
    this.persistentLoadPromises.clear();
    this.persistentLoadedKeys.clear();
    if (this.persistEnabled) this.deleteAllPersistentCache();
  }

  clearMemoryCache(cacheKey?: string): void {
    if (cacheKey !== undefined) {
      this.evictCacheKey(this.resolveCacheKey(cacheKey));
      return;
    }
    this.cache.clear();
    this.backgroundRefreshPromises.clear();
    this.persistentLoadPromises.clear();
    this.persistentLoadedKeys.clear();
  }

  recordFailure(error?: string): void {
    this.state.failures++;
    this.state.lastError = error;
    if (this.state.failures >= this.maxFailures) {
      this.state.cooldownUntil = Date.now() + this.cooldownMs;
      console.warn(`[${this.name}] On cooldown for ${this.cooldownMs / 1000}s after ${this.state.failures} failures`);
    }
  }

  async execute<R extends T>(
    fn: () => Promise<R>,
    defaultValue: R,
    options: {
      cacheKey?: string;
      shouldCache?: (result: R) => boolean;
      /**
       * Receives the immutable state for this exact return path. Prefer this
       * over reading `getDataState()` after an await when concurrent cache keys
       * may share a breaker.
       */
      onDataState?: (state: BreakerDataState) => void;
      /**
       * When true, an SWR refresh whose result fails `shouldCache` evicts the
       * previous stale entry. Default false preserves last-good market data.
       */
      evictOnRefreshFailure?: boolean;
    } = {},
  ): Promise<R> {
    const offline = isDesktopOfflineMode();
    const cacheKey = this.resolveCacheKey(options.cacheKey);
    const shouldCache = options.shouldCache ?? (() => true);
    const onDataState = options.onDataState;
    const evictOnRefreshFailure = options.evictOnRefreshFailure ?? false;

    if (this.persistEnabled && !this.persistentLoadedKeys.has(cacheKey)) {
      await this.hydratePersistentCache(cacheKey);
    }

    let cachedEntry = this.getCacheEntry(cacheKey);
    if (cachedEntry !== null && !shouldCache(cachedEntry.data as R)) {
      this.evictCacheKey(cacheKey);
      if (this.persistEnabled) this.deletePersistentCache(cacheKey);
      cachedEntry = null;
    }

    if (this.isStateOnCooldown()) {
      console.log(`[${this.name}] Currently unavailable, ${this.getCooldownRemaining()}s remaining`);
      if (cachedEntry !== null) {
        this.publishDataState({ mode: 'cached', timestamp: cachedEntry.timestamp, offline }, onDataState);
        this.touchCacheKey(cacheKey);
        return cachedEntry.data as R;
      }
      this.publishDataState({ mode: 'unavailable', timestamp: null, offline }, onDataState);
      return defaultValue;
    }

    if (cachedEntry !== null && this.isCacheEntryFresh(cachedEntry)) {
      this.publishDataState({ mode: 'cached', timestamp: cachedEntry.timestamp, offline }, onDataState);
      this.touchCacheKey(cacheKey);
      return cachedEntry.data as R;
    }

    if (cachedEntry !== null && this.cacheTtlMs > 0) {
      this.publishDataState({ mode: 'cached', timestamp: cachedEntry.timestamp, offline }, onDataState);
      this.touchCacheKey(cacheKey);
      if (!this.backgroundRefreshPromises.has(cacheKey)) {
        const refreshPromise = fn().then(result => {
          const now = Date.now();
          this.markSuccess(now);
          if (shouldCache(result)) {
            this.writeCacheEntry(result, cacheKey, now);
          } else if (evictOnRefreshFailure) {
            this.evictCacheKey(cacheKey);
            if (this.persistEnabled) this.deletePersistentCache(cacheKey);
          }
        }).catch(e => {
          console.warn(`[${this.name}] Background refresh failed:`, e);
          this.recordFailure(String(e));
        }).finally(() => {
          this.backgroundRefreshPromises.delete(cacheKey);
        });
        this.backgroundRefreshPromises.set(cacheKey, refreshPromise);
      }
      return cachedEntry.data as R;
    }

    try {
      const result = await fn();
      const now = Date.now();
      this.markSuccess(now, onDataState);
      if (shouldCache(result)) this.writeCacheEntry(result, cacheKey, now);
      return result;
    } catch (e) {
      const msg = String(e);
      console.error(`[${this.name}] Failed:`, msg);
      this.recordFailure(msg);
      this.publishDataState({ mode: 'unavailable', timestamp: null, offline }, onDataState);
      return defaultValue;
    }
  }
}

const breakers = new Map<string, CircuitBreaker<unknown>>();

export function createCircuitBreaker<T>(options: CircuitBreakerOptions<T>): CircuitBreaker<T> {
  const breaker = new CircuitBreaker<T>(options);
  breakers.set(options.name, breaker as CircuitBreaker<unknown>);
  return breaker;
}

export function getCircuitBreakerStatus(): Record<string, string> {
  const status: Record<string, string> = {};
  breakers.forEach((breaker, name) => {
    status[name] = breaker.getStatus();
  });
  return status;
}

export function isCircuitBreakerOnCooldown(name: string): boolean {
  const breaker = breakers.get(name);
  return breaker ? breaker.isOnCooldown() : false;
}

export function getCircuitBreakerCooldownInfo(name: string): { onCooldown: boolean; remainingSeconds: number } {
  const breaker = breakers.get(name);
  if (!breaker) return { onCooldown: false, remainingSeconds: 0 };
  return {
    onCooldown: breaker.isOnCooldown(),
    remainingSeconds: breaker.getCooldownRemaining(),
  };
}

export function removeCircuitBreaker(name: string): void {
  breakers.delete(name);
}

export function clearAllCircuitBreakers(): void {
  breakers.clear();
}
