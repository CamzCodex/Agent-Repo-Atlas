import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  ACQUISITION_VALUES,
  CATEGORY_VALUES,
  MAINTENANCE_VALUES,
  RISK_LEVELS,
  TYPE_VALUES,
  buildSearchText,
  normalizeText,
  parseGitHubUrl,
  slugify,
  unique
} from "./atlas-core.mjs";

const root = process.cwd();

function fail(message) {
  throw new Error(message);
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateFields(entry) {
  const required = ["id", "slug", "owner", "repo", "name", "url", "entryPath", "category", "type", "aliases", "stack", "tags", "summary", "primaryUseCases", "agentUseInstruction", "acquisitionMode", "riskLevel", "reviewRequiredBeforeUse", "recommendedAgentAction", "relatedRepos", "searchText", "license", "maintenance", "qualitySignals", "notes"];
  for (const key of required) {
    if (!(key in entry)) fail(`missing required field: ${entry.id ?? entry.entryPath ?? "unknown"} -> ${key}`);
  }
  if (!isObject(entry.license)) fail(`license must be object: ${entry.id}`);
  if (!isObject(entry.maintenance)) fail(`maintenance must be object: ${entry.id}`);
  if (!isObject(entry.qualitySignals)) fail(`qualitySignals must be object: ${entry.id}`);
  if (!Array.isArray(entry.aliases) || !Array.isArray(entry.stack) || !Array.isArray(entry.tags) || !Array.isArray(entry.primaryUseCases) || !Array.isArray(entry.relatedRepos) || !Array.isArray(entry.notes)) {
    fail(`array field malformed: ${entry.id}`);
  }
  if (!ACQUISITION_VALUES.includes(entry.acquisitionMode)) fail(`invalid acquisition mode: ${entry.id} -> ${entry.acquisitionMode}`);
  if (!RISK_LEVELS.includes(entry.riskLevel)) fail(`invalid risk level: ${entry.id} -> ${entry.riskLevel}`);
  if (!CATEGORY_VALUES.includes(entry.category)) fail(`invalid category: ${entry.id} -> ${entry.category}`);
  if (!TYPE_VALUES.includes(entry.type)) fail(`invalid type: ${entry.id} -> ${entry.type}`);
  if (!MAINTENANCE_VALUES.includes(entry.maintenance.state)) fail(`invalid maintenance state: ${entry.id} -> ${entry.maintenance.state}`);
  if (typeof entry.reviewRequiredBeforeUse !== "boolean") fail(`reviewRequiredBeforeUse must be boolean: ${entry.id}`);
  if (typeof entry.searchText !== "string" || !entry.searchText.trim()) fail(`searchText missing: ${entry.id}`);
  if (typeof entry.url !== "string" || !entry.url.startsWith("https://github.com/")) fail(`bad github url: ${entry.id} -> ${entry.url}`);
  if (/[A-Za-z]:\\|file:\/\//.test(entry.url) || /localhost|127\.0\.0\.1|ghp_|github_pat_|BEGIN PRIVATE KEY/i.test(entry.searchText)) fail(`obvious secret/local path detected: ${entry.id}`);
}

function validateEntryPath(entry) {
  const expected = path.normalize(path.join(root, entry.entryPath));
  if (!expected.startsWith(path.join(root, "registries", "repos"))) fail(`entryPath escapes registry tree: ${entry.id}`);
  return readFile(expected, "utf8").then(() => undefined, () => fail(`broken entry path: ${entry.id} -> ${entry.entryPath}`));
}

async function main() {
  const index = JSON.parse(await readFile(path.join(root, "registries", "repo-index.json"), "utf8"));
  const starredImportPath = path.join(root, "registries", "starred", "starred-import.json");
  const starredQueuePath = path.join(root, "registries", "starred", "starred-review-queue.json");
  const repoDir = path.join(root, "registries", "repos");
  const files = (await readdir(repoDir)).filter((file) => file.endsWith(".json")).sort();
  const entries = await Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(repoDir, file), "utf8"))));
  const starredImport = JSON.parse(await readFile(starredImportPath, "utf8"));
  const starredQueue = JSON.parse(await readFile(starredQueuePath, "utf8"));

  const ids = new Set();
  for (const entry of entries) {
    validateFields(entry);
    if (ids.has(entry.id)) fail(`duplicate id: ${entry.id}`);
    ids.add(entry.id);
    const parsed = parseGitHubUrl(entry.url);
    if (!parsed) fail(`unparseable github url: ${entry.id}`);
    if (entry.slug !== slugify(entry.id) && !entry.entryPath.endsWith(`${entry.slug}.json`)) {
      // Allow explicit filenames for seeded entries, but the slug still needs to be stable.
      if (entry.slug !== path.basename(entry.entryPath, ".json")) fail(`slug/path mismatch: ${entry.id}`);
    }
    const expectedSearch = buildSearchText(entry);
    if (!normalizeText(entry.searchText).includes(normalizeText(entry.name)) || normalizeText(expectedSearch).length < 10) {
      fail(`search text malformed: ${entry.id}`);
    }
    await validateEntryPath(entry);
  }

  const generatedIndexEntries = entries
    .map((entry) => ({
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
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const actualIndexEntries = [...(index.entries ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  if (JSON.stringify(generatedIndexEntries) !== JSON.stringify(actualIndexEntries)) {
    fail("repo-index.json is out of sync with full registry entries");
  }

  if (starredImport.count !== starredImport.entries.length) {
    fail("starred-import.json count does not match entries length");
  }
  if (starredQueue.count !== starredQueue.entries.length) {
    fail("starred-review-queue.json count does not match entries length");
  }
  if (starredImport.count !== starredQueue.count) {
    fail("starred import and review queue counts differ");
  }
  for (const item of starredQueue.entries) {
    if (!Array.isArray(item.manualReviewReasons)) {
      fail(`starred review item missing manualReviewReasons: ${item.fullName}`);
    }
    if (typeof item.relevanceScore !== "number") {
      fail(`starred review item missing relevanceScore: ${item.fullName}`);
    }
  }

  console.log(`Registry validation passed for ${entries.length} entries.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
