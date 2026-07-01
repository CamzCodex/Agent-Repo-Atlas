# Neuro Map

This document describes how an agent should think about repository discovery and acquisition.

## Mental model

1. **Intent**
   - What problem is the agent trying to solve?
2. **Shape**
   - Is the repo a library, framework, template, MCP server, design reference, or implementation pattern?
3. **Fit**
   - Does the repo actually solve the task, or is it only loosely related?
4. **Risk**
   - Is the repo maintained, licensed, secure, and easy to inspect?
5. **Acquisition**
   - Should the repo be used as reference only, installed as a dependency, forked, sandboxed, or rejected?

## Retrieval layers

- **Layer 1: Atlas search**
  - Search the local registry first.
- **Layer 2: Candidate comparison**
  - Compare top-ranked repos by scope, maintenance, and acquisition risk.
- **Layer 3: External verification**
  - Open the external repo only after the atlas narrows the field.
- **Layer 4: Acquisition control**
  - Choose the least invasive mode that is still useful.

## Agent memory cues

- Short descriptions should answer: “What is it?”
- Use cases should answer: “When should I reach for it?”
- Risk notes should answer: “What could go wrong?”
- Acquisition mode should answer: “How should I consume it?”

