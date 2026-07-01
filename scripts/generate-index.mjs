import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

async function main() {
  const repoDir = path.join(root, "registries", "repos");
  const files = (await readdir(repoDir)).filter((file) => file.endsWith(".json")).sort((a, b) => a.localeCompare(b));
  const entries = [];

  for (const file of files) {
    const entry = JSON.parse(await readFile(path.join(repoDir, file), "utf8"));
    entries.push({
      id: entry.id,
      slug: entry.slug,
      owner: entry.owner,
      repo: entry.repo,
      name: entry.name,
      url: entry.url,
      entryPath: entry.entryPath,
      category: entry.category,
      type: entry.type,
      aliases: entry.aliases,
      stack: entry.stack,
      tags: entry.tags,
      summary: entry.summary,
      primaryUseCases: entry.primaryUseCases,
      acquisitionMode: entry.acquisitionMode,
      riskLevel: entry.riskLevel,
      reviewRequiredBeforeUse: entry.reviewRequiredBeforeUse,
      recommendedAgentAction: entry.recommendedAgentAction,
      searchText: entry.searchText,
      license: entry.license?.spdx ?? "NOASSERTION",
      maintenanceState: entry.maintenance?.state ?? "unknown"
    });
  }

  const index = {
    version: "2.0.0",
    generatedAt: new Date().toISOString(),
    source: "registries/repos",
    generatedFrom: { repoFiles: files.length },
    entries
  };

  await writeFile(path.join(root, "registries", "repo-index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(`Wrote ${entries.length} index entries.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

