import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreEntry(entry, queryTokens, queryText) {
  const haystack = normalize([
    entry.slug,
    entry.name,
    entry.description,
    entry.summary,
    entry.type,
    entry.acquisitionMode,
    ...(entry.topics ?? []),
    ...(entry.tags ?? []),
    ...(entry.useCases ?? []),
    ...(entry.notes ?? [])
  ].join(" "));

  let score = haystack.includes(queryText) ? 20 : 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      score += 10;
    }
  }
  return score;
}

async function search(query) {
  const index = JSON.parse(await readFile(path.join(root, "registries", "repo-index.json"), "utf8"));
  const entries = await Promise.all(
    index.entries.map(async (slug) => JSON.parse(await readFile(path.join(root, "registries", "repos", `${slug}.json`), "utf8")))
  );
  const queryText = normalize(query);
  const queryTokens = queryText.split(" ").filter(Boolean);
  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, queryTokens, queryText) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.slug.localeCompare(b.entry.slug));
}

async function main() {
  const fixturePath = path.join(root, "tests", "fixtures", "search-queries.json");
  const fixtures = JSON.parse(await readFile(fixturePath, "utf8"));

  for (const fixture of fixtures) {
    const results = await search(fixture.query);
    const topSlug = results[0]?.entry.slug;
    if (topSlug !== fixture.expectTopSlug) {
      throw new Error(`Query "${fixture.query}" expected ${fixture.expectTopSlug} but got ${topSlug ?? "no result"}`);
    }
  }

  console.log(`Search fixtures passed: ${fixtures.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

