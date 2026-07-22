import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import {
  ensureCamzStackEnvironment,
  renderCamzStackEnvironment,
} from '../scripts/camz-stack-env.mjs';
import {
  probeCamzLocal,
  renderCamzLocalSmoke,
} from '../scripts/camz-local-smoke.mjs';
import { listSeeders, runCamzSeeders } from '../scripts/camz-run-seeders.mjs';

const temporaryRoots = [];
const servers = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolveClose) => server.close(resolveClose))));
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryRoot() {
  const root = await mkdtemp(resolve(tmpdir(), 'camz-local-operations-'));
  temporaryRoots.push(root);
  return root;
}

async function listen(handler) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return `http://127.0.0.1:${address.port}`;
}

function respond(res, status, contentType, body) {
  res.writeHead(status, { 'content-type': contentType });
  res.end(body);
}

describe('Camz stack environment initialization', () => {
  it('generates all required local secrets without printing their values', async () => {
    const root = await temporaryRoot();
    let byte = 0;
    const report = await ensureCamzStackEnvironment({
      rootDir: root,
      randomBytes(size) {
        byte += 1;
        return Buffer.alloc(size, byte);
      },
    });

    assert.equal(report.ok, true);
    assert.deepEqual(report.generatedKeys, ['RELAY_SHARED_SECRET', 'REDIS_PASSWORD', 'REDIS_TOKEN']);
    const content = await readFile(resolve(root, '.env'), 'utf8');
    assert.match(content, /^RELAY_SHARED_SECRET=(?:01){32}$/m);
    assert.match(content, /^REDIS_PASSWORD=(?:02){32}$/m);
    assert.match(content, /^REDIS_TOKEN=(?:03){32}$/m);
    const rendered = renderCamzStackEnvironment(report);
    assert.ok(!rendered.includes('01010101'));
    assert.ok(!JSON.stringify(report).includes('01010101'));

    const check = await ensureCamzStackEnvironment({ rootDir: root, checkOnly: true });
    assert.equal(check.ok, true);
    assert.deepEqual(check.missingKeys, []);
  });

  it('preserves configured values and fills only missing or empty assignments', async () => {
    const root = await temporaryRoot();
    const existingSecret = 'existing-secret-that-must-not-be-returned';
    await writeFile(resolve(root, '.env'), [
      `RELAY_SHARED_SECRET=${existingSecret}`,
      'REDIS_PASSWORD=',
      '# REDIS_TOKEN intentionally absent',
      'FINNHUB_API_KEY=provider-key',
      '',
    ].join('\n'));

    const report = await ensureCamzStackEnvironment({
      rootDir: root,
      randomBytes: (size) => Buffer.alloc(size, 4),
    });
    const content = await readFile(resolve(root, '.env'), 'utf8');
    assert.match(content, new RegExp(`^RELAY_SHARED_SECRET=${existingSecret}$`, 'm'));
    assert.match(content, /^REDIS_PASSWORD=(?:04){32}$/m);
    assert.match(content, /^REDIS_TOKEN=(?:04){32}$/m);
    assert.match(content, /^FINNHUB_API_KEY=provider-key$/m);
    assert.ok(!JSON.stringify(report).includes(existingSecret));
  });

  it('refuses to update a symlinked environment file', async () => {
    const root = await temporaryRoot();
    const target = resolve(root, 'target.env');
    await writeFile(target, 'REDIS_TOKEN=target\n');
    await symlink(target, resolve(root, '.env'));
    await assert.rejects(
      ensureCamzStackEnvironment({ rootDir: root }),
      /symlinked \.env/,
    );
  });

  it('reads a complete symlinked worktree environment without mutating it', async () => {
    const root = await temporaryRoot();
    const target = resolve(root, 'target.env');
    await writeFile(target, [
      'RELAY_SHARED_SECRET=relay-secret',
      'REDIS_PASSWORD=redis-password',
      'REDIS_TOKEN=redis-token',
      '',
    ].join('\n'));
    await symlink(target, resolve(root, '.env'));

    const check = await ensureCamzStackEnvironment({ rootDir: root, checkOnly: true });
    assert.equal(check.ok, true);
    assert.deepEqual(check.missingKeys, []);

    const init = await ensureCamzStackEnvironment({ rootDir: root });
    assert.equal(init.ok, true);
    assert.deepEqual(init.generatedKeys, []);
    assert.match(await readFile(target, 'utf8'), /^REDIS_TOKEN=redis-token$/m);
  });
});

