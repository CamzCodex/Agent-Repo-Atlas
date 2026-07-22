# World Monitor Operations Runbook

Last reviewed: 2026-07-22

## Data-health signals

Track provider success/failure, last provider success, last observation, observation age, schema changes, rejected records, cache fallbacks, superseded requests, rights-blocked exports, entity-review queue and alert deduplication.

## Incident procedures

| Incident | Immediate action | Recovery/verification |
| --- | --- | --- |
| Provider outage | Mark latest attempt unavailable; retain last-good only with original clock; consider provider kill switch | Probe allowed host; verify first recovered observation and no false freshness |
| Schema change | Quarantine new artifacts; keep previous parser/output; open provider incident | Update parser/version and replay fixtures before re-enable |
| Licensing concern | Disable export and provider-derived examples; preserve audit metadata | Rights owner documents decision; rerun export-filter tests |
| Stale macro source | Raise data-quality warning; prevent critical-context acceptance beyond policy | Confirm official release calendar and publication time |
| ASX calendar rollover | Fail session to unknown beyond verified range | Verify official schedule, version artifact and parity tests |
| Corrupted cache | Disable affected key/provider; never refresh retrieval clock on failed data | Rehydrate from verified raw/durable data; hash and freshness checks |
| Failed migration | Stop writers; preserve old store/read path | Execute tested down/forward recovery; reconcile counts and hashes |
| Rollback | Disable new adapter/exporter; return to last accepted SHA/config | Run smoke, data-health and no-false-freshness checks |
| Backup restore | Restore into isolated environment | Verify artifact hashes, revision counts, referential integrity and replay |
| Security incident | Kill provider/export/runtime ingestion; rotate exposed secrets; preserve forensic logs | Threat-specific tests, SBOM/dependency review, signed release |

## Zero-tolerance invariants

- False-freshness incidents: 0.
- Unsupported mission applications accepted: 0.
- Exported observations without source class/freshness basis/rights: 0.
- Automatic broker/order/portfolio actions: 0.

## Operator checklist before release

Confirm exact commit, workflow run, provider rights, schema digest, migrations/backups, kill switches, rollback SHA, dashboards/alerts and known skipped tests. Keep PR draft if any item is missing.
