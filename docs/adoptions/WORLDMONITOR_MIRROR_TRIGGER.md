# World Monitor mirror trigger

Owner-authorised, auditable trigger for importing the current `koala73/worldmonitor:main` source tree into `vendor/worldmonitor-main`.

This file has no runtime role. The trusted workflow fetches only the fixed upstream repository, verifies the World Monitor README and AGPL licence, records the upstream SHA and tree hash, and cannot modify `main` or `camz/*` branches.

Diagnostic rerun: 2.
