# Neuro Map

This is the agent mental model for repo discovery.

## Sequence

1. State the task in plain language.
2. Search the atlas first.
3. Compare the best matches by fit, risk, license, and maintenance.
4. Choose the least risky acquisition mode that still solves the task.
5. Only then expand to broader research if the atlas does not cover the need.

## What agents should notice

- `category` tells you what kind of problem the repo maps to.
- `type` tells you what kind of artifact it is.
- `riskLevel` tells you how careful to be.
- `acquisitionMode` tells you how to consume it.
- `reviewRequiredBeforeUse` tells you whether a human-style check is needed before adoption.

## What not to do

- Do not equate listing with approval.
- Do not install a repo before checking license and maintenance.
- Do not use a high-risk bridge, shell, filesystem, auth, or infrastructure repo as trusted by default.

