#!/usr/bin/env node

import { access, cp, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, '.github', 'upstream-workflows-disabled');
const DESTINATION = resolve(ROOT, '.github', 'workflows');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function countFiles(path) {
  let count = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) count += await countFiles(child);
    else if (entry.isFile()) count += 1;
  }
  return count;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const known = new Set(['--dry-run', '--force']);
  for (const arg of args) {
    if (!known.has(arg)) throw new Error(`Unknown argument: ${arg}`);
  }

  if (!(await exists(SOURCE))) {
    throw new Error('No preserved upstream workflows found at .github/upstream-workflows-disabled');
  }

  const fileCount = await countFiles(SOURCE);
  if (args.has('--dry-run')) {
    console.log(`Would restore ${fileCount} workflow files to .github/workflows`);
    return;
  }

  if (await exists(DESTINATION)) {
    if (!args.has('--force')) {
      throw new Error('.github/workflows already exists; rerun with --force only after reviewing local changes');
    }
    await rm(DESTINATION, { recursive: true, force: true });
  }

  await cp(SOURCE, DESTINATION, { recursive: true, force: false, errorOnExist: true });
  console.log(`Restored ${fileCount} upstream workflow files to .github/workflows`);
  console.log('These files are for local CI parity. The connected GitHub App cannot commit workflow paths.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
