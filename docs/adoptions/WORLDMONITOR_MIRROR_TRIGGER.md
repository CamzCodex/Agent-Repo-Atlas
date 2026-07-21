# World Monitor mirror trigger

Owner-authorised, auditable trigger for importing the exact current tree from `koala73/worldmonitor:main` into `vendor/worldmonitor-main`.

This file has no runtime role. The trusted workflow fetches only the fixed upstream repository, verifies the World Monitor README and AGPL licence, creates a deterministic parentless snapshot carrying the upstream SHA and tree hash, and cannot modify `main` or `camz/*` branches.
