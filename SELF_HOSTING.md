# 🌍 Self-Hosting World Monitor

Run the full World Monitor stack locally with Docker/Podman.

## 📋 Prerequisites

- **Docker** or **Podman** (rootless works fine)
- **Docker Compose** or **podman-compose** (`pip install podman-compose` or `uvx podman-compose`)
- **Node.js 24** (the supported `.nvmrc` target, used for host seed scripts)

## 🚀 Quick Start

```bash
# 1. Clone and enter the repo
git clone --branch camz/local-foundation --single-branch \
  https://github.com/CamzCodex/Agent-Repo-Atlas.git worldmonitor-camz
cd worldmonitor-camz
npm run camz:setup

# 2. Generate the REQUIRED local-only secrets without printing their values.
npm run camz:stack:init

# 3. Start the stack
npm run camz:stack:up

# 4. Seed data into Redis
npm run camz:stack:seed

# 5. Verify UI, API sidecar and Redis-backed data health
npm run camz:stack:smoke

# 6. Open http://127.0.0.1:3000 in your browser
```

The dashboard works out of the box with public data sources (earthquakes, weather, conflicts, etc.). API keys unlock additional data feeds.

The normal smoke command treats partially populated optional feeds as a
warning, but always fails if the local Redis path is down. Once every provider
required for your operating profile is configured, use
`npm run camz:stack:smoke -- --require-data-ready` for a strict data-readiness
gate.

Create the read-only neutral payload consumed by the Stock Runtime integration
branch with:

```bash
npm run camz:context:export
```

The default output is `tmp/worldmonitor-context-v1.json`. This operator-facing
export includes the official deterministic ASX-session context and excludes
quotes that lack a trustworthy observation time.

## 🔐 Required Environment Variables

These must be set before `docker compose up -d`, or one of the containers will exit on boot.

| Variable | Purpose | How to generate |
| --- | --- | --- |
| `RELAY_SHARED_SECRET` | Authenticates every non-public request the dashboard makes to the AIS relay. The relay refuses to start without it. | `npm run camz:stack:init` |
| `REDIS_PASSWORD` | Redis AUTH password (`--requirepass`). The Redis container refuses to start without it; the REST proxy uses it in its upstream connection string. | `npm run camz:stack:init` |
| `REDIS_TOKEN` | Bearer token the REST proxy (`redis-rest`) requires on every request, and the value the app sends as `UPSTASH_REDIS_REST_TOKEN`. The proxy and app containers refuse to start without it. | `npm run camz:stack:init` |

