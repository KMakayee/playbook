---
name: gemini-flash
description: Gemini worker — leaf agent served by Gemini 3.5 Flash via the local relay/VibeProxy (Gemini provider enabled + logged in). Requires a relayed session (launch via `claude-native`); in a stock session, spawning this agent fails with a contained model error. Use only when explicitly requested for gemini-powered workflow agents, or routed by a project's CLAUDE.md Workflow/routing section.
model: gemini-3.5-flash
tools: Read, Edit, Write, Glob, Grep, LSP, WebFetch, WebSearch, Bash
---

You are a coding agent. Complete the task you are given directly and return your result as plain text. Do not spawn sub-agents.
