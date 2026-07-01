import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  ACQUISITION_VALUES,
  CATEGORY_VALUES,
  MAINTENANCE_VALUES,
  RISK_LEVELS,
  TYPE_VALUES,
  buildEntryPath,
  buildSearchText,
  deriveAcquisitionMode,
  deriveCategory,
  deriveRecommendedAction,
  deriveRiskLevel,
  normalizeText,
  parseGitHubUrl,
  slugify,
  unique
} from "./atlas-core.mjs";

const root = process.cwd();

function ghRepo(owner, repo) {
  const output = execFileSync("gh", ["api", `repos/${owner}/${repo}`], { encoding: "utf8" });
  return JSON.parse(output);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function ensureDirSync(dir) {
  mkdirSync(dir, { recursive: true });
}

function isoOrNull(value) {
  return value ?? null;
}

function classifyMaintenance(meta) {
  if (meta.archived) return "archived";
  if (meta.disabled) return "stale";
  const pushedAt = meta.pushed_at ? new Date(meta.pushed_at).getTime() : 0;
  const ninetyDays = 1000 * 60 * 60 * 24 * 90;
  if (pushedAt && Date.now() - pushedAt > ninetyDays) return "slow-moving";
  return "active";
}

function buildRepoEntry(spec, meta, overrides = {}) {
  const parsed = parseGitHubUrl(spec.url);
  const owner = spec.owner ?? parsed?.owner ?? meta?.owner?.login ?? "";
  const repo = spec.repo ?? parsed?.repo ?? meta?.name ?? "";
  const id = spec.id ?? `${owner}/${repo}`;
  const slug = slugify(id);
  const fileStem = spec.fileName ? spec.fileName.replace(/\.json$/i, "") : slug;
  const entryPath = spec.entryPath ?? buildEntryPath(fileStem);
  const name = spec.name ?? meta?.name ?? repo;
  const url = spec.url;
  const category = spec.category ?? deriveCategory({
    url,
    name,
    description: spec.summary ?? meta?.description ?? "",
    topics: meta?.topics ?? spec.topics ?? [],
    language: meta?.language ?? "",
    type: spec.type ?? ""
  });
  const riskLevel = spec.riskLevel ?? deriveRiskLevel({ ...spec, category, riskFlags: spec.riskFlags ?? [] });
  const acquisitionMode = spec.acquisitionMode ?? deriveAcquisitionMode({ ...spec, category, riskLevel });
  const maintenanceState = spec.maintenance?.state ?? classifyMaintenance(meta ?? {});
  const aliases = unique([...(spec.aliases ?? []), spec.name, meta?.name, repo, slug].filter(Boolean));
  const stack = unique([...(spec.stack ?? []), meta?.language, ...(meta?.topics ?? [])].filter(Boolean));
  const tags = unique([...(spec.tags ?? []), ...(meta?.topics ?? []), category, spec.type, repo, owner].filter(Boolean));
  const primaryUseCases = unique(spec.primaryUseCases ?? []);
  const summary = spec.summary ?? meta?.description ?? "";
  const agentUseInstruction = spec.agentUseInstruction ?? "Use as a reference candidate, compare against alternatives, and validate license and maintenance before any adoption.";
  const qualitySignals = {
    stars: meta?.stargazers_count ?? spec.stars ?? 0,
    forks: meta?.forks_count ?? spec.forks ?? 0,
    watchers: meta?.subscribers_count ?? meta?.watchers_count ?? spec.watchers ?? 0,
    openIssues: meta?.open_issues_count ?? spec.openIssuesCount ?? 0,
    archived: Boolean(meta?.archived ?? spec.archived ?? false),
    disabled: Boolean(meta?.disabled ?? spec.disabled ?? false),
    private: Boolean(meta?.private ?? false),
    fork: Boolean(meta?.fork ?? false),
    visibility: meta?.visibility ?? spec.visibility ?? "public",
    language: meta?.language ?? spec.language ?? null,
    topics: meta?.topics ?? spec.topics ?? [],
    homepage: meta?.homepage ?? spec.homepage ?? null,
    defaultBranch: meta?.default_branch ?? spec.defaultBranch ?? null,
    size: meta?.size ?? spec.size ?? 0,
    pushedAt: isoOrNull(meta?.pushed_at ?? spec.pushedAt),
    updatedAt: isoOrNull(meta?.updated_at ?? spec.updatedAt),
    createdAt: isoOrNull(meta?.created_at ?? spec.createdAt)
  };
  const license = spec.license ?? (meta?.license
    ? {
        spdx: meta.license.spdx_id ?? "NOASSERTION",
        confidence: meta.license.spdx_id && meta.license.spdx_id !== "NOASSERTION" ? "high" : "low",
        name: meta.license.name ?? null,
        url: meta.license.url ?? null
      }
    : { spdx: "NOASSERTION", confidence: "low", name: null, url: null });
  const notes = unique(spec.notes ?? []);
  const riskFlags = unique(spec.riskFlags ?? []);
  const riskNotes = spec.riskNotes ?? (riskFlags.length ? `Flags: ${riskFlags.join(", ")}.` : "No explicit risk notes.");
  const reviewRequiredBeforeUse = spec.reviewRequiredBeforeUse ?? riskLevel !== "low";
  const recommendedAgentAction = spec.recommendedAgentAction ?? deriveRecommendedAction({ acquisitionMode, riskLevel });
  const searchText = buildSearchText({
    id,
    slug,
    owner,
    repo,
    name,
    url,
    category,
    type: spec.type ?? "reference",
    aliases,
    stack,
    tags,
    summary,
    primaryUseCases,
    agentUseInstruction,
    relatedRepos: spec.relatedRepos ?? [],
    qualitySignals
  });

  return {
    id,
    slug,
    owner,
    repo,
    name,
    url,
    entryPath,
    category,
    type: spec.type ?? "reference",
    aliases,
    stack,
    tags,
    summary,
    primaryUseCases,
    agentUseInstruction,
    acquisitionMode,
    riskLevel,
    riskFlags,
    riskNotes,
    reviewRequiredBeforeUse,
    recommendedAgentAction,
    relatedRepos: unique(spec.relatedRepos ?? []),
    searchText,
    license,
    maintenance: {
      state: maintenanceState,
      notes: spec.maintenance?.notes ?? "Reviewed from metadata.",
      lastReviewedAt: new Date().toISOString(),
      pushedAt: qualitySignals.pushedAt,
      updatedAt: qualitySignals.updatedAt,
      createdAt: qualitySignals.createdAt
    },
    qualitySignals,
    notes
  };
}

const preferredStarredOrder = [
  "microsoft/Codex-CLI",
  "icebear0828/codex-proxy",
  "openai/plugins",
  "openai/skills",
  "VoltAgent/awesome-codex-subagents",
  "VoltAgent/awesome-claude-code-subagents",
  "VoltAgent/awesome-agent-skills",
  "google/agents-cli",
  "browser-use/video-use",
  "ruvnet/RuView",
  "Waishnav/devspace",
  "microsoft/AI-For-Beginners",
  "github/awesome-copilot",
  "lissy93/dashy",
  "enescingoz/awesome-n8n-templates",
  "goabstract/Awesome-Design-Tools",
  "alexpate/awesome-design-systems",
  "soxoj/maigret",
  "MervinPraison/PraisonAI",
  "NousResearch/hermes-agent",
  "colemurray/background-agents",
  "hoangsonww/Claude-Code-Agent-Monitor",
  "mvanhorn/last30days-skill",
  "davila7/claude-code-templates",
  "coreyhaines31/marketingskills"
];

function selectTopStarred(queue, count = 25) {
  const byName = new Map(queue.map((entry) => [entry.fullName, entry]));
  const selected = [];
  for (const fullName of preferredStarredOrder) {
    const entry = byName.get(fullName);
    if (entry) {
      selected.push(entry);
      byName.delete(fullName);
    }
  }
  const rest = [...byName.values()]
    .filter((entry) => entry.acquisitionMode !== "do-not-use" || entry.riskLevel !== "critical")
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.fullName.localeCompare(b.fullName));
  return [...selected, ...rest].slice(0, count);
}

