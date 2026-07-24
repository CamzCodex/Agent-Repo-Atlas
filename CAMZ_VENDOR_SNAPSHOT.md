# Camz vendor snapshot

This branch contains the World Monitor source tree from upstream commit
`c4cb09144bf58d9abcb5d692f4c6fd7d06f46f8c` (tree `7d850e624be04769212a5ab0fbdce03b7d99cbd0`).

GitHub rejected a verbatim push because the connected GitHub App does not
have the special permission required to create files under
`.github/workflows`. The 22 upstream
workflow files are preserved byte-for-byte under
`.github/upstream-workflows-disabled`. Runtime and application source paths
are otherwise unchanged.

For local-only CI parity, copy that directory back to `.github/workflows`
after cloning. Do not commit the restored path through the connected App
unless it is later granted workflow-write permission.
