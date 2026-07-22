# World Monitor Australia desk validation trigger

Owner-authorised audit marker for validating `camz/australia-desk` against `camz/local-foundation`.

The trusted workflow checks branch ancestry and whitespace, installs the locked dependencies, runs secret-safe diagnostics, Biome, stable mission-core and Australia-extension contracts, immutable per-call breaker state, quote-array cache provenance, ASX session/provenance/render/export contracts, restores the preserved upstream workflows locally, builds the full dashboard artifacts, runs the complete upstream unit/integration suite, type-checks the browser application, and builds the Finance production variant.

Validation run: 15 — retriggered after removing Markdown hard-break whitespace; validates the complete adversarial hardening head.
