# World Monitor Exact-Head Validation Gate

This gate extends the existing Australia validation-marker pattern without
hard-coding one feature branch. It validates an owner-authored, same-repository
target only when a marker pull request changes
`WORLDMONITOR_EXACT_HEAD_VALIDATE_TRIGGER.md`.

## Marker contract

The marker must contain exactly one value for each field:

```text
Target-Branch: `fix/worldmonitor-trust-defects`
Base-Branch: `camz/australia-adversarial-v4`
Expected-Head: `0000000000000000000000000000000000000000`
```

The workflow rejects missing values, malformed SHA values, invalid Git refs and
branch namespaces outside `vendor/`, `camz/` and `fix/`. It then checks out the
named target, proves exact SHA equality and base ancestry, and runs whitespace,
locked dependency, diagnostics, changed-file formatting, focused trust,
documentation, register, full-suite, type-check, full-dashboard and Finance
build gates.

## Trust boundary

- The pull request author must be the repository owner.
- The marker and target must be in the same repository.
- Workflow permissions are read-only.
- The workflow does not execute marker-branch code.
- A successful run applies only to the exact expected SHA recorded in the job
  log. A later target commit invalidates that result.

Validation-marker pull requests are operational scaffolding. Close them without
merging after recording the run against the target pull request.
