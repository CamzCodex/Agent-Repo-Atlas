import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CORE_MISSION_PRESETS,
  MISSION_PRESET_EXTENSIONS,
  applyMissionPresetToState,
  getAvailableMissionPresets,
  getMissionPreset,
} from '../src/services/mission-presets.ts';

const CORE_IDS = [
  'crisis-desk',
  'supply-chain-risk',
  'energy-security',
  'osint-newsroom',
  'macro-market-watch',
  'tech-ai-watch',
  'good-news-explorer',
];

describe('Australia mission extension registry', () => {
  it('preserves the stable seven-preset v1 core', () => {
    assert.deepEqual(CORE_MISSION_PRESETS.map((preset) => preset.id), CORE_IDS);
  });

  it('registers Australia as the only current extension', () => {
    assert.deepEqual(MISSION_PRESET_EXTENSIONS.map((preset) => preset.id), ['australia-market-watch']);
    const australia = getMissionPreset('australia-market-watch');
    assert.ok(australia);
    assert.deepEqual(australia.variants, ['full', 'finance']);
  });

  it('only exposes Australia in full and finance browser registries', () => {
    assert.ok(getAvailableMissionPresets('full').some((preset) => preset.id === 'australia-market-watch'));
    assert.ok(getAvailableMissionPresets('finance').some((preset) => preset.id === 'australia-market-watch'));
    for (const variant of ['tech', 'happy', 'commodity', 'energy']) {
      assert.equal(
        getAvailableMissionPresets(variant).some((preset) => preset.id === 'australia-market-watch'),
        false,
        `${variant} must not expose the Australia extension`,
      );
    }
  });

  it('accepts Australia only for the explicitly supported variants', () => {
    for (const variant of ['full', 'finance']) {
      assert.equal(
        applyMissionPresetToState('australia-market-watch', {}, undefined, variant).preset.id,
        'australia-market-watch',
      );
    }

    for (const variant of ['tech', 'commodity', 'energy', 'happy']) {
      assert.throws(
        () => applyMissionPresetToState('australia-market-watch', {}, undefined, variant),
        new RegExp(`Mission preset "australia-market-watch" is not available for variant "${variant}"`),
      );
    }
  });

  it('rejects an unknown preset clearly', () => {
    assert.throws(
      () => applyMissionPresetToState('not-a-real-preset' as never, {}, undefined, 'full'),
      /Unknown mission preset: not-a-real-preset/,
    );
  });

  it('does not auto-select US/crypto-specific context panels under the Australia label', () => {
    const australia = getMissionPreset('australia-market-watch');
    assert.ok(australia);
    for (const panel of ['market-breadth', 'macro-signals', 'liquidity-shifts']) {
      assert.equal(australia.panels.includes(panel), false, `${panel} must remain opt-in global context`);
    }
    for (const panel of ['markets', 'commodities', 'macro-tiles', 'economic-calendar', 'supply-chain']) {
      assert.ok(australia.panels.includes(panel), `${panel} should remain in the Australia desk`);
    }
  });
});
