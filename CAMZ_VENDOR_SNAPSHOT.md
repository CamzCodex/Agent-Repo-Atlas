# Camz vendor snapshot

This branch contains the World Monitor source tree from upstream commit
`9c51d04b2f0873f940227774ef8d65ce6d12900d` (tree `b8b9440111baae7eddd26b5b361d647591be1921`).

GitHub rejected a verbatim push because the connected GitHub App does not
have the special permission required to create files under
`.github/workflows`. The 21 upstream
workflow files are preserved byte-for-byte under
`.github/upstream-workflows-disabled`. Runtime and application source paths
are otherwise unchanged.

For local-only CI parity, copy that directory back to `.github/workflows`
after cloning. Do not commit the restored path through the connected App
unless it is later granted workflow-write permission.
