# Australia / ASX Desk — Adversarial Pass 2

Status: implementation complete; exact-head validation pending

Branch: `camz/australia-adversarial-v3`

Base: latest `camz/australia-desk` at branch creation

Review dimensions: asynchronous state integrity, stale-cache honesty, UI semantics, machine contract safety, clipboard behavior, variant isolation, and concurrent-branch reconciliation.

## Executive finding

The first adversarial pass fixed the largest original trust defects, but a second hostile review found that **the age of displayed data and the health of the latest refresh attempt were still not consistently separate concepts**.

That distinction matters when a panel retains last-good values after a failed request. A quote can be recent enough to display while the latest provider attempt is unavailable or offline. Downstream agents and analysts need both facts.

The second pass also found obsolete-response races, clipboard-denial failure, misleading UI colour semantics, a hard-coded green session-evidence label, and weak machine enforcement of the no-trading and rights boundaries.

No broker execution, order placement, position sizing, target-price generation, portfolio mutation, or automatic trading path was found.

## Finding register

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| AU-ADV2-001 | Critical trust | A retained quote array could preserve old delivery metadata and hide that a later refresh attempt failed. | Fixed; validation pending |
| AU-ADV2-002 | High state integrity | Overlapping Australia quote requests had no newest-request-wins guard; an obsolete response could overwrite newer panel state. | Fixed; validation pending |
| AU-ADV2-003 | High state integrity | Mission changes and panel destruction did not invalidate in-flight Australia quote work. | Fixed; validation pending |
| AU-ADV2-004 | High downstream integrity | The v1 export did not expose group-level displayed state separately from latest-attempt state. | Fixed in v2; validation pending |
| AU-ADV2-005 | Medium UX/security | A present but denied Clipboard API produced `Copy failed` without attempting the safe textarea fallback. | Fixed; validation pending |
| AU-ADV2-006 | Medium UX | Rapid copy clicks could create concurrent clipboard operations and competing feedback timers. | Fixed; validation pending |
| AU-ADV2-007 | Medium UI integrity | A valid quote with missing percentage change was coloured red, visually implying a loss. | Fixed; validation pending |
| AU-ADV2-008 | Medium UI integrity | The session evidence label was hard-coded green even when the ASX calendar state was unknown or degraded. | Fixed; validation pending |
| AU-ADV2-009 | Medium contract safety | No-trading and rights constraints were human-readable strings only. | Fixed with machine controls in v2; validation pending |
| AU-ADV2-010 | Medium contract maintenance | Source-review age/status existed in the snapshot but was absent from the exported machine contract. | Fixed in v2; validation pending |
| AU-ADV2-011 | Medium variant isolation | `applyMissionPresetToState()` can be called programmatically with an extension unavailable for the supplied variant. | Open; UI/stored paths already filter |
| AU-ADV2-012 | Low concurrency | The global latest-request registry is completion-ordered, not start-ordered. | Controlled for Macro Tiles by explicit epoch/state; general improvement open |
| AU-ADV2-013 | Low UX resilience | Clipboard writes have no explicit timeout if the platform promise never settles. | Open; bounded feedback starts after settlement |
| AU-ADV2-014 | Refuted | The WeakMap alone was assumed to remain the only evidence path. The latest base already added a bounded symbol-set registry and defensive copies. | Refuted after reconciliation |

## Detailed findings and mitigations

### AU-ADV2-001 — Retained data hid the latest failed refresh

The commodity path can return an empty unavailable result while the panel intentionally retains an older usable resource array. Array-associated metadata then continues to describe the retained values but says nothing about the failed refresh that just occurred.

Mitigation:

- delivery metadata now retains both `dataState` and `latestAttemptState`;
- a bounded symbol-set registry preserves the newest completed request state even when an old array remains displayed;
- the Australia snapshot queries the explicit panel state first, then array delivery state, then symbol-set latest-attempt state;
- warnings state when a failed/offline refresh occurred while last-good observations remain visible;
- exports keep group delivery and latest-attempt state separate.

### AU-ADV2-002 — Obsolete asynchronous responses

Macro Tiles could begin two quote loads and apply whichever completed last, regardless of which request was newer. This is a classic stale-response write.

Mitigation:

- `_australiaLoadEpoch` increments for every load;
- only the current epoch may mutate displayed state;
- an equal-or-newer breaker timestamp is required before replacing displayed observations;
- tests statically lock the epoch and timestamp guards.

### AU-ADV2-003 — Mission and teardown races

A request started under the Australia mission could finish after the user switched missions or after the panel began teardown.

Mitigation:

- mission state transitions increment the load epoch;
- panel destruction increments the epoch;
- the panel abort signal, epoch, and active-mission state are checked after awaits;
- obsolete results are ignored without mutating hidden state.

### AU-ADV2-004 — Export contract conflated data age and refresh health

