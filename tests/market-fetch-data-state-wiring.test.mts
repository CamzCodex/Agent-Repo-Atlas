import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(
  new URL('../src/services/market/index.ts', import.meta.url),
  'utf8',
);

describe('market fetch per-call data-state wiring', () => {
  it('captures displayed and latest-attempt states from the exact breaker return path', () => {
    assert.match(source, /dataState\?: BreakerDataState/);
    assert.match(source, /latestAttemptState\?: BreakerDataState/);
    assert.match(source, /onDataState: \(state\) => \{ breakerState = state; \}/);
    assert.match(source, /const latestAttemptState = \{ \.\.\.breakerState \}/);
    assert.match(source, /markLatestMarketRequestState\(/);
    assert.doesNotMatch(source, /stockBreaker\.getDataState\(\)/);
    assert.doesNotMatch(source, /commodityBreaker\.getDataState\(\)/);
  });

  it('attaches evidence before callbacks can hand quote arrays to other consumers', () => {
    const stockMark = source.indexOf('markMarketDataState(results, breakerState');
    const stockBatch = source.indexOf('options.onBatch?.(results)', stockMark);
    assert.ok(stockMark >= 0, 'stock results must receive delivery metadata');
    assert.ok(stockBatch > stockMark, 'stock metadata must be attached before onBatch');

    const commodityFunction = source.indexOf('export async function fetchCommodityQuotes');
    const commodityMark = source.indexOf('markMarketDataState(results, breakerState', commodityFunction);
    const commodityBatch = source.indexOf('options.onBatch?.(results)', commodityFunction);
    assert.ok(commodityMark >= commodityFunction, 'commodity results must receive delivery metadata');
    assert.ok(commodityBatch > commodityMark, 'commodity metadata must be attached before onBatch');
    assert.match(source, /latestAttemptState,[\s\S]*requestSymbols:/);
  });

  it('clones last-successful values, bounds retention, and preserves the original timestamp', () => {
    assert.match(source, /const MAX_LAST_SUCCESSFUL_KEYS = 64/);
    assert.match(source, /interface LastSuccessfulMarketResult[\s\S]*timestamp: number/);
    assert.match(source, /function cloneMarketData/);
    assert.match(source, /data: cloneMarketData\(data\)/);
    assert.match(source, /lastSuccessful \? cloneMarketData\(lastSuccessful\.data\) : \[\]/);
    assert.match(source, /mode: 'cached',[\s\S]*timestamp: lastSuccessful\.timestamp/);
    assert.match(source, /latestAttemptState,[\s\S]*requestSymbols: allSymbolStrings/);
    assert.match(source, /while \(lastSuccessfulByKey\.size > MAX_LAST_SUCCESSFUL_KEYS\)/);
  });

  it('preserves the complete market service while adding Australia provenance', () => {
    for (const exportedFunction of [
      'fetchMultipleStocks',
      'fetchStockQuote',
      'fetchCommodityQuotes',
      'fetchSectors',
      'fetchCrypto',
      'fetchCryptoSectors',
      'fetchDefiTokens',
      'fetchAiTokens',
      'fetchOtherTokens',
    ]) {
      assert.match(
        source,
        new RegExp(`export async function ${exportedFunction}\\b`),
        `${exportedFunction} must remain exported`,
      );
    }
  });
});
