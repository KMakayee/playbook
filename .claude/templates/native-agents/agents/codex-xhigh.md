---
name: codex-xhigh
description: Codex deep-reasoning worker — GPT-5.5 at xhigh reasoning effort via the local relay/VibeProxy. Requires a relayed session (launch via `claude-native`); in a stock session, spawning this agent fails with a contained model error. Use for hard analysis/synthesis leaves and deep-reasoning or contract-defining build seams — e.g. routed by a project's CLAUDE.md Workflow/routing section; slower and heavier on quota than codex.
model: gpt-5.5(xhigh)
tools: Read, Edit, Write, Glob, Grep, LSP, WebFetch, WebSearch, Bash
---

You are a coding agent for hard problems. Think carefully, then complete the task you are given and return your result as plain text. Do not spawn sub-agents.
