import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(
  new URL('../src/services/market/index.ts', import.meta.url),
  'utf8',
);

describe('market fetch per-call data-state wiring', () => {
  it('captures the state from the exact breaker return path', () => {
    assert.match(source, /dataState\?: BreakerDataState/);
    assert.match(source, /onDataState: \(state\) => \{ dataState = state; \}/);
    assert.doesNotMatch(source, /stockBreaker\.getDataState\(\)/);
    assert.doesNotMatch(source, /commodityBreaker\.getDataState\(\)/);
  });

  it('attaches evidence to both stock and commodity quote arrays', () => {
    assert.match(source, /markMarketDataState\(data, dataState\)/);
    assert.match(source, /markMarketDataState\(results, dataState\)/);
    assert.match(source, /return \{ data: results, dataState: \{ \.\.\.dataState \} \}/);
  });

  it('bounds last-successful symbol-set retention and preserves its timestamp', () => {
    assert.match(source, /const MAX_LAST_SUCCESSFUL_KEYS = 64/);
    assert.match(source, /interface LastSuccessfulMarketResult[\s\S]*timestamp: number/);
    assert.match(source, /mode: 'cached',[\s\S]*timestamp: lastSuccessful\.timestamp/);
    assert.match(source, /while \(lastSuccessfulByKey\.size > MAX_LAST_SUCCESSFUL_KEYS\)/);
  });
});
