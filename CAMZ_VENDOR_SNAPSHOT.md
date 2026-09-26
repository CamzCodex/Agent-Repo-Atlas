# Camz vendor snapshot

This branch contains the World Monitor source tree from upstream commit
`567b189acc063521818e1d0e2a55483a194508a4` (tree `2cda6cc04ea04bd0d8fc60ccaa2addaf996921ee`).

GitHub rejected a verbatim push because the connected GitHub App does not
have the special permission required to create files under
`.github/workflows`. The 49 upstream
workflow files are preserved byte-for-byte under
`.github/upstream-workflows-disabled`. Runtime and application source paths
are otherwise unchanged.

For local-only CI parity, copy that directory back to `.github/workflows`
after cloning. Do not commit the restored path through the connected App
unless it is later granted workflow-write permission.
