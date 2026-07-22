#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TIMEOUT_SECONDS = 1_800;

function parseArgs(argv) {
  const options = { list: false, match: null, timeoutSeconds: DEFAULT_TIMEOUT_SECONDS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--list') options.list = true;
    else if (arg === '--match') {
      if (!argv[i + 1]) throw new Error('--match requires a substring.');
      options.match = argv[i + 1];
      i += 1;
    } else if (arg === '--timeout') {
      const seconds = Number(argv[i + 1]);
      if (!Number.isInteger(seconds) || seconds < 0) throw new Error('--timeout requires a non-negative integer.');
      options.timeoutSeconds = seconds;
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

export async function listSeeders(options = {}) {
  const scriptsDir = resolve(options.scriptsDir ?? SCRIPT_DIR);
  const entries = await readdir(scriptsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^seed-.*\.mjs$/.test(entry.name) && !entry.name.endsWith('.test.mjs'))
    .map((entry) => entry.name)
    .filter((name) => !options.match || name.includes(options.match))
    .sort();
}

function lastMeaningfulLine(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1) ?? '';
}

function runSeeder(path, { env, timeoutSeconds, isBundle }) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [path], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    const append = (chunk) => {
      output += chunk.toString();
      if (output.length > 128 * 1024) output = output.slice(-128 * 1024);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);

    let timedOut = false;
    const timer = !isBundle && timeoutSeconds > 0
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
          setTimeout(() => child.kill('SIGKILL'), 30_000).unref();
        }, timeoutSeconds * 1_000)
      : null;
    timer?.unref();

    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      resolveRun({ code: null, timedOut, output, error: error.message });
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolveRun({ code, timedOut, output, error: null });
    });
  });
}

export async function runCamzSeeders(options = {}) {
  const rootDir = resolve(options.rootDir ?? resolve(SCRIPT_DIR, '..'));
  const scriptsDir = resolve(options.scriptsDir ?? resolve(rootDir, 'scripts'));
  let fileEnv = {};
  if (!options.skipEnvFile) {
    try {
      fileEnv = parseEnv(await readFile(resolve(rootDir, '.env'), 'utf8'));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const env = { ...process.env, ...fileEnv, ...(options.env ?? {}) };
  env.UPSTASH_REDIS_REST_URL = env.UPSTASH_REDIS_REST_URL || 'http://127.0.0.1:8079';
  if (env.REDIS_TOKEN) env.UPSTASH_REDIS_REST_TOKEN = env.REDIS_TOKEN;
  if (!env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('REDIS_TOKEN is required. Run npm run camz:stack:init first.');
  }

  const names = await listSeeders({ scriptsDir, match: options.match });
  const results = [];
  for (const name of names) {
    process.stdout.write(`→ ${name} ... `);
    const result = await runSeeder(resolve(scriptsDir, name), {
      env,
      timeoutSeconds: options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS,
      isBundle: name.startsWith('seed-bundle-'),
    });
    const last = lastMeaningfulLine(result.output);
    let status = 'failed';
    if (result.timedOut) status = 'timed-out';
    else if (/skip|not set|missing.*key|not found/i.test(last)) status = 'skipped';
    else if (result.code === 0) status = 'passed';
    const label = { passed: 'OK', skipped: 'SKIP', failed: 'FAIL', 'timed-out': 'TIMEOUT' }[status];
    process.stdout.write(`${label}${last && status !== 'passed' ? ` (${last})` : ''}\n`);
    results.push({ name, status, exitCode: result.code, detail: last || result.error });
  }
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const names = await listSeeders({ match: options.match });
  if (options.list) {
    process.stdout.write(`${names.join('\n')}\n`);
    return;
  }
  const results = await runCamzSeeders(options);
  const totals = Object.groupBy(results, (item) => item.status);
  const count = (key) => totals[key]?.length ?? 0;
  process.stdout.write(`\nDone: ${count('passed')} ok, ${count('skipped')} skipped, ${count('failed')} failed, ${count('timed-out')} timed out\n`);
  if (count('failed') + count('timed-out') > 0) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  });
}