function buildStarredSpec(entry) {
  return {
    id: entry.fullName,
    url: entry.url,
    type: entry.category === "documentation" || entry.category === "research-reference" ? "collection" : "tooling",
    category: entry.category,
    aliases: [entry.name, entry.fullName],
    stack: [entry.language].filter(Boolean),
    summary: entry.description || `${entry.fullName} from starred imports.`,
    primaryUseCases: ["starred repo review", "candidate triage"],
    agentUseInstruction: "Inspect the imported starred metadata and compare it with alternatives before recommending any adoption.",
    acquisitionMode: entry.acquisitionMode,
    riskLevel: entry.riskLevel,
    riskFlags: entry.manualReviewReasons ?? [],
    relatedRepos: [],
    reviewRequiredBeforeUse: true,
    recommendedAgentAction: entry.riskLevel === "critical" ? "do-not-use" : "compare-before-adoption",
    notes: [`Imported from GitHub stars.`, ...(entry.manualReviewReasons ?? [])],
    fileName: `${entry.owner}-${entry.name}.json`
  };
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

async function main() {
  const curated = loadJson(path.join(root, "registries", "curated-seeds.json"));
  const starredImportPath = path.join(root, "registries", "starred", "starred-import.json");
  const starredQueuePath = path.join(root, "registries", "starred", "starred-review-queue.json");

  let starredImport;
  let starredQueue;
  if (existsSync(starredImportPath)) {
    starredImport = loadJson(starredImportPath);
  } else {
    execFileSync("node", [path.join("scripts", "import-starred.mjs")], { stdio: "inherit", cwd: root });
    starredImport = loadJson(starredImportPath);
  }
  if (existsSync(starredQueuePath)) {
    starredQueue = loadJson(starredQueuePath);
  } else {
    execFileSync("node", [path.join("scripts", "triage-starred.mjs")], { stdio: "inherit", cwd: root });
    starredQueue = loadJson(starredQueuePath);
  }

  const selectedStarred = selectTopStarred(starredQueue.entries, 25);
  const curatedEntries = [];

  for (const spec of curated) {
    const parsed = parseGitHubUrl(spec.url);
    const meta = parsed && spec.type !== "collection" && spec.type !== "topic-map" ? ghRepo(parsed.owner, parsed.repo) : null;
    const entry = buildRepoEntry(spec, meta, {});
    curatedEntries.push(entry);
  }

  const starredEntries = [];
  for (const entry of selectedStarred) {
    const spec = buildStarredSpec(entry);
    const meta = ghRepo(entry.owner, entry.name);
    starredEntries.push(buildRepoEntry(spec, meta, {
      summary: spec.summary,
      notes: spec.notes,
      riskFlags: spec.riskFlags
    }));
  }

  const allEntries = [...curatedEntries, ...starredEntries];
  const deduped = [];
  const seenIds = new Set();
  for (const entry of allEntries.sort((a, b) => a.id.localeCompare(b.id))) {
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    deduped.push(entry);
  }

  const repoDir = path.join(root, "registries", "repos");
  ensureDirSync(repoDir);
  for (const file of readdirSync(repoDir)) {
    if (file.endsWith(".json")) {
      unlinkSync(path.join(repoDir, file));
    }
  }
  for (const entry of deduped) {
    const filePath = path.join(root, entry.entryPath);
    ensureDirSync(path.dirname(filePath));
    writeFileSync(filePath, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
  }

  const index = {
    version: "2.0.0",
    generatedAt: new Date().toISOString(),
    source: "registries/repos",
    generatedFrom: {
      curatedSeeds: curated.length,
      starredImported: starredImport.count,
      starredSelected: selectedStarred.length
    },
    entries: deduped.map((entry) => ({
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
      license: entry.license.spdx,
      maintenanceState: entry.maintenance.state
    }))
  };

  await writeFile(path.join(root, "registries", "repo-index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(`Built ${deduped.length} atlas entries.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
