# World Monitor Implementation Roadmap

Last reviewed: 2026-07-22

## Ordered work packages

| WP | Outcome | Dependencies | Exit gate | Status |
| --- | --- | --- | --- | --- |
| WP1 | Close mission, macro race, request-order and clipboard defects | None | Focused + full upstream tests, TypeScript, full and Finance builds on exact published SHA | Implemented; hosted exact-head gate pending |
| WP2 | Transfer validated hardening into Australia desk and reconcile PR #6/#10 | WP1 | Clean ancestry; exact-head checks; accurate PR bodies | Blocked by WP1 exact-head validation |
| WP3 | Dedicated `worldmonitor-camz` migration plan | WP2 | Green source SHA, provenance, licence, protections and upstream-sync runbook | Planned |
| WP4 | Neutral observation/event/provider/rights contracts | WP2; licence decision | Schema examples and compatibility/security vectors accepted | Planned |
| WP5 | ABS and RBA official macro adapters | WP4 | Provider manifests, raw hashes, revisions, coverage and rights tests | Planned |
| WP6 | APRA, AEMO, DFAT and ASIC adapters | WP4–5 | Small provider PRs; health/runbook checks | Planned |
| WP7 | Licensed ASX boundary | Procurement and WP4 | Entitlement, universe, actions, timestamp and export tests | Blocked on procurement |
| WP8 | Historical store | WP4 | Idempotent replay, revision preservation, backup/restore | Planned |
| WP9 | Exposure/correlation hypothesis engine | WP6–8 | Dissent, limitations, sample size and no-causation tests | Planned |
| WP10 | Clean-room Stock Runtime provider | WP4 rights/security approval | Original payload archived; ResearchBag and no-trading tests | Planned |
| WP11 | Role/policy and adversarial evaluation | WP10 | Contribution attribution, dissent and invalidation conditions in final output | Planned |
| WP12 | Production readiness | WP5–11 | Security/rights review, observability, rollback, accessibility and release runbook | Planned |

## Immediate sequence

1. Run exact-head hosted validation for draft PR #12; do not substitute an earlier workflow.
2. Correct failures without widening the trust-fix scope.
3. Merge the fix PR only after every gate is green and explicit operator authorization; this roadmap does not grant it.
4. Revalidate PR #10 on its new exact head and correct its body.
5. Transfer/merge the validated hardening into `camz/australia-desk` only after a clean compare.
6. Revalidate PR #6; keep it draft while any gate is red/pending.
7. Approve or reject dedicated-repository migration.
8. Approve neutral spec ownership and licence before runtime implementation.

## Dedicated repository migration plan

Proposed destination: `CamzCodex/worldmonitor-camz`.

- Create only from the accepted World Monitor SHA, not `Agent-Repo-Atlas/main`.
- Preserve `.worldmonitor-upstream.json`, full Git history, AGPL licence and upstream attribution.
- Default branch becomes the Camz integration line; protect it with required exact-head tests and review.
- Maintain immutable `vendor/upstream-*` tags/branches and a documented upstream merge/rebase policy.
- Never squash away upstream identity or vendor commits.
- Register the new repository in Repo Intelligence and AMCP; demote the old Atlas lineage after verification.
- Retain Atlas branches read-only until commit/tree parity and rollback are proven.

## Release gates

- False freshness incidents: zero.
- Unsupported mission applications accepted: zero.
- Exported observations missing source class/freshness basis/rights: zero.
- Unknown schema major versions accepted: zero.
- Automatic broker/order/portfolio actions: zero.
- No AU breadth release without point-in-time universe coverage and corporate actions.
