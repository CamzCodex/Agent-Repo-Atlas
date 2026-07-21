#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT_DIR = resolve(SCRIPT_DIR, '..');

const PROVIDER_GROUPS = Object.freeze([
  { name: 'Local or hosted AI', anyOf: ['LLM_API_URL', 'OPENROUTER_API_KEY', 'GROQ_API_KEY'] },
  { name: 'Equities and earnings', anyOf: ['FINNHUB_API_KEY'] },
  { name: 'US macro data', anyOf: ['FRED_API_KEY'] },
  { name: 'Energy data', anyOf: ['EIA_API_KEY'] },
  { name: 'Conflict events', anyOf: ['ACLED_EMAIL', 'ACLED_ACCESS_TOKEN'] },
  { name: 'Wildfire detections', anyOf: ['NASA_FIRMS_API_KEY'] },
  { name: 'Maritime AIS', anyOf: ['AISSTREAM_API_KEY'] },
  { name: 'Aviation data', anyOf: ['AVIATIONSTACK_API'] },
  { name: 'Internet outages', anyOf: ['CLOUDFLARE_API_TOKEN'] },
]);

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function countFiles(path) {
  if (!(await pathExists(path))) return 0;
  let count = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) count += await countFiles(child);
    else if (entry.isFile()) count += 1;
  }
  return count;
}

export function extractEnvKeys(text) {
  const keys = new Set();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match?.[1]) keys.add(match[1]);
  }
  return keys;
}

function parseNodeMajor(version) {
  const match = version.trim().match(/^v?(\d+)/);
  return match ? Number(match[1]) : null;
}

function defaultCommandProbe(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
    timeout: 5_000,
  });
  if (result.status !== 0) return { available: false, version: null };
  const version = (result.stdout || result.stderr || '').trim().split(/\r?\n/, 1)[0] || null;
  return { available: true, version };
}

function check(id, status, summary, detail = null) {
  return { id, status, summary, detail };
}

