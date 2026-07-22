#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { chmod, lstat, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT_DIR = resolve(SCRIPT_DIR, '..');
export const REQUIRED_STACK_SECRETS = Object.freeze([
  'RELAY_SHARED_SECRET',
  'REDIS_PASSWORD',
  'REDIS_TOKEN',
]);

function assignmentPattern(key) {
  return new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`, 'm');
}

function assignedValue(text, key) {
  const match = text.match(new RegExp(`^(?:export[ \\t]+)?${key}[ \\t]*=[ \\t]*(.*)$`, 'm'));
  if (!match) return null;
  const value = match[1].trim();
  if (value === '' || value === "''" || value === '""') return '';
  return value;
}

async function readEnvironmentFile(path) {
  try {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error('Refusing to update a symlinked .env file.');
    if (!stat.isFile()) throw new Error('.env exists but is not a regular file.');
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function generatedSecret(generator) {
  return generator(32).toString('hex');
}

export async function ensureCamzStackEnvironment(options = {}) {
  const rootDir = resolve(options.rootDir ?? DEFAULT_ROOT_DIR);
  const path = resolve(rootDir, '.env');
  const checkOnly = options.checkOnly === true;
  const generator = options.randomBytes ?? randomBytes;
  const existing = await readEnvironmentFile(path);
  let content = existing ?? [
    '# Camz World Monitor local self-hosted stack',
    '# Generated values are local-only. Add optional provider keys below.',
    'WM_PORT=3000',
    '',
  ].join('\n');

  const configured = [];
  const missing = [];
  for (const key of REQUIRED_STACK_SECRETS) {
    const value = assignedValue(content, key);
    if (value) {
      configured.push(key);
      continue;
    }
    missing.push(key);
    if (checkOnly) continue;
    const assignment = `${key}=${generatedSecret(generator)}`;
    if (assignmentPattern(key).test(content)) {
      content = content.replace(assignmentPattern(key), assignment);
    } else {
      if (!content.endsWith('\n')) content += '\n';
      content += `${assignment}\n`;
    }
  }

  if (!checkOnly && missing.length > 0) {
    const temporaryPath = `${path}.tmp-${process.pid}`;
    await writeFile(temporaryPath, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await rename(temporaryPath, path);
    await chmod(path, 0o600).catch(() => {});
  }

  return {
    schemaVersion: 'camz-worldmonitor-stack-env-v1',
    path,
    ok: checkOnly ? missing.length === 0 : true,
    created: existing === null && !checkOnly,
    generatedKeys: checkOnly ? [] : missing,
    configuredKeys: configured,
    missingKeys: checkOnly ? missing : [],
  };
}

export function renderCamzStackEnvironment(report) {
  const lines = ['Camz World Monitor stack environment'];
  if (report.ok) {
    lines.push('[PASS] Required local stack secrets are configured.');
  } else {
    lines.push(`[FAIL] Missing required keys: ${report.missingKeys.join(', ')}`);
    lines.push('       Run: npm run camz:stack:init');
  }
  if (report.generatedKeys.length > 0) {
    lines.push(`[PASS] Generated local-only values for: ${report.generatedKeys.join(', ')}`);
  }
  lines.push('Secret values were not printed.');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const known = new Set(['--check', '--json']);
  for (const arg of args) if (!known.has(arg)) throw new Error(`Unknown argument: ${arg}`);
  const report = await ensureCamzStackEnvironment({ checkOnly: args.has('--check') });
  if (args.has('--json')) console.log(JSON.stringify(report, null, 2));
  else process.stdout.write(renderCamzStackEnvironment(report));
  if (!report.ok) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  });
}
