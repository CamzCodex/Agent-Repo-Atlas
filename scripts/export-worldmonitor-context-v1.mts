#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildAustraliaMarketContextExport } from '../src/services/australia-market-context-export.ts';
import { buildAustraliaMarketDeskSnapshot } from '../src/services/australia-market-desk.ts';
import {
  buildWorldMonitorContextV1,
  serializeWorldMonitorContextV1,
  type WorldMonitorContextV1Export,
} from '../src/services/worldmonitor-context-v1.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT_DIR = resolve(SCRIPT_DIR, '..');
const DEFAULT_OUTPUT = 'tmp/worldmonitor-context-v1.json';
const ENVIRONMENT_CLASSES = new Set<WorldMonitorContextV1Export['producer']['environmentClass']>([
  'development',
  'test',
  'staging',
  'production',
  'self-hosted',
]);

interface ExportOptions {
  rootDir: string;
  outputPath: string;
  at: Date;
  version: string;
  commit: string;
  environmentClass: WorldMonitorContextV1Export['producer']['environmentClass'];
  payloadId?: string;
}

function argumentValue(argv: string[], index: number, name: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
}

async function packageVersion(rootDir: string): Promise<string> {
  const value = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf8')) as { version?: unknown };
  if (typeof value.version !== 'string' || !value.version.trim()) {
    throw new Error('package.json does not contain a valid version.');
  }
  return value.version;
}

export function repositoryCommit(rootDir: string): string {
  try {
    const commit = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const trackedChanges = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=no'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (trackedChanges) {
      throw new Error('Refusing to export from a dirty producer tree; commit or restore tracked changes first.');
    }
    return commit;
  } catch {
    throw new Error('Unable to resolve a clean producer commit; commit or restore tracked changes, or pass --commit explicitly.');
  }
}

async function parseArgs(argv: string[], rootDir = DEFAULT_ROOT_DIR): Promise<ExportOptions> {
  let outputPath = resolve(rootDir, DEFAULT_OUTPUT);
  let at = new Date();
  let version: string | undefined;
  let commit: string | undefined;
  let environmentClass: WorldMonitorContextV1Export['producer']['environmentClass'] = 'self-hosted';
  let payloadId: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output') {
      outputPath = resolve(rootDir, argumentValue(argv, index, arg));
      index += 1;
    } else if (arg === '--at') {
      const value = argumentValue(argv, index, arg);
      at = new Date(value);
      if (!Number.isFinite(at.getTime())) throw new Error('--at requires a valid ISO date/time.');
      index += 1;
    } else if (arg === '--version') {
      version = argumentValue(argv, index, arg);
      index += 1;
    } else if (arg === '--commit') {
      commit = argumentValue(argv, index, arg);
      index += 1;
    } else if (arg === '--environment') {
      const value = argumentValue(argv, index, arg);
      if (!ENVIRONMENT_CLASSES.has(value as WorldMonitorContextV1Export['producer']['environmentClass'])) {
        throw new Error(`Unsupported environment class: ${value}.`);
      }
      environmentClass = value as WorldMonitorContextV1Export['producer']['environmentClass'];
      index += 1;
    } else if (arg === '--payload-id') {
      payloadId = argumentValue(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    rootDir,
    outputPath,
    at,
    version: version ?? await packageVersion(rootDir),
    commit: commit ?? repositoryCommit(rootDir),
    environmentClass,
    ...(payloadId ? { payloadId } : {}),
  };
}

async function refuseUnsafeDestination(outputPath: string): Promise<void> {
  try {
    const stat = await lstat(outputPath);
    if (stat.isSymbolicLink()) throw new Error('Refusing to replace a symlinked context output file.');
    if (!stat.isFile()) throw new Error('Context output path exists but is not a regular file.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
}

export async function exportWorldMonitorContextV1(options: ExportOptions): Promise<{
  outputPath: string;
  context: WorldMonitorContextV1Export;
  bytes: number;
}> {
  const snapshot = buildAustraliaMarketDeskSnapshot([], [], { now: options.at });
  const source = buildAustraliaMarketContextExport(snapshot);
  const context = buildWorldMonitorContextV1(source, {
    version: options.version,
    commit: options.commit,
    environmentClass: options.environmentClass,
    ...(options.payloadId ? { payloadId: options.payloadId } : {}),
  });
  const serialized = serializeWorldMonitorContextV1(context);
  await mkdir(dirname(options.outputPath), { recursive: true });
  await refuseUnsafeDestination(options.outputPath);
  const temporaryPath = `${options.outputPath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, serialized, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  await rename(temporaryPath, options.outputPath);
  return { outputPath: options.outputPath, context, bytes: Buffer.byteLength(serialized) };
}

function renderResult(result: Awaited<ReturnType<typeof exportWorldMonitorContextV1>>): string {
  return [
    'World Monitor neutral context v1 export',
    `[PASS] Wrote ${result.outputPath}`,
    `[PASS] ${result.context.observations.length} observations; ${result.context.events.length} events; ${result.bytes} bytes`,
    `[PASS] Rights: ${result.context.rightsSummary.exportDecision}; trading and portfolio actions blocked`,
    `[INFO] ${result.context.warnings.length} warnings; ${result.context.unknowns.length} unknowns`,
  ].join('\n').concat('\n');
}

async function main(): Promise<void> {
  const options = await parseArgs(process.argv.slice(2));
  const result = await exportWorldMonitorContextV1(options);
  process.stdout.write(renderResult(result));
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
