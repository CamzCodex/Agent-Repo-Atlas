import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { normalizeText, tokenize } from "./atlas-core.mjs";

const root = process.cwd();

export function scoreSearchEntry(entry, queryTokens, queryText) {
  const strongFields = [
    entry.id,
    entry.slug,
    entry.owner,
    entry.repo,
    entry.name,
    entry.url,
    entry.entryPath,
    entry.category,
    entry.type,
    ...(entry.aliases ?? []),
    ...(entry.stack ?? []),
    ...(entry.tags ?? [])
  ];
  const mediumFields = [
    entry.summary,
    ...(entry.primaryUseCases ?? [])
  ];
  const weakFields = [entry.searchText];
  const strongHaystack = normalizeText(strongFields.join(" "));
  const mediumHaystack = normalizeText(mediumFields.join(" "));
  const weakHaystack = normalizeText(weakFields.join(" "));
  const haystack = `${strongHaystack} ${mediumHaystack} ${weakHaystack}`.trim();

  let score = 0;
  const reasons = [];
  if (strongHaystack.includes(queryText)) {
    score += 55;
    reasons.push("strong phrase match");
  } else if (haystack.includes(queryText)) {
    score += 30;
    reasons.push("exact phrase match");
  }
  for (const token of queryTokens) {
    if (strongHaystack.includes(token)) {
      score += 16;
      reasons.push(`strong match "${token}"`);
    } else if (mediumHaystack.includes(token)) {
      score += 8;
      reasons.push(`summary match "${token}"`);
    } else if (weakHaystack.includes(token)) {
      score += 3;
      reasons.push(`search text match "${token}"`);
    }
  }
  if (queryTokens.every((token) => strongHaystack.includes(token))) {
    score += 12;
  }
  if (queryTokens.some((token) => entry.category === token)) {
    score += 10;
  }
  if (queryTokens.some((token) => entry.type === token)) {
    score += 8;
  }
  if (queryTokens.some((token) => entry.riskLevel === token)) {
    score += 2;
  }
  if (entry.riskLevel === "low") score += 4;
  if (entry.riskLevel === "high") score -= 4;
  if (entry.riskLevel === "critical") score -= 12;
  if (!reasons.length) {
    reasons.push("keyword overlap");
  }
  return { score, reasons };
}

export async function loadIndex() {
  return JSON.parse(await readFile(path.join(root, "registries", "repo-index.json"), "utf8"));
}

export function searchEntries(index, query) {
  const queryText = normalizeText(query);
  const queryTokens = tokenize(query);
  return index.entries
    .map((entry, i) => {
      const { score, reasons } = scoreSearchEntry(entry, queryTokens, queryText);
      const reason = reasons[0] ?? "category/keyword relevance";
      return {
        rank: i + 1,
        score,
        ...entry,
        matchReason: reason
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error('Usage: node scripts/search-atlas.mjs "query"');
    process.exit(1);
  }

  const index = await loadIndex();
  const results = searchEntries(index, query);
  if (!results.length) {
    console.log("No atlas matches found.");
    return;
  }

  for (const result of results.slice(0, 20)) {
    console.log(
      `${String(result.rank).padStart(2, " ")} | ${String(result.score).padStart(3, " ")} | ${result.id} | ${result.name} | ${result.type} | ${result.category} | risk=${result.riskLevel} | mode=${result.acquisitionMode}`
    );
    console.log(`   url=${result.url}`);
    console.log(`   entry=${result.entryPath}`);
    console.log(`   reason=${result.matchReason}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
