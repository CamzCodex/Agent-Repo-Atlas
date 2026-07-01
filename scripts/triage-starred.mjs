import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { CATEGORY_VALUES, normalizeText, tokenize, unique } from "./atlas-core.mjs";

const root = process.cwd();

function classifyCategory(entry) {
  const text = normalizeText([entry.fullName, entry.description, entry.language, ...(entry.topics ?? [])].join(" "));
  const has = (...terms) => terms.some((term) => text.includes(term));
  if (has("ui", "component", "radix", "mantine", "material ui", "ant design", "storybook", "shadcn", "design system")) return "design-systems";
  if (has("grid", "table")) return "tables-grids";
  if (has("chart", "visual")) return "charts";
  if (has("form")) return "forms";
  if (has("video", "camera")) return "video-generation";
  if (has("lint", "quality", "prettier", "eslint")) return "code-quality";
  if (has("test", "playwright", "vitest", "jest")) return "testing";
  if (has("security", "privacy", "password", "vault")) return "security";
  if (has("mcp")) return "mcp-tools";
  if (has("agent", "codex", "claude", "assistant", "workflow")) return "agent-frameworks";
  if (has("kubernetes", "docker", "devspace", "local dev", "tunnel", "shell")) return "local-dev-infrastructure";
  if (has("documentation", "awesome", "cheatsheet", "reference")) return "documentation";
  if (has("project", "kanban", "roadmap", "issue")) return "project-management";
  if (has("compiler", "python")) return "research-reference";
  return "developer-tools";
}

function inferAcquisitionMode(category, entry, riskLevel) {
  if (riskLevel === "critical") return "do-not-use";
  if (["documentation", "research-reference"].includes(category)) return "reference-map-only";
  if (["design-systems", "ui-components", "forms", "tables-grids", "charts"].includes(category)) return "reference-only";
  if (["agent-frameworks", "mcp-tools", "local-dev-infrastructure"].includes(category)) return riskLevel === "high" ? "sandbox-research-only" : "dependency-candidate";
  if (["code-quality", "testing", "project-management", "security"].includes(category)) return "sandbox-research-only";
  return "implementation-pattern";
}

function inferRiskLevel(entry, category) {
  const text = normalizeText([entry.description, entry.language, ...(entry.topics ?? []), entry.fullName].join(" "));
  const license = entry.license?.spdxId ?? "NOASSERTION";
  if (!license || license === "NOASSERTION") return "high";
  if (entry.archived || entry.disabled) return "moderate";
  if (text.includes("shell") || text.includes("filesystem") || text.includes("credential") || text.includes("tunnel") || text.includes("local access")) return "critical";
  if (["agent-frameworks", "mcp-tools", "local-dev-infrastructure", "security"].includes(category)) return "high";
  return "low";
}

function inferReviewReasons(entry, category, riskLevel) {
  const reasons = [];
  if (!entry.license?.spdxId || entry.license?.spdxId === "NOASSERTION") reasons.push("missing license");
  if (entry.archived) reasons.push("archived repo");
  if (entry.disabled) reasons.push("disabled repo");
  if (entry.pushedAt && new Date(entry.pushedAt) < new Date(Date.now() - 1000 * 60 * 60 * 24 * 180)) reasons.push("stale maintenance");
  if (category === "unknown") reasons.push("unclear purpose");
  if (riskLevel === "high" || riskLevel === "critical") reasons.push("security-sensitive");
  const text = normalizeText([entry.description, entry.fullName, ...(entry.topics ?? [])].join(" "));
  if (text.includes("shell")) reasons.push("shell execution");
  if (text.includes("filesystem")) reasons.push("filesystem access");
  if (text.includes("credential") || text.includes("auth")) reasons.push("auth/credential handling");
  if (text.includes("tunnel")) reasons.push("network tunnel exposure");
  if (text.includes("infra") || text.includes("kubernetes")) reasons.push("infrastructure modification");
  return unique(reasons);
}

function relevanceScore(entry, category, riskLevel) {
  const tokens = tokenize([entry.name, entry.description, entry.language, ...(entry.topics ?? [])].join(" "));
  let score = 0;
  const goodTerms = [
    "react",
    "ui",
    "component",
    "design",
    "agent",
    "codex",
    "claude",
    "mcp",
    "tool",
    "workflow",
    "docs",
    "awesome",
    "quality",
    "lint",
    "security",
    "video",
    "dashboard",
    "storybook",
    "kubernetes"
  ];
  for (const term of goodTerms) {
    if (tokens.includes(term)) score += 8;
  }
  if (["design-systems", "agent-frameworks", "mcp-tools", "code-quality", "documentation"].includes(category)) score += 12;
  if (riskLevel === "low") score += 5;
  if (riskLevel === "high") score -= 8;
  if (riskLevel === "critical") score -= 18;
  score += Math.min((entry.stars ?? 0) / 500, 10);
  return score;
}

async function main() {
  const importPath = path.join(root, "registries", "starred", "starred-import.json");
  const importData = JSON.parse(await readFile(importPath, "utf8"));
  const queue = importData.entries.map((entry) => {
    const category = classifyCategory(entry);
    const riskLevel = inferRiskLevel(entry, category);
    const acquisitionMode = inferAcquisitionMode(category, entry, riskLevel);
    return {
      githubId: entry.githubId,
      fullName: entry.fullName,
      owner: entry.owner,
      name: entry.name,
      url: entry.url,
      description: entry.description,
      language: entry.language,
      topics: entry.topics,
      category,
      type: acquisitionMode === "reference-map-only" ? "collection" : "tooling",
      acquisitionMode,
      riskLevel,
      manualReviewReasons: inferReviewReasons(entry, category, riskLevel),
      relevanceScore: relevanceScore(entry, category, riskLevel),
      archived: entry.archived,
      disabled: entry.disabled,
      stars: entry.stars,
      forks: entry.forks,
      pushedAt: entry.pushedAt,
      updatedAt: entry.updatedAt,
      createdAt: entry.createdAt,
      defaultBranch: entry.defaultBranch,
      homepage: entry.homepage,
      size: entry.size,
      openIssuesCount: entry.openIssuesCount,
      license: entry.license
    };
  }).sort((a, b) => b.relevanceScore - a.relevanceScore || a.fullName.localeCompare(b.fullName));

  const targetDir = path.join(root, "registries", "starred");
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, "starred-review-queue.json"), `${JSON.stringify({
    source: "registries/starred/starred-import.json",
    reviewedAt: new Date().toISOString(),
    count: queue.length,
    entries: queue
  }, null, 2)}\n`, "utf8");

  console.log(`Triage queue written for ${queue.length} starred repos.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

