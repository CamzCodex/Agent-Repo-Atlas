# Camz World Monitor — local finance setup

This branch is the first Camz enhancement layer over the pinned World Monitor vendor snapshot.

- Vendor branch: `vendor/worldmonitor-main`
- Enhancement branch: `camz/local-foundation`
- Upstream provenance: `.worldmonitor-upstream.json`
- Platform licence: `AGPL-3.0-only`

The code currently lives on an isolated branch of `CamzCodex/Agent-Repo-Atlas` because the connected GitHub automation cannot create a new top-level repository or fork. The branch itself is a full runnable World Monitor source tree.

## 1. Clone the enhancement branch

```bash
git clone --branch camz/local-foundation --single-branch \
  https://github.com/CamzCodex/Agent-Repo-Atlas.git \
  worldmonitor-camz
cd worldmonitor-camz
git config pull.ff only
```

Keep the Camz repository as `origin` and add the public project for comparison:

```bash
git remote add upstream https://github.com/koala73/worldmonitor.git
git remote -v
```

Do not merge or edit directly on `vendor/worldmonitor-main`. Create subsequent work from a pinned vendor or Camz branch.

## 2. Use the repository Node version

The repository pins Node 24 in `.nvmrc`.

```bash
nvm install
nvm use
node --version
```

Equivalent version managers such as `fnm`, `asdf`, or Volta are fine. The active major must be 24 for the supported local baseline.

To update an existing checkout without accepting an accidental merge commit:

```bash
git switch camz/local-foundation
git pull --ff-only origin camz/local-foundation
```

## 3. Install and run secret-safe diagnostics

The supported one-command setup is:

```bash
npm run camz:setup
```

It performs a deterministic `npm ci` and then runs the strict local readiness
diagnostic. It does not create or print provider credentials.

Before installing anything:

```bash
node scripts/camz-local-diagnostics.mjs
```

The command reports tool, checkout, dependency, optional-provider, vendor-provenance, and workflow-preservation readiness. It reads only environment-variable **names** when checking provider coverage; secret values are never returned or printed.

Machine-readable output:

```bash
node scripts/camz-local-diagnostics.mjs --json
```

Strict readiness, suitable for a local preflight:

```bash
node scripts/camz-local-diagnostics.mjs --strict
```

`--strict` remains non-zero until dependencies are installed. Missing Docker and optional provider keys are warnings, not hard failures.

## 4. Verify the accepted local build

```bash
npm run camz:verify
```

This sequential gate checks the Camz/ASX foundation, neutral context producer,
local operations tooling, TypeScript and the Finance production build. Heavy
checks stay sequential to avoid memory pressure.

For a test-only worktree that must skip lifecycle scripts, the repository also provides:

```bash
npm run worktree:bootstrap:test-only
```

Use `npm ci` for the normal local application because it honours the repository lockfile and completes the upstream post-install setup.

## 5. Optional provider environment

The base dashboard starts without provider credentials. Create `.env.local` only for the feeds you intend to use:

```bash
cp .env.example .env.local
```

On Windows PowerShell, use `Copy-Item .env.example .env.local`. Delete the
unused values or leave them empty; only configured keys enable their provider.

Useful optional groups include:

| Capability | Environment variables |
| --- | --- |
| Local or hosted AI | `LLM_API_URL`, `LLM_API_KEY`, `LLM_MODEL`, `OPENROUTER_API_KEY`, or `GROQ_API_KEY` |
| Equities and earnings | `FINNHUB_API_KEY` |
| US macro data | `FRED_API_KEY` |
| Energy | `EIA_API_KEY` |
| Conflict events | `ACLED_EMAIL` + `ACLED_PASSWORD`, or `ACLED_ACCESS_TOKEN` |
| Wildfires | `NASA_FIRMS_API_KEY` |
| Maritime AIS | `AISSTREAM_API_KEY` |
| Aviation | `AVIATIONSTACK_API` |
| Internet outages | `CLOUDFLARE_API_TOKEN` |

Never commit `.env`, `.env.local`, provider credentials, broker credentials, private research, or generated client reports.

For sensitive analysis, prefer an OpenAI-compatible local endpoint such as Ollama through `LLM_API_URL`. A desktop or local-AI configuration does not by itself prove every data request stays local; review the relevant provider path before using confidential material.

## 6. Start and smoke-test the Finance cockpit

In terminal 1:

```bash
npm run camz:start
```

In terminal 2:

```bash
npm run camz:smoke
```

Open `http://127.0.0.1:3000`, choose **Mission → Australia / ASX Desk**, and
keep the startup terminal open while using the dashboard. The smoke command
verifies that the dashboard HTML and compiled entry module are both reachable.
In Vite mode the absent Docker sidecar is an expected warning.

