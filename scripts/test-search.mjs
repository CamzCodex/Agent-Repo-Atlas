import process from "node:process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadIndex, searchEntries } from "./search-atlas.mjs";

const root = process.cwd();

async function main() {
  const fixtures = JSON.parse(await readFile(path.join(root, "tests", "fixtures", "search-queries.json"), "utf8"));
  const index = await loadIndex();
  let checked = 0;

  for (const fixture of fixtures) {
    const results = searchEntries(index, fixture.query);
    if (!results.length) {
      throw new Error(`Query failed to return results: ${fixture.query}`);
    }
    const topIds = results.slice(0, 10).map((entry) => entry.id);
    const categories = results.slice(0, 10).map((entry) => entry.category);

    if (fixture.expectTopIds?.length) {
      for (const expected of fixture.expectTopIds) {
        if (!topIds.includes(expected)) {
          throw new Error(`Query "${fixture.query}" expected top result containing ${expected} but got ${topIds.join(", ")}`);
        }
      }
    }

    if (fixture.expectCategories?.length) {
      for (const expectedCategory of fixture.expectCategories) {
        if (!categories.includes(expectedCategory)) {
          throw new Error(`Query "${fixture.query}" expected category ${expectedCategory} but got ${categories.join(", ")}`);
        }
      }
    }

    if (fixture.expectHighRisk && !results.some((entry) => entry.riskLevel === "high" || entry.riskLevel === "critical")) {
      throw new Error(`Query "${fixture.query}" expected at least one high-risk label`);
    }

    checked += 1;
  }

  console.log(`Search fixtures passed: ${checked}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
