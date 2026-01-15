# PERM Tracker

## Vision

A simple, intuitive web app for immigration attorneys to track PERM labor certification cases. PERM deadlines are notoriously tricky with complex interdependencies — miss one and the whole case can be jeopardized. PERM Tracker takes the stress out of deadline management.

## Core Features

- **Case tracking** — Clean, organized view of all your PERM cases and their status
- **Deadline auto-calculation** — Automatically computes critical dates per DOL regulations (PWD expiration, ETA 9089 filing windows, I-140 deadlines)
- **Deadline validation** — Catches errors before they become problems (Sunday ads on Sundays, proper sequencing, filing windows)
- **Calendar integration** — Two-way Google Calendar sync keeps deadlines visible
- **Email reminders** — Proactive notifications so nothing slips through
- **Import/Export** — Easy data portability
- **AI Chatbot** — Answers questions about PERM regulations, explains website features, queries your case data, and can take actions on the page to help automate workflows

## Tech Stack

### Current (v1.0)
- **Frontend:** HTML/CSS/JS + Tailwind CSS + Alpine.js (Vercel)
- **Backend:** FastAPI + Python 3.11+ (Render)
- **Database:** PostgreSQL with Row-Level Security (Supabase)
- **Integrations:** Google Calendar API, Resend Email, Google OAuth

### Target (v2.0 Migration)
- **Frontend:** Next.js 16+ App Router + React + Tailwind v4 (Vercel)
- **Backend:** Convex serverless functions (TypeScript)
- **Database:** Convex (document DB with real-time subscriptions)
- **Auth:** Convex Auth (Clerk-ready)
- **AI:** Vercel AI SDK + CopilotKit
- **Hosting:** Vercel only (consolidated)
- **Status System:** Two-tier (5 Case Statuses + 6 Progress Statuses)

> **Reference:** See `V2_ORIGINAL_VISION.md` for complete user requirements

> **Note:** All frontend/UI work must use the frontend-design skill (its a plug-in) - reference `.planning/FRONTEND_DESIGN_SKILL.md` for design requirements.

## Context

**Production URLs:**
- Frontend: https://permtracker.app (PWA enabled)
- Backend API: https://perm-tracker-api.onrender.com
- API Docs: https://perm-tracker-api.onrender.com/api/docs

**Environments:**
- Production: Render (backend) + Vercel (frontend) + Supabase (database)
- Test: Local dev servers + test Supabase instance

**Key Documentation:**
- `perm_flow.md` — **SOURCE OF TRUTH** for case statuses, progress statuses, stage transitions, deadline logic
- `CLAUDE.md` — Project context and conventions
- `docs/research.md` — PERM regulations and date logic
- `docs/security.md` — Security implementation details
- `.planning/codebase/` — 7 codebase mapping documents

## Constraints

- **Security first** — All tables use Row-Level Security (RLS), never bypass
- **PWA rules** — Never cache HTML/JS in service worker (only static assets)
- **Testing** — Run regression tests between major changes, maintain 80%+ coverage
- **Date validation** — Must follow DOL regulations exactly (20 CFR § 656.40)
- **Incremental changes** — Atomic, verifiable changes; don't break everything at once

## Open Questions

Things to figure out in future milestones:

- [ ] Conflict resolution strategy for Google Calendar two-way sync
- [ ] Mobile app or keep as PWA only?
- [ ] Multi-attorney / law firm support (shared cases)?
- [ ] Billing/subscription model if commercializing?

---

## Current State (Updated: 2025-12-20)

**Current Milestone:** v2.0 Complete Migration (in progress)
**Previous:** v1.0 Codebase Cleanup (shipped 2025-12-20)
**Branch:** `test` worktree
**Codebase:** ~43K lines (33.5K Python, 9.5K JavaScript)

### v2.0 Migration Goal

Complete platform rebuild to Next.js + Convex + React:
- Preserve all 229 features
- Deadlines & Validations as the CORE
- Real-time updates everywhere
- Production-grade AI chatbot

