#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const DEFAULT_URL = 'http://127.0.0.1:3000';
const DEFAULT_TIMEOUT_MS = 10_000;

function check(id, status, summary, detail = null) {
  return { id, status, summary, detail };
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Smoke-test URL must use http or https.');
  }
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  url.search = '';
  url.hash = '';
  return url;
}

async function request(url, timeoutMs) {
  try {
    const response = await fetch(url, {
      headers: { Accept: '*/*', 'User-Agent': 'camz-worldmonitor-local-smoke/1' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.text();
    return {
      ok: true,
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      contentType: '',
      body: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function isSuccessfulHttp(result) {
  return result.ok && result.status >= 200 && result.status < 400;
}

function jsonBody(result) {
  if (!result.ok || !result.contentType.toLowerCase().includes('application/json')) return null;
  try {
    return JSON.parse(result.body);
  } catch {
    return null;
  }
}

function entryScriptPath(html) {
  return html.match(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i)?.[1] ?? null;
}

export async function probeCamzLocal(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_URL);
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? Math.floor(options.timeoutMs)
    : DEFAULT_TIMEOUT_MS;
  const requireStack = options.requireStack === true;
  const requireDataReady = options.requireDataReady === true;
  const checks = [];

  const rootUrl = new URL(baseUrl);
  rootUrl.pathname = `${baseUrl.pathname.replace(/\/$/, '')}/`;
  const root = await request(rootUrl, timeoutMs);
  if (!isSuccessfulHttp(root)) {
    checks.push(check(
      'dashboard',
      'fail',
      `Dashboard did not respond at ${rootUrl.origin}${rootUrl.pathname}`,
      root.error ?? `HTTP ${root.status}`,
    ));
  } else if (!root.contentType.toLowerCase().includes('text/html') || !/<html\b/i.test(root.body)) {
    checks.push(check('dashboard', 'fail', 'Dashboard response was not HTML'));
  } else {
    checks.push(check('dashboard', 'pass', `Dashboard HTML responded (HTTP ${root.status})`));
  }

  const entryPath = root.ok ? entryScriptPath(root.body) : null;
  if (!entryPath) {
    checks.push(check('entry', 'fail', 'Dashboard HTML did not declare a module entry script'));
  } else {
    const entryUrl = new URL(entryPath, rootUrl);
    const entry = await request(entryUrl, timeoutMs);
    checks.push(isSuccessfulHttp(entry)
      ? check('entry', 'pass', `Application entry loaded (HTTP ${entry.status})`)
      : check('entry', 'fail', 'Application entry did not load', entry.error ?? `HTTP ${entry.status}`));
  }

  const sidecarUrl = new URL('/api/sidecar-health', baseUrl);
  const sidecar = await request(sidecarUrl, timeoutMs);
  const sidecarPayload = jsonBody(sidecar);
  const stackDetected = isSuccessfulHttp(sidecar) && sidecarPayload?.status === 'ok';
  if (stackDetected) {
    checks.push(check('sidecar', 'pass', `Local API sidecar is healthy (${sidecarPayload.mode ?? 'unknown mode'})`));
  } else if (requireStack) {
    checks.push(check(
      'sidecar',
      'fail',
      'Full-stack sidecar health check failed',
      sidecar.error ?? `HTTP ${sidecar.status}; expected JSON {"status":"ok"}`,
    ));
  } else {
    checks.push(check('sidecar', 'warn', 'No Docker/desktop sidecar detected; treating target as Vite development mode'));
  }

  let dataStatus = null;
  if (stackDetected) {
    const healthUrl = new URL('/api/health?compact=1', baseUrl);
    const health = await request(healthUrl, timeoutMs);
    const healthPayload = jsonBody(health);
    dataStatus = typeof healthPayload?.status === 'string' ? healthPayload.status : null;
    const redisDown = health.status === 503 || dataStatus === 'REDIS_DOWN';
    if (!isSuccessfulHttp(health) || !healthPayload || redisDown) {
      checks.push(check(
        'data-health',
        'fail',
        'Data-health endpoint could not verify the local Redis path',
        health.error ?? `HTTP ${health.status}; status ${dataStatus ?? 'unreadable'}`,
      ));
    } else if (dataStatus === 'HEALTHY' || dataStatus === 'OK') {
      checks.push(check('data-health', 'pass', `Data-health endpoint reports ${dataStatus}`));
    } else {
      checks.push(check(
        'data-health',
        requireDataReady ? 'fail' : 'warn',
        `Data-health endpoint reports ${dataStatus ?? 'DEGRADED'}`,
        'Run the local seeders, then repeat with --require-data-ready when operational coverage is expected.',
      ));
    }
  }

  const ok = checks.every((item) => item.status !== 'fail');
  return {
    schemaVersion: 'camz-worldmonitor-local-smoke-v1',
    checkedAt: new Date().toISOString(),
    baseUrl: baseUrl.toString().replace(/\/$/, ''),
    mode: stackDetected ? 'full-stack' : 'vite-development',
    stackDetected,
    dataStatus,
    ok,
    checks,
  };
}

export function renderCamzLocalSmoke(report) {
  const labels = { pass: 'PASS', warn: 'WARN', fail: 'FAIL' };
  const lines = [
    'Camz World Monitor local smoke test',
    `Target: ${report.baseUrl}`,
    `Mode: ${report.mode}`,
    `Overall: ${report.ok ? 'PASS' : 'FAIL'}`,
    '',
  ];
  for (const item of report.checks) {
    lines.push(`[${labels[item.status]}] ${item.summary}`);
    if (item.detail) lines.push(`       ${item.detail}`);
  }
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--stack') options.requireStack = true;
    else if (arg === '--require-data-ready') options.requireDataReady = true;
    else if (arg === '--url') {
      const value = argv[i + 1];
      if (!value) throw new Error('--url requires a value.');
      options.baseUrl = value;
      i += 1;
    } else if (arg === '--timeout-ms') {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value < 1) throw new Error('--timeout-ms requires a positive integer.');
      options.timeoutMs = value;
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await probeCamzLocal(options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else process.stdout.write(renderCamzLocalSmoke(report));
  if (!report.ok) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  });
}
