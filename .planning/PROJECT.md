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

### Current (v2.0 — Shipped 2026-01-15)
- **Frontend:** Next.js 16+ App Router + React + Tailwind v4 (Vercel)
- **Backend:** Convex serverless functions (TypeScript)
- **Database:** Convex (document DB with real-time subscriptions)
- **Auth:** Convex Auth + Google OAuth (Clerk-ready)
- **AI:** Vercel AI SDK + multi-provider (Gemini, Devstral, DeepSeek)
- **Email:** Resend
- **Hosting:** Vercel (frontend) + Convex Cloud (backend)
- **Status System:** Two-tier (5 Case Statuses + 6 Progress Statuses)

### Legacy (v1.0 — Archived)
- FastAPI + Python 3.11+ (Render)
- PostgreSQL with Row-Level Security (Supabase)
- HTML/CSS/JS + Tailwind CSS + Alpine.js (Vercel)

> **Reference:** See `V2_ORIGINAL_VISION.md` for complete user requirements

> **Note:** All frontend/UI work must use the frontend-design skill (its a plug-in) - reference `.planning/FRONTEND_DESIGN_SKILL.md` for design requirements.

## Context

**Production URL:** https://permtracker.app (PWA enabled)

**Key Documentation:**
- `v2/CLAUDE.md` — **DEVELOPER GUIDE** for v2 development
- `perm_flow.md` — **SOURCE OF TRUTH** for case statuses, progress statuses, stage transitions, deadline logic
- `.planning/codebase/` — 7 codebase mapping documents

## Constraints

- **Security first** — All operations require authentication, user data isolated
- **PWA rules** — Never cache HTML/JS in service worker (only static assets)
- **Testing** — TDD throughout, maintain 3,600+ tests
- **Date validation** — Must follow DOL regulations exactly (20 CFR § 656.40)
- **Incremental changes** — Atomic, verifiable changes

## Open Questions

Things to figure out in future milestones:

- [ ] Mobile app or keep as PWA only?
- [ ] Multi-attorney / law firm support (shared cases)?
- [ ] Billing/subscription model if commercializing?

---

## Current State (Updated: 2026-01-16)

**Current Milestone:** None (v2.0.0 shipped)
**Production:** v2.0.0 live at https://permtracker.app
**Codebase:** 178,198 lines TypeScript (v2/)

### What Shipped in v2.0.0

- Complete platform migration: Next.js 16 + Convex + React
- 229 features preserved with no feature loss
- Production-grade AI chatbot with 32 tools and 3-tier permission system
- Two-way Google Calendar sync with OAuth and event management
- Central validation module with 3,600+ tests
- Real-time updates everywhere via Convex subscriptions
- PWA with service worker, SEO, Lighthouse 90+ scores
- Neobrutalist design system with Motion animations

### Deferred Work (Post-MVP)

- `bulkUpdateField` tool (update any field across multiple cases)
- `duplicateCase` tool (clone case for similar positions)
- `getAuditHistory` chatbot tool
- Workflow templates (save common action sequences)

## Next Steps

1. **Monitor production** — Watch for issues post-launch
2. **Decommission v1** — Follow timeline in `v2/scripts/migration/decommission.md`
3. **Plan v2.1** — `/gsd:discuss-milestone`

---

<details>
<summary>v2.0 Migration Goals (Archived)</summary>

## Migration Goal

Complete platform rebuild to Next.js + Convex + React:
- Preserve all 229 features
- Deadlines & Validations as the CORE
- Real-time updates everywhere
- Production-grade AI chatbot

**Phases:** 11-32 (22 phases across 7 stages)
**Context:** See `.planning/V2_MIGRATION_BRIEF.md`

**Status:** ✅ SHIPPED 2026-01-15

</details>

<details>
<summary>v1.0 Codebase Cleanup Goals (Archived)</summary>

## Original Vision

A comprehensive cleanup and refactoring of the PERM Tracker codebase. The application had grown organically and accumulated technical debt across 18 documented concerns ranging from critical security issues to code quality problems.

## What Shipped

- XSS security remediation with DOMPurify, Sanitizer utility, CSP headers
- Modular chatbot architecture (8 modules from 2,772-line monolith)
- Comprehensive logging (0 console.* statements)
- Type safety improvements (TypedDicts for tool infrastructure)
- Test coverage expansion (377 tests, from 23)
- Sentry error tracking integration

**Status:** ✅ SHIPPED 2025-12-20

</details>

---

*Last updated: 2026-01-16 after v2.0.0 milestone*
