import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function uniqueCount(values) {
  return new Set(values ?? []).size;
}

function scoreEntry(entry) {
  let score = 0;
  const breakdown = [];

  const maintenanceScores = {
    active: 25,
    "slow-moving": 15,
    stale: 5,
    archived: 0
  };
  score += maintenanceScores[entry.maintenance.state] ?? 0;
  breakdown.push(`maintenance=${maintenanceScores[entry.maintenance.state] ?? 0}`);

  const acquisitionScores = {
    reference: 18,
    "dependency-candidate": 22,
    "fork-candidate": 15,
    "sandbox-research": 8,
    reject: 0
  };
  score += acquisitionScores[entry.acquisitionMode] ?? 0;
  breakdown.push(`acquisition=${acquisitionScores[entry.acquisitionMode] ?? 0}`);

  const licenseBoost = entry.license.confidence === "high" ? 12 : entry.license.confidence === "medium" ? 6 : 0;
  score += licenseBoost;
  breakdown.push(`license=${licenseBoost}`);

  const riskPenalty = (entry.risk.flags ?? []).length * 7;
  score -= riskPenalty;
  breakdown.push(`risk=-${riskPenalty}`);

  const docsBoost = Math.min(uniqueCount(entry.useCases) * 2, 8);
  score += docsBoost;
  breakdown.push(`useCases=${docsBoost}`);

  const topicBoost = Math.min(uniqueCount(entry.topics) + uniqueCount(entry.tags), 10);
  score += topicBoost;
  breakdown.push(`coverage=${topicBoost}`);

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown
  };
}

async function main() {
  const index = JSON.parse(await readFile(path.join(root, "registries", "repo-index.json"), "utf8"));
  const entries = await Promise.all(
    index.entries.map(async (slug) => JSON.parse(await readFile(path.join(root, "registries", "repos", `${slug}.json`), "utf8")))
  );

  const rows = entries
    .map((entry) => ({
      entry,
      ...scoreEntry(entry)
    }))
    .sort((a, b) => b.score - a.score || a.entry.slug.localeCompare(b.entry.slug));

  for (const row of rows) {
    console.log(`${row.score.toString().padStart(3, " ")}  ${row.entry.slug}`);
    console.log(`     ${row.breakdown.join(" | ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

