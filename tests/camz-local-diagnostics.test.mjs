import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import {
  collectCamzLocalDiagnostics,
  extractEnvKeys,
  renderCamzLocalDiagnostics,
} from '../scripts/camz-local-diagnostics.mjs';

const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixtureRoot({ withNodeModules = true } = {}) {
  const root = await mkdtemp(resolve(tmpdir(), 'camz-wm-diagnostics-'));
  roots.push(root);
  await writeFile(resolve(root, '.nvmrc'), '24\n');
  await writeFile(resolve(root, 'package.json'), '{"name":"world-monitor"}\n');
  await writeFile(resolve(root, 'package-lock.json'), '{"lockfileVersion":3}\n');
  await writeFile(resolve(root, '.worldmonitor-upstream.json'), JSON.stringify({
    repository: 'koala73/worldmonitor',
    commit: '9c51d04b2f0873f940227774ef8d65ce6d12900d',
    tree: 'b8b9440111baae7eddd26b5b361d647591be1921',
  }));
  await mkdir(resolve(root, '.github', 'upstream-workflows-disabled'), { recursive: true });
  await writeFile(resolve(root, '.github', 'upstream-workflows-disabled', 'test.yml'), 'name: test\n');
  if (withNodeModules) await mkdir(resolve(root, 'node_modules'));
  return root;
}

const commandProbe = (command) => command === 'git'
  ? { available: true, version: 'git version 2.47.0' }
  : { available: false, version: null };

describe('extractEnvKeys', () => {
  it('extracts only assignment names, including export syntax', () => {
    const keys = extractEnvKeys(`
      # ignored
      FINNHUB_API_KEY=secret
      export FRED_API_KEY="another-secret"
      not an assignment
      INVALID-KEY=value
    `);
    assert.deepEqual([...keys], ['FINNHUB_API_KEY', 'FRED_API_KEY']);
  });
});

describe('collectCamzLocalDiagnostics', () => {
  it('reports a ready local tree without leaking environment values', async () => {
    const root = await fixtureRoot();
    const secret = 'wm-super-secret-value-that-must-never-appear';
    await writeFile(resolve(root, '.env.local'), `FINNHUB_API_KEY=${secret}\n`);

    const report = await collectCamzLocalDiagnostics({
      rootDir: root,
      env: {},
      nodeVersion: 'v24.4.0',
      commandProbe,
      now: new Date('2026-07-22T06:00:00Z'),
    });

    assert.equal(report.ok, true);
    assert.equal(report.ready, true);
    assert.equal(report.generatedAt, '2026-07-22T06:00:00.000Z');
    assert.equal(report.upstream?.commit, '9c51d04b2f0873f940227774ef8d65ce6d12900d');
    assert.equal(report.providerGroups.find((group) => group.name === 'Equities and earnings')?.configured, true);
    assert.equal(report.checks.find((item) => item.id === 'docker')?.status, 'warn');

    const serialized = JSON.stringify(report);
    const rendered = renderCamzLocalDiagnostics(report);
    assert.ok(!serialized.includes(secret));
    assert.ok(!rendered.includes(secret));
    assert.match(rendered, /Overall: READY/);
    assert.match(rendered, /\[SET\] Equities and earnings/);
  });

  it('blocks readiness when the active Node major differs from .nvmrc', async () => {
    const root = await fixtureRoot();
    const report = await collectCamzLocalDiagnostics({
      rootDir: root,
      env: {},
      nodeVersion: 'v22.16.0',
      commandProbe,
    });

    assert.equal(report.ok, false);
    assert.equal(report.ready, false);
    const nodeCheck = report.checks.find((item) => item.id === 'node');
    assert.equal(nodeCheck?.status, 'fail');
    assert.match(nodeCheck?.summary ?? '', /does not match repository target 24/);
  });

  it('distinguishes an otherwise valid checkout that still needs npm ci', async () => {
    const root = await fixtureRoot({ withNodeModules: false });
    const report = await collectCamzLocalDiagnostics({
      rootDir: root,
      env: { FRED_API_KEY: 'present-but-never-returned' },
      nodeVersion: '24.0.0',
      commandProbe,
    });

    assert.equal(report.ok, true);
    assert.equal(report.ready, false);
    assert.equal(report.checks.find((item) => item.id === 'dependencies')?.status, 'warn');
    assert.match(renderCamzLocalDiagnostics(report), /Overall: SETUP REQUIRED/);
    assert.ok(!JSON.stringify(report).includes('present-but-never-returned'));
  });

  it('fails malformed vendor provenance rather than trusting it', async () => {
    const root = await fixtureRoot();
    await writeFile(resolve(root, '.worldmonitor-upstream.json'), '{"commit":"short"}\n');
    const report = await collectCamzLocalDiagnostics({
      rootDir: root,
      env: {},
      nodeVersion: '24.0.0',
      commandProbe,
    });

    assert.equal(report.ok, false);
    assert.equal(report.checks.find((item) => item.id === 'vendor-provenance')?.status, 'fail');
  });
});
