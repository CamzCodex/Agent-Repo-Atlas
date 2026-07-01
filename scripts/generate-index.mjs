import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

async function main() {
  const repoDir = path.join(root, "registries", "repos");
  const files = (await readdir(repoDir)).filter((name) => name.endsWith(".json")).sort();
  const entries = [];

  for (const file of files) {
    const entry = JSON.parse(await readFile(path.join(repoDir, file), "utf8"));
    entries.push(entry.slug);
  }

  const index = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    source: "registries/repos",
    entries
  };

  await writeFile(path.join(root, "registries", "repo-index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(`Wrote ${entries.length} entries to registries/repo-index.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

