import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function scoreEntry(entry) {
  const breakdown = [];
  let score = 0;
  const maintenance = {
    active: 24,
    "slow-moving": 14,
    stale: 5,
    archived: 0,
    unknown: 8
  };
  const acquisition = {
    "dependency-candidate": 20,
    "template-candidate": 16,
    "reference-only": 18,
    "reference-map-only": 14,
    "sandbox-research-only": 6,
    "fork-candidate": 12,
    "clone-candidate": 10,
    "implementation-pattern": 10,
    "do-not-use": 0
  };
  const risk = { low: 10, moderate: 4, high: -8, critical: -20 };
  const review = entry.reviewRequiredBeforeUse ? -2 : 4;
  const signals = Math.min((entry.aliases?.length ?? 0) + (entry.stack?.length ?? 0) + (entry.tags?.length ?? 0), 10);

  const m = maintenance[entry.maintenanceState ?? entry.maintenance?.state ?? "unknown"] ?? 0;
  const a = acquisition[entry.acquisitionMode] ?? 0;
  const r = risk[entry.riskLevel] ?? 0;
  score += m + a + r + review + signals;
  breakdown.push(`maintenance=${m}`);
  breakdown.push(`acquisition=${a}`);
  breakdown.push(`risk=${r}`);
  breakdown.push(`review=${review}`);
  breakdown.push(`signals=${signals}`);
  return { score: Math.max(0, Math.min(100, score)), breakdown };
}

async function main() {
  const index = JSON.parse(await readFile(path.join(root, "registries", "repo-index.json"), "utf8"));
  const scored = index.entries
    .map((entry) => {
      const { score, breakdown } = scoreEntry(entry);
      return { ...entry, score, breakdown };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  for (const entry of scored) {
    console.log(`${String(entry.score).padStart(3, " ")} | ${entry.id}`);
    console.log(`   ${entry.breakdown.join(" | ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