**Phases:** 11-32 (22 phases across 7 stages)
**Context:** See `.planning/V2_MIGRATION_BRIEF.md`

### What Shipped in v1.0

- XSS security remediation with DOMPurify, Sanitizer utility, CSP headers
- Modular chatbot architecture (8 modules from 2,772-line monolith)
- Comprehensive logging (0 print/console statements)
- Type safety improvements (TypedDicts for tool infrastructure)
- Test coverage expansion (377 tests, from 23)
- Sentry error tracking integration

## Next Steps

1. **Plan Phase 11** — `/gsd:plan-phase 11`
2. **Execute prep phases** — Phases 11-14
3. **Research foundation** — Research phases 15, 16, 18 before planning

---

<details>
<summary>v1.0 Codebase Cleanup Goals (Archived)</summary>

## Original Vision

A comprehensive cleanup and refactoring of the PERM Tracker codebase. The application had grown organically and accumulated technical debt across 18 documented concerns ranging from critical security issues to code quality problems. This project aimed to transform the codebase from its current state into something clean, organized, and maintainable — not just at the directory level, but down to every single line of code.

The goal was elimination: no unused code, no dead code, no duplicate code, no monkey patches, no shortcuts. Everything done properly.

## Problem Addressed

The codebase had accumulated significant technical debt:

- **Security vulnerabilities**: Hardcoded production secrets in repository, 103 unsafe DOM assignments creating XSS risk
- **Code bloat**: chatbot-v2.js (2,772 lines) with 3 supporting modules, 555 debug statements across frontend and backend
- **Type safety gaps**: 16 `Any` type usages bypassing type checking
- **Dead code**: 9 deprecated tool exports still present, unused functionality scattered throughout
- **Incomplete features**: Google Calendar integration at 95%, missing deadline reminders
- **Poor maintainability**: Large monolithic files, inconsistent patterns, no error tracking

## Success Criteria

- [x] All 18 issues from COMPREHENSIVE_CONCERNS_SPEC.md resolved (16 complete, 2 deferred)
- [x] 0 console.log/console.warn/console.error statements in frontend
- [x] 0 print() statements in backend
- [x] 0 `Any` type usages in backend (16 documented exceptions for external APIs)
- [x] 0 unsafe DOM assignments without sanitization
- [x] 0 deprecated tool exports
- [ ] All production secrets rotated and removed from repository (skipped - test worktree)
- [x] chatbot-v2.js modularized into 8+ focused files
- [x] Test coverage maintained or improved (377 tests, from 23)
- [x] Codebase feels navigable and maintainable

## Scope

### Built

- **Security fixes**: XSS sanitization, LLM provider validation
- **Debug cleanup**: Removed all console.* and print() statements, implemented proper logging
- **Type safety**: Replaced all Any types with specific types
- **Code splitting**: Broke chatbot-v2.js into 8 modular components
- **Dead code removal**: Deleted deprecated exports, unused functions, orphaned files
- **Configuration centralization**: Removed direct os.getenv() calls, use Settings class
- **Error tracking**: Added Sentry integration
- **Test coverage**: Expanded from 23 to 377 tests

### Not Built

- New automated tooling (linting, pre-commit hooks, etc.)
- Formal code structure rules/conventions document
- New features beyond completing existing incomplete ones
- Major architectural changes beyond what's needed for cleanup

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | All 18 issues | Comprehensive cleanup, no half measures |
| Approach | Clean only | Focus on fixing existing mess, not creating new rules/tooling |
| chatbot-v2.js | Modular refactor | 2,772 lines with supporting modules needs further decomposition |
| Secrets (C1) | Include in scope | Security issues can't be deferred |
| Testing | Regression + expand | Catch breakage early, improve coverage alongside |
| Boundaries | Nothing off-limits | Full freedom to refactor schema, API contracts, anything |

---
*Initialized: 2025-12-18*
*Completed: 2025-12-20*

</details>
