# PERM Tracker for Claude Code

Adds the [PERM Tracker](https://permtracker.app) MCP server to Claude Code, plus two commands.

- `/permtracker:case G-100-26045-123456`: a DOL case's status and what it means
- `/permtracker:when 2026-02-15`: when a pending PERM case is likely to be decided

## Install

In Claude Code, from the folder that holds `claude-plugin`:

```text
/plugin marketplace add ./claude-plugin
/plugin install permtracker@permtracker
```

No key needed. A free key from [permtracker.app/settings](https://permtracker.app/settings) (API keys) gives you your own limits.

More: [permtracker.app/developers](https://permtracker.app/developers).
