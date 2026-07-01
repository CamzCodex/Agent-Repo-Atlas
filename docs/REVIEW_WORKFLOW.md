# Review Workflow

1. Capture the repo or reference map in the review queue.
2. Classify category, type, acquisition mode, and risk level.
3. Check the license and maintenance state.
4. Record manual review reasons.
5. Decide whether the item should become a full atlas entry.
6. Regenerate the index and rerun validation.

## Practical rule

If the repo touches shell execution, filesystem access, auth, tunnels, or infrastructure, treat it as high risk and avoid presenting it as an easy adoption candidate.

