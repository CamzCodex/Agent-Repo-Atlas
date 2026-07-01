import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function loadStarredFromGh() {
  const output = execFileSync("gh", ["api", "user/starred", "--paginate", "--slurp"], { encoding: "utf8" });
  const pages = JSON.parse(output);
  return pages.flat();
}

function normalizeStarredRepo(repo) {
  return {
    githubId: repo.id,
    nodeId: repo.node_id,
    owner: repo.owner?.login ?? "",
    name: repo.name ?? "",
    fullName: repo.full_name ?? "",
    url: repo.html_url ?? "",
    apiUrl: repo.url ?? "",
    description: repo.description ?? "",
    language: repo.language ?? null,
    topics: repo.topics ?? [],
    license: repo.license
      ? {
          key: repo.license.key ?? null,
          name: repo.license.name ?? null,
          spdxId: repo.license.spdx_id ?? null,
          url: repo.license.url ?? null
        }
      : null,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    archived: Boolean(repo.archived),
    disabled: Boolean(repo.disabled),
    private: Boolean(repo.private),
    visibility: repo.visibility ?? (repo.private ? "private" : "public"),
    pushedAt: repo.pushed_at ?? null,
    updatedAt: repo.updated_at ?? null,
    createdAt: repo.created_at ?? null,
    defaultBranch: repo.default_branch ?? null,
    homepage: repo.homepage ?? null,
    size: repo.size ?? 0,
    openIssuesCount: repo.open_issues_count ?? 0,
    fork: Boolean(repo.fork),
    hasIssues: Boolean(repo.has_issues),
    hasProjects: Boolean(repo.has_projects),
    hasWiki: Boolean(repo.has_wiki),
    hasPages: Boolean(repo.has_pages),
    hasDiscussions: Boolean(repo.has_discussions),
    permissions: repo.permissions ?? null
  };
}

async function main() {
  const starred = loadStarredFromGh().map(normalizeStarredRepo);
  const payload = {
    source: "gh api user/starred --paginate --slurp",
    importedAt: new Date().toISOString(),
    account: "CamzCodex",
    count: starred.length,
    entries: starred
  };

  const targetDir = path.join(root, "registries", "starred");
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, "starred-import.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Imported ${starred.length} starred repos.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