> Earlier releases shipped `wm-local-token` as a default for the REST token. That default has been removed (#3804) — the proxy was only reachable from `127.0.0.1:8079` so external exposure required a hostile `docker-compose.override.yml`, but any user who flipped that binding to `0.0.0.0` was instantly authenticated by a publicly documented string. Fresh installs and existing clones both need to set `REDIS_TOKEN` and `REDIS_PASSWORD` in `.env` from this release onward.

> Need to bring the relay up without auth for local debugging? Set `I_UNDERSTAND_THIS_DISABLES_AUTH=true` (the deprecated `ALLOW_UNAUTHENTICATED_RELAY=true` is still accepted). The relay will log a loud `[SECURITY]` warning at boot and every 5 minutes, and every non-public route will be reachable by anyone who can hit the port — **never use this on an internet-reachable host.**

## 🔑 API Keys

Add only the optional keys you use to the generated `.env`. Compose reads this
file and the cross-platform host seeder reads the same file, preventing
container and seeder configuration drift. The file is **gitignored**.

```dotenv
# LLM — choose local or hosted
LLM_API_URL=http://host.docker.internal:11434/v1/chat/completions
LLM_API_KEY=
LLM_MODEL=
GROQ_API_KEY=
OPENROUTER_API_KEY=

# Markets and economics
FINNHUB_API_KEY=
FRED_API_KEY=
EIA_API_KEY=

# Conflict, earth observation, aviation and maritime
ACLED_EMAIL=
ACLED_PASSWORD=
NASA_FIRMS_API_KEY=
AVIATIONSTACK_API=
AISSTREAM_API_KEY=
```

Do not commit `.env`. For a local LLM running on the same Windows/macOS host as
Docker Desktop, `host.docker.internal` is normally the correct container-to-host
name; Linux engines may require an explicit host-gateway mapping.

### 💰 Free vs Paid

| Status | Keys |
|--------|------|
| 🟢 No key needed | Earthquakes, weather, natural events, UNHCR displacement, prediction markets, stablecoins, crypto, spending, climate anomalies, submarine cables, BIS data, cyber threats |
| 🟢 Free signup | GROQ, FRED, EIA, NASA FIRMS, AISSTREAM, Finnhub, AviationStack, ACLED, OpenRouter |
| 🟡 Free (limited) | OpenSky (higher rate limits with account) |
| 🔴 Paid | Cloudflare Radar (internet outages) |

## 🌱 Seeding Data

The seed scripts fetch upstream data and write it to Redis. They run **on the host** (not inside the container) and need the Redis REST proxy to be running.

```bash
# Run all seeders using .env and the local Redis REST proxy
npm run camz:stack:seed
```

The Node runner works in PowerShell, Command Prompt, Bash and CI. The original
`./scripts/run-seeders.sh` remains available for POSIX operators who need its
shell-specific workflow.

**⚠️ Important:** Redis data persists across container restarts via the `redis-data` volume, but is lost on `docker compose down -v`. Re-run the seeders if you remove volumes or see stale data.

To automate, add a cron job:

```bash
# Re-seed every 30 minutes
*/30 * * * * cd /path/to/worldmonitor && npm run camz:stack:seed >> /tmp/wm-seeders.log 2>&1
```

**Per-seeder timeout (`SEED_TIMEOUT`):** standalone seeders are each wrapped in a
wall-clock cap so one hung upstream cannot starve the rest of the run. It defaults
to `1800` seconds (30 minutes); pass `--timeout 0` to disable or, for example,
`--timeout 600` to use ten minutes. Bundle seeders are exempt because they already
bound each section internally.

### 🔧 Manual seeder invocation

If you prefer to run seeders individually:

```bash
# Source .env so REDIS_TOKEN (and any API keys it holds) become available.
# Quick-start puts REDIS_TOKEN in .env, not in your shell — without this,
# the next line fails-loud with "REDIS_TOKEN: parameter null or not set".
set -a; . ./.env; set +a

export UPSTASH_REDIS_REST_URL=http://localhost:8079
export UPSTASH_REDIS_REST_TOKEN="${REDIS_TOKEN:?set REDIS_TOKEN in .env first}"
node scripts/seed-earthquakes.mjs
node scripts/seed-military-flights.mjs
# ... etc
```

`npm run camz:stack:seed` reads `REDIS_TOKEN` from `.env`, so the wrapper is the
simpler path. Use the manual form only when iterating on a single seeder.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│                 localhost:3000               │
│                   (nginx)                    │
├──────────────┬──────────────────────────────┤
│ Static Files │      /api/* proxy            │
│  (Vite SPA)  │         │                    │
│              │    Node.js API (:46123)       │
│              │    50+ route handlers         │
│              │         │                     │
│              │    Redis REST proxy (:8079)   │
│              │         │                     │
│              │      Redis (:6379)            │
└──────────────┴──────────────────────────────┘
         AIS Relay (WebSocket → AISStream)
```

| Container | Purpose | Port |
|-----------|---------|------|
| `worldmonitor` | nginx + Node.js API (supervisord) | 3000 → 8080 |
| `worldmonitor-redis` | Data store | 6379 (internal) |
| `worldmonitor-redis-rest` | Upstash-compatible REST proxy | 8079 |
| `worldmonitor-ais-relay` | Live vessel tracking WebSocket | 3004 (internal) |

> **`redis-rest` command allowlist**: the bundled proxy (`docker/redis-rest-proxy.mjs`) only
> forwards a fixed allowlist of Redis commands and rejects `EVAL`/`EVALSHA`/`SCRIPT` (no Lua
> scripting). Two consequences for a self-hosted stack:
>
> - `@upstash/ratelimit`'s Lua-based sliding-window limiter (`server/_shared/rate-limit.ts`,
>   `api/_rate-limit.js`) can't run against it. Both automatically detect the rejection once and
>   fall back to a non-Lua fixed-window limiter (`INCR` + `EXPIRE NX`) for the rest of the
>   process — rate limiting still enforces, just with fixed- instead of sliding-window semantics.
> - `scripts/ais-relay.cjs`'s own in-container seed loops (`UPSTASH_ENABLED`) also require
>   `UPSTASH_REDIS_REST_URL` to start with `https://` by default, which the plain-HTTP proxy
>   never satisfies. Set `UPSTASH_ALLOW_INSECURE_HTTP=true` on the `ais-relay` service (already
>   wired for `redis-rest` in `docker-compose.yml`) to opt into using the proxy from
>   inside the relay container.

## 🔨 Building from Source

```bash
# Frontend only (for development)
npx vite build

# Full Docker image
docker build -t worldmonitor:latest -f Dockerfile .

# Rebuild and restart
docker compose down && docker compose up -d
npm run camz:stack:seed
```

### ⚠️ Build Notes

- The Docker image uses **Node.js 24 Alpine** for both builder and runtime stages
- Blog site build is skipped in Docker (separate dependencies)
- The runtime stage needs `gettext` (Alpine package) for `envsubst` in the nginx config
- Docker nginx mirrors Vercel's `script-src` policy and does not allow `'unsafe-inline'`; hash-pin any custom inline scripts before adding them to a self-hosted build.
- If you hit `npm ci` sync errors in Docker, regenerate the lockfile with the container's npm version:
  ```bash
  docker run --rm -v "$(pwd)":/app -w /app node:24-alpine npm install --package-lock-only
  ```

## 🌐 Connecting to External Infrastructure

### Shared Redis (optional)

If you run other stacks that share a Redis instance, connect via an external network:

```yaml
# docker-compose.override.yml
services:
  redis:
    networks:
      - infra_default

networks:
  infra_default:
    external: true
```

### Self-Hosted LLM

Any OpenAI-compatible endpoint works (Ollama, vLLM, llama.cpp server, etc.):

```yaml
# docker-compose.override.yml
services:
  worldmonitor:
    environment:
      LLM_API_URL: "http://your-host:8000/v1/chat/completions"
      LLM_API_KEY: "your-key"
      LLM_MODEL: "your-model-name"
    extra_hosts:
      - "your-host:192.168.1.100"  # if not DNS-resolvable
```

## 🐛 Troubleshooting

| Issue | Fix |
|-------|-----|
| 📡 No healthy data groups | Seeders have not run — `npm run camz:stack:seed` |
| 🔴 nginx won't start | Check `podman logs worldmonitor` — likely missing `gettext` package |
| 🔑 Seeders say `REDIS_TOKEN is required` | Run `npm run camz:stack:init`, then confirm the stack is running |
| 🔒 Relay repeatedly restarts | Run `npm run camz:stack:check`; the relay and dashboard must share `RELAY_SHARED_SECRET` |
| 📦 `npm ci` fails in Docker build | Lockfile mismatch — regenerate with `docker run --rm -v $(pwd):/app -w /app node:24-alpine npm install --package-lock-only` |
| 🚢 No vessel data | Set `AISSTREAM_API_KEY` in both `worldmonitor` and `ais-relay` services |
| 🔥 No wildfire data | Set `NASA_FIRMS_API_KEY` |
| 🌐 No outage data | Requires `CLOUDFLARE_API_TOKEN` (paid Radar access) |
