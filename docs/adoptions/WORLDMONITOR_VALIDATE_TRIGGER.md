# Camz World Monitor validation trigger

Owner-authorised audit marker for validating `camz/local-foundation` with Node 24.

The trusted workflow checks out the fixed enhancement branch, installs the lockfile without lifecycle scripts, runs secret-safe diagnostics, Biome on modified files, focused foundation tests, restores preserved upstream workflows locally for CI parity, runs the full upstream unit/integration suite with explicit failing-test reporting, TypeScript, and the finance production build.

Validation run: 5.
