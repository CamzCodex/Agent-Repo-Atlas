# World Monitor Australia desk validation trigger

Owner-authorised audit marker for validating `camz/australia-desk` against `camz/local-foundation`.

The trusted workflow checks branch ancestry and whitespace, installs the locked dependencies, runs secret-safe diagnostics, Biome, each Australia contract as a separately named test step, restores the preserved upstream workflows locally, builds the full dashboard artifacts, runs the complete upstream unit/integration suite, type-checks the browser application, and builds the Finance production variant.

Validation run: 13 — corrected the standardized `unverified` calendar-warning contract; all remaining Australia contracts now report independently.