describe('Camz local smoke probe', () => {
  it('accepts a Vite development server and reports the absent sidecar as a warning', async () => {
    const baseUrl = await listen((req, res) => {
      if (req.url === '/src/main.ts') return respond(res, 200, 'application/javascript', 'export {};');
      return respond(res, 200, 'text/html', '<html><body><script type="module" src="/src/main.ts"></script></body></html>');
    });
    const report = await probeCamzLocal({ baseUrl, timeoutMs: 1_000 });
    assert.equal(report.ok, true);
    assert.equal(report.mode, 'vite-development');
    assert.equal(report.checks.find((item) => item.id === 'sidecar')?.status, 'warn');
    assert.match(renderCamzLocalSmoke(report), /Overall: PASS/);
  });

  it('verifies dashboard, bundle, sidecar and data health for the full stack', async () => {
    const baseUrl = await listen((req, res) => {
      if (req.url === '/assets/app.js') return respond(res, 200, 'application/javascript', 'export {};');
      if (req.url === '/api/sidecar-health') {
        return respond(res, 200, 'application/json', JSON.stringify({ status: 'ok', mode: 'docker' }));
      }
      if (req.url === '/api/health?compact=1') {
        return respond(res, 200, 'application/json', JSON.stringify({ status: 'HEALTHY' }));
      }
      return respond(res, 200, 'text/html', '<html><body><script type="module" src="/assets/app.js"></script></body></html>');
    });
    const report = await probeCamzLocal({ baseUrl, requireStack: true, requireDataReady: true });
    assert.equal(report.ok, true);
    assert.equal(report.mode, 'full-stack');
    assert.equal(report.dataStatus, 'HEALTHY');
  });

  it('fails a full-stack smoke test when Redis data health is down', async () => {
    const baseUrl = await listen((req, res) => {
      if (req.url === '/assets/app.js') return respond(res, 200, 'application/javascript', 'export {};');
      if (req.url === '/api/sidecar-health') {
        return respond(res, 200, 'application/json', JSON.stringify({ status: 'ok', mode: 'docker' }));
      }
      if (req.url === '/api/health?compact=1') {
        return respond(res, 503, 'application/json', JSON.stringify({ status: 'REDIS_DOWN' }));
      }
      return respond(res, 200, 'text/html', '<html><body><script type="module" src="/assets/app.js"></script></body></html>');
    });
    const report = await probeCamzLocal({ baseUrl, requireStack: true });
    assert.equal(report.ok, false);
    assert.equal(report.checks.find((item) => item.id === 'data-health')?.status, 'fail');
  });

  it('fails a full-stack smoke test on a JSON HTTP 500 health response', async () => {
    const baseUrl = await listen((req, res) => {
      if (req.url === '/assets/app.js') return respond(res, 200, 'application/javascript', 'export {};');
      if (req.url === '/api/sidecar-health') {
        return respond(res, 200, 'application/json', JSON.stringify({ status: 'ok', mode: 'docker' }));
      }
      if (req.url === '/api/health?compact=1') {
        return respond(res, 500, 'application/json', JSON.stringify({ error: 'internal failure' }));
      }
      return respond(res, 200, 'text/html', '<html><body><script type="module" src="/assets/app.js"></script></body></html>');
    });
    const report = await probeCamzLocal({ baseUrl, requireStack: true });
    assert.equal(report.ok, false);
    assert.equal(report.checks.find((item) => item.id === 'data-health')?.status, 'fail');
  });
});

describe('Camz cross-platform seeder discovery', () => {
  it('lists only executable seed modules in deterministic order', async () => {
    const root = await temporaryRoot();
    await mkdir(resolve(root, 'scripts'));
    await Promise.all([
      writeFile(resolve(root, 'scripts', 'seed-zulu.mjs'), ''),
      writeFile(resolve(root, 'scripts', 'seed-alpha.mjs'), ''),
      writeFile(resolve(root, 'scripts', 'seed-alpha.test.mjs'), ''),
      writeFile(resolve(root, 'scripts', '_seed-helper.mjs'), ''),
    ]);
    const names = await listSeeders({ scriptsDir: resolve(root, 'scripts') });
    assert.deepEqual(names, ['seed-alpha.mjs', 'seed-zulu.mjs']);
    const filtered = await listSeeders({ scriptsDir: resolve(root, 'scripts'), match: 'zulu' });
    assert.deepEqual(filtered, ['seed-zulu.mjs']);
  });

  it('never masks a nonzero seeder exit as a skip based on its error text', async () => {
    const root = await temporaryRoot();
    const scriptsDir = resolve(root, 'scripts');
    await mkdir(scriptsDir);
    await writeFile(resolve(scriptsDir, 'seed-failure.mjs'), [
      "console.error('Fossil series not found');",
      'process.exit(1);',
      '',
    ].join('\n'));
    await writeFile(resolve(scriptsDir, 'seed-skip.mjs'), [
      "console.log('OPTIONAL_API_KEY not set - skipping');",
      'process.exit(0);',
      '',
    ].join('\n'));

    const results = await runCamzSeeders({
      rootDir: root,
      scriptsDir,
      skipEnvFile: true,
      env: { REDIS_TOKEN: 'test-token' },
      timeoutSeconds: 5,
    });
    assert.deepEqual(results.map(({ name, status, exitCode }) => ({ name, status, exitCode })), [
      { name: 'seed-failure.mjs', status: 'failed', exitCode: 1 },
      { name: 'seed-skip.mjs', status: 'skipped', exitCode: 0 },
    ]);
  });
});

describe('Camz local operations wiring', () => {
  it('passes the same fail-closed relay secret to the dashboard and relay containers', async () => {
    const compose = await readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8');
    const matches = compose.match(/RELAY_SHARED_SECRET:\s*"\$\{RELAY_SHARED_SECRET:\?/g) ?? [];
    assert.equal(matches.length, 2);
    assert.match(compose, /WS_RELAY_URL:\s*"http:\/\/ais-relay:3004"/);
  });

  it('exposes setup, verification, startup, stack and smoke commands', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    for (const name of [
      'camz:setup',
      'camz:verify',
      'camz:start',
      'camz:smoke',
      'camz:context:export',
      'camz:stack:init',
      'camz:stack:up',
      'camz:stack:seed',
      'camz:stack:smoke',
    ]) {
      assert.equal(typeof pkg.scripts[name], 'string', `${name} must be an npm script`);
    }
  });

  it('does not watch non-runtime trees during local Vite development', async () => {
    const vite = await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8');
    for (const path of ['**/tests/**', '**/docs/**', '**/e2e/**', '**/blog-site/**']) {
      assert.ok(vite.includes(`'${path}'`), `${path} must be ignored by the dev watcher`);
    }
  });
});
