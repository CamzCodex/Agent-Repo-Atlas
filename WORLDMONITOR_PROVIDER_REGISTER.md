# World Monitor Provider Register

Last reviewed: 2026-07-22

Status values: current, fallback, planned, blocked-rights, disabled.

| Provider ID | Provider/dataset | Source class | Auth | Release/freshness policy | Cache/retention | Rights/export | Health expectation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WM-YAHOO-AU-001 | Yahoo-derived ASX/FX/commodity quotes | undocumented endpoint | None/undocumented | Timing uncertain; never call exchange-real-time | Existing market cache; last-good explicit | Internal context only; redistribution unreviewed | Failure and stale state visible | fallback |
| WM-ASX-CAL-001 | Official ASX cash-market calendar/reference material | official public file/page | None | Annual verification; fail unknown outside verified coverage | Static versioned artifact | Attribution/terms review required | 2026 verified; 2027 required | current |
| WM-ABS-001 | CPI, labour, wages, retail/household, lending inputs | official public API/file | To assess | Release calendar plus revisions | Raw hash + observations/revisions | Terms review before export | Missing/revised release alerts | planned |
| WM-RBA-001 | Cash rate, yield curve, TWI, commodity index, credit | official public API/file | None/to assess | Dataset-specific; preserve publication and revision | Raw hash + durable history + hot cache | Attribution and reuse terms required | Observation age and schema drift | planned |
| WM-APRA-001 | ADI capital, liquidity and exposure data | official public file | None/to assess | Quarterly/monthly by dataset | Raw file retention; revision history | Terms review before redistribution | Coverage and late-release alerts | planned |
| WM-AEMO-001 | Spot prices, demand, generation mix, interconnectors | official/licensed public data | Registration may apply | Near-real-time/settlement-specific | Bounded hot cache + raw artifacts | Dataset licence and downstream display rules | Region coverage and delay | planned |
| WM-DFAT-001 | Australian sanctions | official public file/page | None | Poll against publication changes | Versioned artifacts/events | Public-law source; attribution/terms review | Hash and entity-diff alerts | planned |
| WM-ASIC-001 | Company/register/open datasets | official public API/file | Dataset-specific | Dataset-specific | Versioned raw artifacts | Fees/terms/privacy vary | Schema and entitlement failures | planned |
| WM-ASX-LIC-001 | Security master, announcements, actions, status and quotes | licensed observation | Entitlement required | Contract/SLA-specific | Entitlement-aware cache/retention | Export only when explicitly licensed | Coverage, latency and entitlement alarms | blocked-rights |

## Mandatory provider manifest

Every implementation must declare: provider ID, dataset IDs, allowed hosts, authentication, release schedule, freshness basis, rights policy, cache permission, retention, parser version, raw artifact hash policy, validation rules, kill switch and health thresholds.

Providers may not be added directly inside UI components.