The v1 JSON envelope exposed observation `dataMode`, but not a group-level latest refresh attempt. A downstream system could not tell “cached but usable, latest refresh failed” from “cached and latest refresh succeeded.”

Mitigation:

- schema version bumped to `worldmonitor-australia-context-v2` while the contract is still draft;
- `groups.australianEquities` and `groups.audAndResources` each contain:
  - `dataMode`;
  - `dataOffline`;
  - `latestAttemptMode`;
  - `latestAttemptOffline`;
- displayed observation clocks remain unchanged by a later failed attempt.

### AU-ADV2-005 and AU-ADV2-006 — Clipboard denial and reentrancy

Feature detection is not permission detection. A browser may expose `navigator.clipboard.writeText` and still reject the call.

Mitigation:

- a rejected Clipboard API call falls back to a temporary read-only textarea;
- the textarea is removed in `finally`, including exception paths;
- the copy button disables before the first await;
- repeated clicks are ignored while a copy is active;
- feedback timers are bounded and cleared on teardown.

Residual: a platform clipboard promise that never settles can still keep the control disabled. A future shared clipboard helper should add a timeout and telemetry before this pattern is reused elsewhere.

### AU-ADV2-007 and AU-ADV2-008 — Misleading colour semantics

Two visual states overstated certainty:

- missing percentage change was treated as negative;
- session evidence remained green when the model was in unknown-calendar state.

Mitigation:

- missing or zero change renders neutral;
- positive and negative colours require an actual finite non-zero change;
- session evidence uses the same tone as the ASX session/calendar state.

### AU-ADV2-009 — Human-only safety constraints

A downstream agent should not need natural-language interpretation to determine whether the context authorizes trading.

Mitigation in v2:

```text
controls.readOnly = true
controls.investmentRecommendationIncluded = false
controls.targetPriceIncluded = false
controls.positionSizingIncluded = false
controls.orderInstructionIncluded = false
controls.executionInstructionIncluded = false
controls.causationEstablished = false
controls.providerRightsStatus = internal-research-only
controls.redistributionRightsReviewed = false
```

The narrative constraints remain for humans, but machine controls are authoritative for consumers.

### AU-ADV2-010 — Source-review status omitted from export

The ASX schedule model already tracked the static source-check date and emitted a 90-day review warning. The machine export omitted the age and status.

Mitigation:

- `asx.sourceReviewAgeMs` is exported;
- `asx.sourceReviewStatus` is one of `current`, `overdue`, `future`, or `invalid`;
- the evaluation clock remains separate from the official source-review clock.

### AU-ADV2-011 — Programmatic variant bypass

The picker and stored-preset loader filter Australia to the full and Finance variants. However, a direct call such as:

```ts
applyMissionPresetToState('australia-market-watch', settings, layers, 'tech')
```

can still resolve the extension and fall back toward variant defaults instead of failing closed.

Recommended fix:

```ts
if (!isPresetAvailableForVariant(preset, variant)) {
  throw new Error(`Mission preset ${presetId} is not available for variant ${variant}`);
}
```

This remains open because the mission module was moving concurrently during the review. The user-facing and persisted paths are already filtered, so the issue is bounded to direct/programmatic callers.

### AU-ADV2-012 — Completion order versus invocation order

The bounded symbol-set registry records completed request attempts. Without request sequence metadata, an older invocation that completes later can become the registry’s latest entry.

Macro Tiles is protected by its own monotonic epoch and explicit per-panel states. A broader market-service improvement would carry a request sequence through the result and only advance the registry monotonically.

## Reconciliation control

During this pass, `camz/australia-desk` advanced several times and touched the same evidence files. Direct writes correctly failed on SHA mismatch.

Controls applied:

1. stopped instead of overwriting;
2. compared the moving base against the pinned branch point;
3. confirmed the newer base independently adopted bounded request-state storage, defensive copies, latest-attempt metadata, invalid-price rejection, and stronger test reset behavior;
4. rebuilt the non-duplicated fixes on `camz/australia-adversarial-v3`;
5. closed the obsolete stacked PR without merge.

## Acceptance gate

Pass 2 is acceptable only when the exact head passes:

1. focused ASX, provenance, market-state, rendering, export, mission, and China-tab contracts;
2. Biome on every touched source and test file;
3. the complete upstream `test:data` suite;
4. browser TypeScript checking;
5. the Finance production build;
6. review confirming no execution or brokerage surface entered the diff.

Until then the PR remains draft and unmerged.

## Next improvement order

1. Fail closed inside `applyMissionPresetToState()` for variant-incompatible extensions.
2. Add a shared clipboard helper with timeout, permission/error telemetry, and consistent fallback behavior.
3. Add request sequence IDs to market-service results and latest-attempt registries.
4. Instrument overlapping symbol-set cache keys before attempting request coalescing.
5. Replace undocumented market sources with licensed/official Australian data where practical.
6. Verify and transcribe the next official ASX cash calendar before the first unverified 2027 weekday.
