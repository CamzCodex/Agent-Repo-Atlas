import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreEntry(entry, queryTokens, queryText) {
  const fields = [
    entry.slug,
    entry.name,
    entry.description,
    entry.summary,
    entry.type,
    entry.acquisitionMode,
    entry.maintenance?.state,
    entry.license?.spdx,
    ...(entry.topics ?? []),
    ...(entry.tags ?? []),
    ...(entry.useCases ?? []),
    ...(entry.notes ?? []),
    entry.risk?.notes,
    entry.maintenance?.notes
  ].filter(Boolean);

  const haystack = normalize(fields.join(" "));
  let score = 0;

  if (haystack.includes(queryText)) {
    score += 30;
  }

  for (const token of queryTokens) {
    const exactHits = fields.some((field) => normalize(field).includes(token));
    if (exactHits) {
      score += 12;
    }
  }

  const tokenSet = new Set(haystack.split(" "));
  for (const token of queryTokens) {
    if (tokenSet.has(token)) {
      score += 8;
    }
  }

  if (queryTokens.includes(normalize(entry.type))) {
    score += 14;
  }
  if (queryTokens.includes(normalize(entry.acquisitionMode))) {
    score += 10;
  }

  return score;
}

async function loadEntries() {
  const index = JSON.parse(await readFile(path.join(root, "registries", "repo-index.json"), "utf8"));
  return Promise.all(
    index.entries.map(async (slug) => {
      const entry = JSON.parse(await readFile(path.join(root, "registries", "repos", `${slug}.json`), "utf8"));
      return entry;
    })
  );
}

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error('Usage: node scripts/search-atlas.mjs "query"');
    process.exit(1);
  }

  const queryText = normalize(query);
  const queryTokens = queryText.split(" ").filter(Boolean);
  const entries = await loadEntries();
  const results = entries
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, queryTokens, queryText)
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.slug.localeCompare(b.entry.slug));

  if (results.length === 0) {
    console.log("No atlas matches found.");
    return;
  }

  for (const { entry, score } of results) {
    console.log(`${score.toString().padStart(3, " ")}  ${entry.slug}  ${entry.name}`);
    console.log(`     ${entry.summary}`);
    console.log(`     mode=${entry.acquisitionMode} type=${entry.type} license=${entry.license.spdx}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

