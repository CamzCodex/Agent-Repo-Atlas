# World Monitor Australia desk validation trigger

Owner-authorised audit marker for validating `camz/australia-desk` against `camz/local-foundation`.

The trusted workflow checks branch ancestry and whitespace, installs the locked dependencies, runs secret-safe diagnostics, Biome, focused ASX/provenance tests, restores the preserved upstream workflows locally, builds the full dashboard artifacts, runs the complete upstream unit/integration suite, type-checks the browser application, and builds the Finance production variant.

Validation run: 4 — includes mission-scoped ASX status, live seeded equity/resource cards, and visible provenance/freshness warnings.
