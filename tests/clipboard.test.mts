import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ClipboardCopyController } from '../src/utils/clipboard.ts';

function fakeDocument(options: { copyResult?: boolean; throwOnCopy?: boolean } = {}): {
  document: Document;
  appended: () => number;
  removed: () => number;
} {
  let appended = 0;
  let removed = 0;
  const textarea = {
    value: '',
    readOnly: false,
    style: {},
    select: () => {},
    remove: () => { removed += 1; },
  };
  const documentRef = {
    body: {
      appendChild: () => { appended += 1; },
    },
    createElement: () => textarea,
    execCommand: () => {
      if (options.throwOnCopy) throw new Error('copy failed');
      return options.copyResult ?? true;
    },
  } as unknown as Document;
  return { document: documentRef, appended: () => appended, removed: () => removed };
}

describe('ClipboardCopyController', () => {
  it('uses the Clipboard API when it succeeds', async () => {
    const controller = new ClipboardCopyController({
      clipboard: { writeText: async () => {} },
      document: null,
    });

    assert.deepEqual(await controller.copy('context'), {
      status: 'copied',
      method: 'clipboard',
    });
  });

  it('falls back after permission rejection and always removes the textarea', async () => {
    const fallback = fakeDocument();
    const controller = new ClipboardCopyController({
      clipboard: { writeText: async () => { throw new Error('denied'); } },
      document: fallback.document,
    });

    assert.deepEqual(await controller.copy('context'), {
      status: 'copied',
      method: 'textarea',
    });
    assert.equal(fallback.appended(), 1);
    assert.equal(fallback.removed(), 1);
  });

  it('times out a hung Clipboard API call before using the fallback', async () => {
    const fallback = fakeDocument();
    const controller = new ClipboardCopyController({
      clipboard: { writeText: () => new Promise<void>(() => {}) },
      document: fallback.document,
    });

    assert.deepEqual(await controller.copy('context', { timeoutMs: 1 }), {
      status: 'copied',
      method: 'textarea',
    });
    assert.equal(fallback.removed(), 1);
  });

  it('cancels in-flight work, blocks re-entrancy, and protects destroyed owners', async () => {
    const fallback = fakeDocument();
    const controller = new ClipboardCopyController({
      clipboard: { writeText: () => new Promise<void>(() => {}) },
      document: fallback.document,
    });

    const first = controller.copy('context', { timeoutMs: 60_000 });
    assert.deepEqual(await controller.copy('context'), { status: 'busy', method: null });
    controller.destroy();

    assert.deepEqual(await first, { status: 'cancelled', method: null });
    assert.deepEqual(await controller.copy('context'), { status: 'cancelled', method: null });
    assert.equal(fallback.appended(), 0);
  });

  it('cleans up the fallback when legacy copy throws', async () => {
    const fallback = fakeDocument({ throwOnCopy: true });
    const controller = new ClipboardCopyController({ clipboard: null, document: fallback.document });

    assert.deepEqual(await controller.copy('context'), { status: 'failed', method: null });
    assert.equal(fallback.removed(), 1);
  });
});