export async function collectCamzLocalDiagnostics(options = {}) {
  const rootDir = resolve(options.rootDir ?? DEFAULT_ROOT_DIR);
  const env = options.env ?? process.env;
  const nodeVersion = options.nodeVersion ?? process.version;
  const commandProbe = options.commandProbe ?? defaultCommandProbe;
  const now = options.now instanceof Date ? options.now : new Date();
  const checks = [];

  const nvmrc = (await readOptional(resolve(rootDir, '.nvmrc')))?.trim() ?? null;
  const expectedNodeMajor = nvmrc ? parseNodeMajor(nvmrc) : null;
  const actualNodeMajor = parseNodeMajor(nodeVersion);
  if (expectedNodeMajor === null) {
    checks.push(check('node', 'fail', 'Node target is missing or invalid', '.nvmrc could not be read'));
  } else if (actualNodeMajor !== expectedNodeMajor) {
    checks.push(check(
      'node',
      'fail',
      `Node ${nodeVersion} does not match repository target ${expectedNodeMajor}`,
      `Run nvm use ${expectedNodeMajor} (or the equivalent in your version manager)`,
    ));
  } else {
    checks.push(check('node', 'pass', `Node ${nodeVersion} matches target ${expectedNodeMajor}`));
  }

  const packagePath = resolve(rootDir, 'package.json');
  const lockPath = resolve(rootDir, 'package-lock.json');
  checks.push((await pathExists(packagePath))
    ? check('package', 'pass', 'package.json is present')
    : check('package', 'fail', 'package.json is missing'));
  checks.push((await pathExists(lockPath))
    ? check('lockfile', 'pass', 'package-lock.json is present')
    : check('lockfile', 'fail', 'package-lock.json is missing'));

  const dependenciesInstalled = await pathExists(resolve(rootDir, 'node_modules'));
  checks.push(dependenciesInstalled
    ? check('dependencies', 'pass', 'node_modules is present')
    : check('dependencies', 'warn', 'Dependencies are not installed', 'Run npm ci'));

  const git = commandProbe('git', ['--version']);
  checks.push(git.available
    ? check('git', 'pass', git.version ?? 'Git is available')
    : check('git', 'fail', 'Git is not available'));

  const docker = commandProbe('docker', ['--version']);
  checks.push(docker.available
    ? check('docker', 'pass', docker.version ?? 'Docker is available')
    : check('docker', 'warn', 'Docker is not available', 'Only required for the full self-hosted stack'));

  const envFiles = ['.env.local', '.env'];
  const envKeys = new Set(Object.keys(env).filter((key) => Boolean(env[key])));
  const discoveredEnvFiles = [];
  for (const name of envFiles) {
    const content = await readOptional(resolve(rootDir, name));
    if (content === null) continue;
    discoveredEnvFiles.push(name);
    for (const key of extractEnvKeys(content)) envKeys.add(key);
  }
  checks.push(discoveredEnvFiles.length > 0
    ? check('environment', 'pass', `Local environment file found (${discoveredEnvFiles.join(', ')})`)
    : check('environment', 'warn', 'No .env.local or .env file found', 'The base UI runs without one; optional feeds will be degraded'));

  const provenancePath = resolve(rootDir, '.worldmonitor-upstream.json');
  const provenanceText = await readOptional(provenancePath);
  let upstream = null;
  if (provenanceText === null) {
    checks.push(check('vendor-provenance', 'warn', 'Vendor provenance file is missing'));
  } else {
    try {
      upstream = JSON.parse(provenanceText);
      const validCommit = typeof upstream.commit === 'string' && /^[0-9a-f]{40}$/i.test(upstream.commit);
      const validTree = typeof upstream.tree === 'string' && /^[0-9a-f]{40}$/i.test(upstream.tree);
      if (validCommit && validTree) {
        checks.push(check('vendor-provenance', 'pass', `Pinned upstream ${upstream.commit.slice(0, 12)}`));
      } else {
        checks.push(check('vendor-provenance', 'fail', 'Vendor provenance is malformed'));
      }
    } catch {
      checks.push(check('vendor-provenance', 'fail', 'Vendor provenance is not valid JSON'));
    }
  }

  const disabledWorkflowPath = resolve(rootDir, '.github', 'upstream-workflows-disabled');
  const disabledWorkflowCount = await countFiles(disabledWorkflowPath);
  checks.push(disabledWorkflowCount > 0
    ? check('upstream-workflows', 'pass', `${disabledWorkflowCount} upstream workflows preserved in the disabled vendor path`)
    : check('upstream-workflows', 'warn', 'No disabled upstream workflows found', 'This is normal in a dedicated fork with native workflow permission'));

  const providerGroups = PROVIDER_GROUPS.map((group) => ({
    name: group.name,
    configured: group.anyOf.some((key) => envKeys.has(key)),
    acceptedKeys: [...group.anyOf],
  }));
  const configuredProviderGroups = providerGroups.filter((group) => group.configured).length;
  checks.push(configuredProviderGroups > 0
    ? check('optional-providers', 'pass', `${configuredProviderGroups}/${providerGroups.length} optional provider groups configured`)
    : check('optional-providers', 'warn', 'No optional provider groups detected', 'Public no-key feeds and the base dashboard still work'));

  const ok = checks.every((item) => item.status !== 'fail');
  const ready = ok && dependenciesInstalled;

  return {
    schemaVersion: 'camz-worldmonitor-local-diagnostics-v1',
    generatedAt: Number.isFinite(now.getTime()) ? now.toISOString() : null,
    rootDir,
    ok,
    ready,
    checks,
    providerGroups,
    upstream: upstream && typeof upstream === 'object'
      ? {
          repository: typeof upstream.repository === 'string' ? upstream.repository : null,
          commit: typeof upstream.commit === 'string' ? upstream.commit : null,
          tree: typeof upstream.tree === 'string' ? upstream.tree : null,
        }
      : null,
  };
}

export function renderCamzLocalDiagnostics(report) {
  const marker = { pass: 'PASS', warn: 'WARN', fail: 'FAIL' };
  const lines = [
    'Camz World Monitor local diagnostics',
    `Overall: ${report.ready ? 'READY' : report.ok ? 'SETUP REQUIRED' : 'BLOCKED'}`,
    '',
  ];
  for (const item of report.checks) {
    lines.push(`[${marker[item.status]}] ${item.summary}`);
    if (item.detail) lines.push(`       ${item.detail}`);
  }
  lines.push('', 'Optional providers (presence only; secret values are never printed):');
  for (const group of report.providerGroups) {
    lines.push(`  [${group.configured ? 'SET' : '---'}] ${group.name}`);
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const knownArgs = new Set(['--json', '--strict']);
  for (const arg of args) {
    if (!knownArgs.has(arg)) {
      console.error(`Unknown argument: ${arg}`);
      process.exitCode = 2;
      return;
    }
  }

  const report = await collectCamzLocalDiagnostics();
  if (args.has('--json')) console.log(JSON.stringify(report, null, 2));
  else process.stdout.write(renderCamzLocalDiagnostics(report));

  if (!report.ok || (args.has('--strict') && !report.ready)) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
