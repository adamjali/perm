# PERM Tracker for Claude Code

Adds [PERM Tracker](https://permtracker.app)'s MCP server to Claude Code, and two commands:

- `/permtracker:case G-100-26045-123456`: a DOL case's live status and what it means (PERM, prevailing wage, H-1B LCA, H-2A, H-2B, CW-1)
- `/permtracker:when 2026-02-15`: when a pending PERM case is likely to be decided

The tools read DOL's and the State Department's own records. No key is needed; a free key from permtracker.app (Settings, API keys) gives you your own limits.

Install: `/plugin marketplace add <this repository>` then `/plugin install permtracker`.
