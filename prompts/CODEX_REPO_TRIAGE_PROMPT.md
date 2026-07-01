# Codex Repo Triage Prompt

Classify the repository candidate for Agent Repo Atlas.

Return:

- category
- type
- acquisition mode
- risk level
- manual review reasons
- one-line agent use instruction

If the repo touches shell execution, filesystem access, auth, tunnels, credentials, or infrastructure, mark it high risk.

