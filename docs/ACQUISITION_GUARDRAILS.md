# Acquisition Guardrails

## Default policy

Treat every external repo as untrusted until proven useful and safe.

## Use as reference

Use when the repo is valuable for patterns, examples, architecture, naming, or implementation strategy, but should not be installed.

## Use as dependency candidate

Use when the repo is actively maintained, has a clear license, and offers a practical runtime advantage.

## Use as fork candidate

Use when the repo is close to the required shape, but needs local modifications or missing features.

## Use as sandbox research

Use when the repo is interesting, but the surface area, maintenance state, or license makes direct adoption risky.

## Reject

Reject when:

- The license is unclear or incompatible.
- The repo is stale and unmaintained.
- The trust boundary is too broad.
- The repo duplicates better-known options without adding value.

## Safety rules

- Do not import code blindly.
- Verify the license before installation.
- Prefer shallow inspection before cloning large dependency trees.
- Record why a repo was accepted or rejected.

