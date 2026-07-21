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
```

Keep the public upstream available for comparison:

```bash
git remote rename origin camz
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

## 3. Run secret-safe diagnostics

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

## 4. Install dependencies

```bash
npm ci
npm run camz:diagnostics -- --strict
```

For a test-only worktree that must skip lifecycle scripts, upstream also provides:

```bash
npm run worktree:bootstrap:test-only
```

Use `npm ci` for the normal local application because it honours the repository lockfile and completes the upstream post-install setup.

## 5. Create a local environment file

The base dashboard starts without provider credentials. Create `.env.local` only for the feeds you intend to use:

```bash
touch .env.local
chmod 600 .env.local
```

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

## 6. Validate the Camz foundation

Run focused tests first:

```bash
npm run test:camz-foundation
```

Then run the upstream gates sequentially:

```bash
npm run typecheck
npm run test:data
npm run build:finance
```

The focused suite covers:

- ASX cash-equity phases in `Australia/Sydney`;
- Sydney/Adelaide daylight-saving behaviour;
- the official 2026 ASX closure and early-close calendar;
- conservative `unknown` handling outside verified calendar years;
- finance observation provenance, age, source class, transformation, and confidence flags;
- proof that local diagnostics do not expose secret values.

## 7. Start the finance variant

```bash
npm run dev:finance
```

Open the Vite URL printed in the terminal, normally `http://localhost:3000`.

The first run should be treated as an analyst cockpit, not an execution terminal. Keep broker/order entry and authoritative market data in their existing systems.

## 8. Optional: restore upstream GitHub workflows locally

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

## 9. Full self-hosted stack

The Vite finance interface is much lighter than the complete data stack. Full self-hosting additionally needs Docker/Podman, Redis, the Redis REST proxy, relay services, generated secrets, and scheduled seeders.

Start with the browser application. Add the full stack only when there is a concrete need for private feeds, durable local cache control, a local relay, or custom seeders.

Before exposing any instance to the internet:

- review open authentication and security issues against the pinned upstream commit;
- generate unique relay and Redis secrets;
- restrict ingress and administrative routes;
- replace undocumented market endpoints where an authorised provider is available;
- document source and redistribution terms for every production feed;
- meet AGPL source-availability obligations for a modified public deployment.

## 10. Finance trust rules

The Camz enhancement direction is deliberately evidence-first:

- delayed/cached values are never labelled exchange-real-time without proof;
- estimated measures are labelled as estimates;
- undocumented or scraped access is visible rather than hidden;
- AI-derived implications remain distinct from observed facts;
- observation time and retrieval time are separate clocks;
- stale, future-dated, malformed, and unverified-calendar states fail visibly;
- no automatic trading or order routing is introduced.

The next integration step is an opt-in Australia/ASX workspace using these session and provenance primitives, followed by a read-only context adapter for `Stock-Market-Agent-Runtime`.
