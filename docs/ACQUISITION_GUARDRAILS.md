# Acquisition Guardrails

## Default stance

Treat every external repo as untrusted until the atlas says otherwise.

## Modes

- `reference-only`: inspect patterns, do not install by default
- `reference-map-only`: use to find better candidates
- `dependency-candidate`: possible install target after review
- `template-candidate`: possible starting point for a new implementation
- `fork-candidate`: close fit but needs local changes
- `clone-candidate`: acceptable to duplicate when local ownership is required
- `sandbox-research-only`: useful, but isolate and test carefully
- `implementation-pattern`: mine for patterns, not direct adoption
- `do-not-use`: reject unless the task materially changes

## Safety rules

- Verify license before adoption.
- Treat shell, filesystem, auth, tunnel, credential, and infrastructure repos as high risk by default.
- Prefer reference use over direct dependency use when the code surface is broad.
- Keep review notes with the decision, not just the classification.

