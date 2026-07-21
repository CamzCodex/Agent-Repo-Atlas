# Camz World Monitor validation trigger

Owner-authorised audit marker for validating `camz/local-foundation` with Node 24.

The trusted workflows run the untouched vendor snapshot and the enhancement branch in parallel. Both restore the preserved upstream workflows, build the full dashboard artifacts required by built-output tests, and run the complete upstream unit/integration suite. The enhancement path additionally runs secret-safe diagnostics, Biome, focused tests, TypeScript, and the finance production build.

Validation run: 7.
