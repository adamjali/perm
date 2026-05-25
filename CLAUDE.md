# CLAUDE.md - PERM Tracker

**Status:** Production | **Version:** 2.0.0 | **Last Updated:** 2026-05-24

## Production URLs

- **Frontend:** https://permtracker.app
- **Convex Dashboard:** https://dashboard.convex.dev

## Tech Stack

- **Frontend:** Next.js 16.2.6 + React 19.2.6 + TypeScript (Vercel)
- **Backend:** Convex 1.39 (serverless functions)
- **Database:** Convex (built-in, real-time)
- **Authentication:** Convex Auth + Google OAuth
- **Email:** Resend
- **Push Notifications:** Web Push (VAPID)
- **AI Chat:** Vercel AI SDK v6 + Multi-provider (Gemini, Groq, Mistral, OpenRouter, Cerebras)
- **Testing:** Vitest 4 (4300+ tests) + Playwright (E2E)

---

## Documentation

| Topic | File |
|-------|------|
| **Developer Guide (PRIMARY)** | [v2/CLAUDE.md](v2/CLAUDE.md) |
| **API Reference** | [v2/docs/API.md](v2/docs/API.md) |
| Design System | [v2/docs/DESIGN_SYSTEM.md](v2/docs/DESIGN_SYSTEM.md) |
| Animation Catalog | [v2/docs/ANIMATION_STORYBOARD.md](v2/docs/ANIMATION_STORYBOARD.md) |
| PERM Workflow (canonical) | [perm_flow.md](perm_flow.md) |
| Testing Guide | [v2/TEST_README.md](v2/TEST_README.md) |
| **Codebase Map (7 docs)** | [.planning/codebase/](.planning/codebase/) |
| Planning & Roadmap | [.planning/](.planning/) |

**See [v2/CLAUDE.md](v2/CLAUDE.md) for Quick Start, commands, patterns, and all developer docs.**

---

## Codebase Map

Deep-dive documentation in `.planning/codebase/` (3,856 lines, last updated 2026-02-21). **Read these before making significant changes.**

| Document | Lines | What It Covers | When To Read |
|----------|-------|----------------|--------------|
| [STACK.md](.planning/codebase/STACK.md) | 279 | All dependencies with versions, config files inventory, runtime details, CI/CD, pnpm overrides, version compatibility notes | Adding/upgrading dependencies, debugging build issues |
| [INTEGRATIONS.md](.planning/codebase/INTEGRATIONS.md) | 459 | Every external API (AI, email, push, calendar, search, Sentry), env vars inventory, webhook flows, auth providers, sequence diagrams | Working with external services, adding integrations, env var questions |
| [ARCHITECTURE.md](.planning/codebase/ARCHITECTURE.md) | 595 | System architecture with Mermaid diagrams, data flows (case CRUD, auth, AI chat, notifications), state management, API layer, database tables, dependency graph | Understanding how systems connect, planning new features, debugging data flow |
| [STRUCTURE.md](.planning/codebase/STRUCTURE.md) | 720 | Every directory and file with descriptions, naming conventions, import patterns, barrel exports, module boundaries, where to add new code | Finding files, understanding organization, adding new features |
| [CONVENTIONS.md](.planning/codebase/CONVENTIONS.md) | 580 | TypeScript patterns, React patterns, Convex patterns, error handling, date protocol, form patterns, CSS/styling, naming rules, anti-patterns with examples | Writing new code, code review, understanding project patterns |
| [TESTING.md](.planning/codebase/TESTING.md) | 800 | All 151 test files listed, Vitest config (3 projects), test utilities inventory, mocking patterns, coverage setup, flaky tests, factory patterns | Writing tests, debugging test failures, understanding test infrastructure |
| [CONCERNS.md](.planning/codebase/CONCERNS.md) | 423 | Risk matrix, tech debt (SWC bug, disabled React Compiler), dead code audit, security concerns, performance bottlenecks, dependency vulnerabilities, prioritized recommendations | Before refactoring, sprint planning, addressing tech debt |

---

## GSD Workflow

Uses GSD (`~/gsd-adam`). Config: quality profile, all gates ON, auto_advance OFF, branching none.
v1.0 (10 phases) + v2.0 (22 phases) shipped. Post-v2 features ongoing.
Key: `/gsd:feature`, `/gsd:quick`, `/gsd:map-codebase`, `/gsd:help`

---

## Deployment

Push to main triggers auto-deploy:
- **Vercel:** Frontend rebuild
- **Convex:** `npx convex deploy -y` (manual, from `v2/`)

### Project Names (avoid confusion)

| Service | Name | Notes |
|---------|------|-------|
| GitHub repo | `perm` | See remote origin |
| Local folder | `perm-tracker/v2/` | All code lives in `v2/` |
| Vercel project | `perm` | Deploys from `v2/`, hosts `permtracker.app` |
| Convex prod | See `.env.local` | `npx convex deploy -y` from `v2/` |
| Convex dev | See `.env.local` | `npx convex dev` from `v2/` |

**Always run commands from `v2/` directory.** Claude is always launched from `v2/`. Vercel CLI is linked to project "perm" via `v2/.vercel/project.json`.

---

## Resources

- **Convex:** https://docs.convex.dev
- **DOL PERM:** https://flag.dol.gov/programs/perm
- **20 CFR 656.40:** https://www.ecfr.gov/current/title-20/chapter-V/part-656/subpart-D/section-656.40
