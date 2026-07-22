import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LatestRequestGate } from '../src/utils/latest-request-gate.ts';

describe('LatestRequestGate', () => {
  it('makes a newer invocation authoritative before either request completes', () => {
    const gate = new LatestRequestGate();
    const older = gate.begin();
    const newer = gate.begin();

    assert.equal(gate.isCurrent(older), false);
    assert.equal(gate.isCurrent(newer), true);
  });

  it('invalidates in-flight work on lifecycle or mission changes', () => {
    const gate = new LatestRequestGate();
    const inFlight = gate.begin();

    gate.invalidate();

    assert.equal(gate.isCurrent(inFlight), false);
  });
});
