import path from "node:path";

export const CATEGORY_VALUES = [
  "ui-components",
  "design-systems",
  "react-source-maps",
  "agent-frameworks",
  "mcp-tools",
  "local-dev-infrastructure",
  "automation-tools",
  "data-viz",
  "forms",
  "tables-grids",
  "charts",
  "video-generation",
  "code-quality",
  "testing",
  "documentation",
  "project-management",
  "security",
  "research-reference",
  "hardware-iot",
  "developer-tools",
  "unknown"
];

export const TYPE_VALUES = [
  "library",
  "framework",
  "template",
  "design-system",
  "ui-system",
  "tooling",
  "mcp-server",
  "agent-framework",
  "skill-pack",
  "collection",
  "topic-map",
  "reference",
  "implementation-pattern"
];

export const ACQUISITION_VALUES = [
  "reference-only",
  "reference-map-only",
  "dependency-candidate",
  "template-candidate",
  "fork-candidate",
  "clone-candidate",
  "sandbox-research-only",
  "implementation-pattern",
  "do-not-use"
];

export const RISK_LEVELS = ["low", "moderate", "high", "critical"];
export const MAINTENANCE_VALUES = ["active", "slow-moving", "stale", "archived", "unknown"];

export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean);
}

export function slugify(value) {
  return normalizeText(value).replace(/\s+/g, "-");
}

export function unique(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}

export function parseGitHubUrl(url) {
  if (typeof url !== "string" || !url.startsWith("https://github.com/")) {
    return null;
  }
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return {
      owner: parts[0],
      repo: parts[1],
      kind: parts[1] === "topics" ? "topic" : parts[1] === "collections" ? "collection" : "repo",
      pathParts: parts
    };
  }
  return null;
}

export function isUrlLike(value) {
  return typeof value === "string" && /^https:\/\/github\.com\/.+/.test(value);
}

export function buildSearchText(entry) {
  return unique([
    entry.id,
    entry.slug,
    entry.owner,
    entry.repo,
    entry.name,
    entry.url,
    entry.category,
    entry.type,
    ...(entry.aliases ?? []),
    ...(entry.stack ?? []),
    ...(entry.tags ?? []),
    ...(entry.summary ? [entry.summary] : []),
    ...(entry.primaryUseCases ?? []),
    entry.agentUseInstruction,
    entry.searchText,
    ...(entry.relatedRepos ?? []),
    ...(entry.qualitySignals?.topics ?? []),
    entry.qualitySignals?.language,
    entry.qualitySignals?.homepage
  ])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function entryPathForSlug(slug) {
  return path.posix.join("registries", "repos", `${slug}.json`);
}

export function deriveCategory({ url, name, description, topics = [], language = "", type = "" }) {
  const haystack = normalizeText([url, name, description, topics.join(" "), language, type].join(" "));
  const has = (...terms) => terms.some((term) => haystack.includes(term));
  if (has("storybook", "component", "ui", "radix", "shadcn", "mantine", "material ui", "ant design", "design system")) return "design-systems";
  if (has("data grid", "table", "grid")) return "tables-grids";
  if (has("chart", "charts", "visualization", "viz")) return "charts";
  if (has("form")) return "forms";
  if (has("video", "generative video", "camera")) return "video-generation";
  if (has("lint", "quality", "code smell", "eslint", "prettier")) return "code-quality";
  if (has("test", "testing", "playwright", "vitest", "jest")) return "testing";
  if (has("security", "password", "auth", "credential", "privacy")) return "security";
  if (has("mcp")) return "mcp-tools";
  if (has("agent", "codex", "claude", "openai", "assistant")) return "agent-frameworks";
  if (has("kubernetes", "docker", "devspace", "local dev", "tunnel", "cli")) return "local-dev-infrastructure";
  if (has("project management", "kanban", "task", "issue", "roadmap")) return "project-management";
  if (has("documentation", "docs", "cheatsheet", "awesome", "reference")) return "documentation";
  if (has("compiler", "rust", "c", "go", "python")) return "research-reference";
  return "developer-tools";
}

export function deriveRiskLevel(entry) {
  const flags = new Set(entry.riskFlags ?? []);
  const text = normalizeText([entry.summary, entry.agentUseInstruction, entry.notes?.join(" "), entry.url, entry.type, entry.category].join(" "));
  if (flags.has("local-access") || flags.has("shell-execution") || flags.has("filesystem-access") || flags.has("auth-credential-handling") || flags.has("network-tunnel-exposure") || flags.has("infrastructure-modification")) {
    return "critical";
  }
  if (flags.has("missing-license") || flags.has("legal/license review needed")) {
    return "high";
  }
  if (flags.has("security-sensitive")) {
    return "high";
  }
  if (text.includes("credential") || text.includes("secret") || text.includes("token")) {
    return "high";
  }
  if (text.includes("filesystem") || text.includes("shell") || text.includes("localhost") || text.includes("kubernetes") || text.includes("tunnel")) {
    return "moderate";
  }
  return entry.acquisitionMode === "do-not-use" ? "critical" : "low";
}

export function deriveAcquisitionMode(entry) {
  const category = entry.category;
  const type = entry.type;
  const risk = entry.riskLevel;
  if (risk === "critical") return "do-not-use";
  if (["collection", "topic-map", "reference"].includes(type) || category === "research-reference" || category === "documentation") {
    return "reference-map-only";
  }
  if (category === "agent-frameworks" || category === "mcp-tools" || category === "local-dev-infrastructure") {
    return risk === "high" ? "sandbox-research-only" : "dependency-candidate";
  }
  if (category === "design-systems" || category === "ui-components" || category === "forms" || category === "tables-grids" || category === "charts") {
    return "reference-only";
  }
  if (category === "video-generation" || category === "security" || category === "project-management") {
    return risk === "high" ? "sandbox-research-only" : "reference-only";
  }
  return "implementation-pattern";
}

export function deriveRecommendedAction(entry) {
  if (entry.riskLevel === "critical") return "do-not-use";
  if (entry.acquisitionMode === "dependency-candidate") return "compare-before-adoption";
  if (entry.acquisitionMode === "sandbox-research-only") return "triage-in-sandbox";
  if (entry.acquisitionMode === "reference-map-only") return "search-the-map";
  if (entry.acquisitionMode === "reference-only") return "use-as-reference";
  return "extract-patterns";
}

export function buildEntryPath(slug) {
  return entryPathForSlug(slug);
}

