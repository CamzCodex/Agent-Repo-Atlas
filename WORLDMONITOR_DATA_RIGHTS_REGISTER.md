# World Monitor Data Rights Register

Last reviewed: 2026-07-22

This is an engineering control register, not legal advice. Unknown rights fail closed for external export.

| Rights ID | Dataset/provider | Current use | Cache | Retention | Export/redistribution | Required decision | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RIGHT-YAHOO-AU | Yahoo-derived AU quote path | Internal situational context fallback | Existing bounded cache | No new durable redistribution store | Not approved | Replace with licensed source; retain only if terms permit | Unreviewed |
| RIGHT-ASX-CALENDAR | ASX schedules/reference | Session/calendar model | Versioned static artifact | Preserve version/source date | Attribution/quotation limits to review | Verify official terms and 2027 source | Review required |
| RIGHT-ABS | ABS datasets | Not implemented | Proposed per manifest | Raw/revision history proposed | Terms and attribution required | Dataset-by-dataset review | Pending |
| RIGHT-RBA | RBA datasets | Not implemented | Proposed per manifest | Raw/revision history proposed | Terms and attribution required | Dataset-by-dataset review | Pending |
| RIGHT-APRA | APRA datasets | Not implemented | Proposed per manifest | Raw/revision history proposed | Terms and confidentiality review | Dataset-by-dataset review | Pending |
| RIGHT-AEMO | AEMO data | Not implemented | Dataset/SLA-specific | Dataset/SLA-specific | Licence-dependent | Procurement/registration and display review | Pending |
| RIGHT-DFAT | Sanctions material | Not implemented | Versioned public artifacts | Point-in-time history | Source attribution; false-positive controls | Legal/terms review | Pending |
| RIGHT-ASIC | ASIC open/register data | Not implemented | Dataset-specific | Dataset/privacy-specific | Fees, terms and privacy vary | Dataset-by-dataset review | Pending |
| RIGHT-ASX-LICENSED | Licensed ASX data | Not procured | Entitlement-specific | Contract-specific | Never assume export permission | Procurement specification and signed entitlement map | Blocked |
| RIGHT-CAMZ-CONTEXT | Independently authored context metadata | Draft design | Archive with run | As governed by run retention | Intended neutral contract | Owner must select licence in dedicated spec repo | Pending owner decision |

## Enforcement

- `rightsPolicy`, `cachePermission`, `retentionPolicy` and `exportPermission` are mandatory on exportable records.
- Missing or unknown export permission rejects external export.
- Runtime consumer rechecks rights; producer approval alone is insufficient.
- Entitled values cannot leak through logs, examples, screenshots, MCP, archives or fallback fields.
- Export audit records payload ID, caller/purpose, policy decision and filtered fields without storing secrets.
