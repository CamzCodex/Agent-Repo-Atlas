# Camz vendor snapshot

This branch contains the World Monitor source tree from upstream commit
`ae6d08b447c40e3adccff2d3c8db5df788bd2161` (tree `023c6321fbf4bf891297a9ae26bc3b7e4c8426b7`).

GitHub rejected a verbatim push because the connected GitHub App does not
have the special permission required to create files under
`.github/workflows`. The 50 upstream
workflow files are preserved byte-for-byte under
`.github/upstream-workflows-disabled`. Runtime and application source paths
are otherwise unchanged.

For local-only CI parity, copy that directory back to `.github/workflows`
after cloning. Do not commit the restored path through the connected App
unless it is later granted workflow-write permission.
