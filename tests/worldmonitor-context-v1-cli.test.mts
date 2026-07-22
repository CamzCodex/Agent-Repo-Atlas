import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, it } from 'node:test';

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'worldmonitor-context-cli-'));
  roots.push(root);
  return root;
}

describe('World Monitor neutral context v1 CLI', () => {
  it('writes a deterministic session-only payload with a safe summary', async () => {
    const root = await temporaryRoot();
    const output = resolve(root, 'context.json');
    const { stdout } = await execFileAsync(process.execPath, [
      '--import',
      'tsx',
      'scripts/export-worldmonitor-context-v1.mts',
      '--output',
      output,
      '--at',
      '2026-07-22T00:05:00.000Z',
      '--version',
      'test-version',
      '--commit',
      'test-commit',
      '--environment',
      'test',
      '--payload-id',
      'wm-cli-test-001',
    ], { cwd: process.cwd() });

    const payload = JSON.parse(await readFile(output, 'utf8')) as {
      payloadId: string;
      controls: Record<string, boolean>;
      observations: Array<{ measureId: string }>;
      events: Array<{ eventType: string }>;
      warnings: string[];
    };
    assert.equal(payload.payloadId, 'wm-cli-test-001');
    assert.equal(payload.controls.noOrder, true);
    assert.equal(payload.controls.noBroker, true);
    assert.deepEqual(payload.observations.map((item) => item.measureId), [
      'market.session-open',
      'market.early-close',
      'market.calendar-verified',
    ]);
    assert.deepEqual(payload.events.map((item) => item.eventType), ['market-session']);
    assert.ok(payload.warnings.some((item) => item.includes('11 quote observations were excluded')));
    assert.match(stdout, /\[PASS\] 3 observations; 1 events/);
    assert.doesNotMatch(stdout, /test-commit|wm-cli-test-001/);
  });

  it('refuses to replace a symlinked output file', async () => {
    const root = await temporaryRoot();
    const target = resolve(root, 'target.json');
    const output = resolve(root, 'context.json');
    await writeFile(target, '{}\n');
    await symlink(target, output);

    await assert.rejects(
      execFileAsync(process.execPath, [
        '--import',
        'tsx',
        'scripts/export-worldmonitor-context-v1.mts',
        '--output',
        output,
        '--commit',
        'test-commit',
      ], { cwd: process.cwd() }),
      /symlinked context output file/,
    );
  });
});