The local Vite watcher deliberately ignores tests, documentation, SDKs and
other non-runtime trees. This prevents large checkouts from exhausting Linux
watcher limits without reducing application hot reload coverage.

The focused verification covers:

- ASX cash-equity phases in `Australia/Sydney`;
- Sydney/Adelaide daylight-saving behaviour;
- the official 2026 ASX closure and early-close calendar;
- conservative `unknown` handling outside verified calendar years;
- finance observation provenance, age, source class, transformation, and confidence flags;
- proof that local diagnostics do not expose secret values.

## 7. Export trusted Runtime context

Write a neutral v1 payload to the gitignored `tmp/` directory:

```bash
npm run camz:context:export
```

The command writes `tmp/worldmonitor-context-v1.json` atomically with private
file permissions where supported. It records the exact producer commit and
exports the official deterministic ASX-session context. Timing-uncertain
Yahoo-derived quotes remain excluded. Use `--output <path>` to place the file
beside a local Stock Runtime checkout, and `--at <ISO-time>` for a reproducible
test vector.

## 8. Full private self-hosted stack

```bash
npm run camz:stack:init
npm run camz:stack:up
npm run camz:stack:status
npm run camz:stack:smoke
```

`camz:stack:init` creates or repairs the three required local-only secrets in
`.env` without overwriting configured values and without printing secret
values. The Compose stack then starts the application, authenticated AIS relay,
Redis and the authenticated Redis REST proxy.

Populate available data after the containers are healthy:

```bash
npm run camz:stack:seed
npm run camz:stack:smoke
```

The Node-based seeder runner is cross-platform. It runs the same
`scripts/seed-*.mjs` set sequentially, skips providers whose optional keys are
absent, and applies a 30-minute per-seeder timeout while leaving bundle seeders
to their own internal section timeouts. Use `npm run camz:stack:seed -- --list`
to preview the set or `--match earthquakes` to run a bounded subset.

Operational commands:

```bash
npm run camz:stack:logs
npm run camz:stack:status
npm run camz:stack:down
```

Open `http://127.0.0.1:3000`. The full-stack smoke checks the dashboard, built
entry asset, API sidecar and Redis-backed data-health path. `DEGRADED` is a
warning until the expected providers have produced data; `REDIS_DOWN` is
always a failure. After configuring every provider expected in your operating
profile, use `npm run camz:stack:smoke -- --require-data-ready` as the stricter
acceptance check.

The first run should be treated as an analyst cockpit, not an execution terminal. Keep broker/order entry and authoritative market data in their existing systems.

## 9. Optional: restore upstream GitHub workflows locally

The connected GitHub App lacks the special permission required to write `.github/workflows`. The vendor mirror therefore preserves upstream workflow files byte-for-byte under `.github/upstream-workflows-disabled`.

Preview the restore:

```bash
npm run camz:restore-workflows -- --dry-run
```

Restore them into the conventional path for local CI inspection:

```bash
npm run camz:restore-workflows
```

The command refuses to overwrite an existing `.github/workflows` directory. `--force` is available only after manually reviewing local changes.

Do not push the restored path through the current connected GitHub App; GitHub will reject it until the App receives workflow-write permission.

## 10. Deployment boundaries

The Vite Finance interface is the fastest analyst workflow. The Compose stack
adds private cache ownership, authenticated relay services and local seeding.
It does not turn delayed or undocumented data into licensed exchange data.

Before exposing any instance to the internet:

- review open authentication and security issues against the pinned upstream commit;
- generate unique relay and Redis secrets;
- restrict ingress and administrative routes;
- replace undocumented market endpoints where an authorised provider is available;
- document source and redistribution terms for every production feed;
- meet AGPL source-availability obligations for a modified public deployment.

## 11. Finance trust rules

The Camz enhancement direction is deliberately evidence-first:

- delayed/cached values are never labelled exchange-real-time without proof;
- estimated measures are labelled as estimates;
- undocumented or scraped access is visible rather than hidden;
- AI-derived implications remain distinct from observed facts;
- observation time and retrieval time are separate clocks;
- stale, future-dated, malformed, and unverified-calendar states fail visibly;
- no automatic trading or order routing is introduced.

The Australia/ASX workspace and neutral `1.0.0` read-only context producer are
implemented. The matching clean-room `Stock-Market-Agent-Runtime` consumer is
locally validated on its draft PR but remains unmerged while private-repository
GitHub Actions are unable to start. Until that consumer is accepted, local
World Monitor is operational as an intelligence cockpit and context producer,
but automated Runtime ingestion must be described as pending rather than live.
