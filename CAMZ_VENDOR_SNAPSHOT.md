# Camz vendor snapshot

This branch contains the World Monitor source tree from upstream commit
`d039bb951098a030125c4f01a21a05f7bccee526` (tree `dc7f8b46ff6eefad5161644284f103584d09580b`).

GitHub rejected a verbatim push because the connected GitHub App does not
have the special permission required to create files under
`.github/workflows`. The 44 upstream
workflow files are preserved byte-for-byte under
`.github/upstream-workflows-disabled`. Runtime and application source paths
are otherwise unchanged.

For local-only CI parity, copy that directory back to `.github/workflows`
after cloning. Do not commit the restored path through the connected App
unless it is later granted workflow-write permission.
