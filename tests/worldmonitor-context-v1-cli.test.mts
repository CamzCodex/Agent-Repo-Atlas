import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, it } from 'node:test';

import { repositoryCommit } from '../scripts/export-worldmonitor-context-v1.mts';

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

  it('refuses to claim HEAD provenance when tracked producer files are dirty', async () => {
    const root = await temporaryRoot();
    await execFileAsync('git', ['init'], { cwd: root });
    await writeFile(resolve(root, 'producer.txt'), 'clean\n');
    await execFileAsync('git', ['add', 'producer.txt'], { cwd: root });
    await execFileAsync('git', [
      '-c',
      'user.name=World Monitor Test',
      '-c',
      'user.email=worldmonitor-test@example.invalid',
      'commit',
      '-m',
      'test fixture',
    ], { cwd: root });

    assert.match(repositoryCommit(root), /^[0-9a-f]{40}$/);
    await writeFile(resolve(root, 'producer.txt'), 'dirty\n');
    assert.throws(
      () => repositoryCommit(root),
      /clean producer commit/,
    );
  });
});
