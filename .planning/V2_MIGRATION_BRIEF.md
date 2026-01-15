# v2.0 Complete Migration - Brief

> **Purpose:** Master context document for the v2.0 migration milestone
> **Created:** 2025-12-20
> **Last Updated:** 2025-12-22
> **Branch:** test (worktree)
>
> **Reference:** See `V2_ORIGINAL_VISION.md` for complete user requirements

---

## Executive Summary

**Goal:** Complete platform rebuild from FastAPI + Supabase + Alpine.js to Next.js + Convex + React.

**Approach:** Fresh rebuild using current codebase (~43K lines, 200+ features) as source of truth. Not a refactor - a rewrite with preserved business logic and design.

**Central Theme:** Deadlines and Validations are the CORE. Everything builds on a central, extensible validation system.

**Key Drivers:**
- Real-time updates everywhere (Convex subscriptions)
- Production-grade AI chatbot (can do everything a user can do)
- Better DX and maintainability
- Type safety end-to-end

---

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend framework | Next.js 16+ App Router | Industry standard, SSR, Vercel integration |
| Backend/Database | Convex | Real-time subscriptions, serverless, TypeScript |
| Auth | Convex Auth (Clerk-ready) | Start simple, architecture allows swap |
| AI/LLM | Vercel AI SDK + CopilotKit | Copilot UI components, multi-provider |
| Styling | Tailwind CSS v4 + selective shadcn/ui | Preserve current design |
| Design approach | Same visual design | Users shouldn't notice change |
| Central validation | TypeScript module | Extensible, testable, used everywhere |
| Calendar sync | Two-way included | Part of v2.0, not deferred |
| Testing | TDD + E2E + MCPs | Vitest, Playwright, Claude Chrome |
| Credentials | Never in git | .env.local, secure storage pattern |
| Status system | Two-tier (5+6) | Case Status + Progress Status (simpler UX) |
| RFI due date | Strict 30 days | NOT editable (regulatory) |
| Complete vs Closed | Separate tiles | Complete = I-140 approved, Closed = terminal |

---

## Tech Stack Migration

| Layer | Current (v1) | Target (v2) |
|-------|---------|--------|
| Frontend | HTML + Alpine.js + Tailwind | Next.js 16+ + React + Tailwind v4 |
| Backend | FastAPI (Python) | Convex functions (TypeScript) |
| Database | PostgreSQL (Supabase) | Convex (document DB) |
| Auth | Supabase Auth | Convex Auth (Clerk-ready) |
| Real-time | None | Convex subscriptions |
| AI | Custom multi-provider | Vercel AI SDK + CopilotKit |
| Hosting | Vercel + Render | Vercel only |

---

## Milestone Structure: v2.0 Complete Migration

**22 phases** (11-32) across **7 stages**:

### Stage 1: PREP (Phases 11-14)
- **11:** Cleanup + Git Hygiene
- **12:** Feature Inventory + Archive
- **13:** Core Logic Extraction (BUSINESS_RULES.md, DEADLINE_FLOWS.md, VALIDATION_RULES.md)
- **14:** Schema + Design Extraction

### Stage 2: FOUNDATION (Phases 15-19)
- **15:** Scaffold + Testing Infrastructure
- **16:** Deadline & Validation Core (**Central module**)
- **17:** Design System
- **18:** Auth (Clerk-Ready)
- **19:** Schema + Security

### Stage 3: REAL-TIME CORE (Phases 20-24)
- **20:** Dashboard + Deadline Hub
- **21:** Case List + Actions
- **22:** Case Forms (live cross-validation)
- **23:** Case Detail + Timeline
- **24:** Notifications + Email

### Stage 4: SETTINGS (Phase 25)
- **25:** Settings + Preferences

### Stage 5: AI CHATBOT (Phases 26-29)
- **26:** Chat Foundation
- **27:** Knowledge Layer
- **28:** Action Layer
- **29:** Advanced Automation

### Stage 6: CALENDAR (Phase 30)
- **30:** Calendar + Two-Way Sync

### Stage 7: PRODUCTION (Phases 31-32)
- **31:** PWA + Performance + SEO
- **32:** Data Migration + Go-Live

---

## Research Phases

These phases need `/gsd:research-phase` BEFORE planning:

| Phase | Topic |
|-------|-------|
| 13 | Verify PERM regulation edge cases |
| 15 | Latest Next.js + Convex patterns |
| 16 | Deadline validation edge cases |
| 18 | Convex Auth patterns |
| 26 | Vercel AI SDK patterns |
| 30 | Calendar webhook patterns |

---

## Human Checkpoints

UI review gates on these phases:
- **17:** Design System
- **20:** Dashboard
- **23:** Case Detail + Timeline
- **26:** Chat Foundation
- **29:** Advanced Automation

**Always use frontend-design skill (its a plug-in) for all UI work.**

---

## Cross-Cutting Requirements

| Requirement | Application |
|-------------|-------------|
| TDD | Tests BEFORE code, especially validation |
| E2E Testing | Playwright + MCPs every feature |
| Real-time | Convex subscriptions on all changeable data |
| Validation | Central module, live feedback everywhere |
| SEO | Throughout, finalized Phase 31 |
| No Feature Loss | Verify against 200+ feature checklist |
| Secure Credentials | Never in git |
| Extensible | Central modules allow add/remove |

---

## Critical References

### For Deadline/Validation Logic
- `backend/app/utils/date_validation.py` - All PERM rules
- `backend/app/utils/deadline_relevance.py` - Supersession logic
- `backend/app/services/case_service.py` - Auto-calculations
- `frontend/src/js/utils/form/dateValidation.js` - Client mirror
- `docs/research.md` - Regulation references

### For Design
- `docs/design-system.md` - Soft Neobrutalism spec
- `frontend/tailwind.config.js` - Current tokens
- `frontend/src/css/main.css` - CSS variables

### For Features
- `.planning/V2_FEATURE_INVENTORY.md` - Complete 200+ feature list
- `.planning/V2_DEADLINE_SYSTEM.md` - Deadline ecosystem details

### For Context
- `.planning/V2_MILESTONE_CONTEXT.md` - Full phase details and decisions

---

## Companion Documents

| Document | Purpose |
|----------|---------|
| `V2_MILESTONE_CONTEXT.md` | Full phase details, decisions, requirements |
| `V2_FEATURE_INVENTORY.md` | Complete 200+ feature checklist |
| `V2_DEADLINE_SYSTEM.md` | Deadline ecosystem documentation |

---

## Success Criteria

### Phase Gates
- **Phase 14:** All migration docs created, cleanup complete
- **Phase 19:** App shell works, auth works, validation passing
- **Phase 24:** Can create, view, edit cases with full validation
- **Phase 29:** Chatbot can do anything a user can do
- **Phase 32:** All 200+ features verified, production live

### Quality Gates
- [ ] TypeScript strict mode, no `any` types
- [ ] 377 test behaviors replicated
- [ ] No console.log (structured logging only)
- [ ] XSS prevention maintained
- [ ] UI matches current design
- [ ] Real-time updates working
- [ ] PWA rules maintained (never cache HTML/JS)
- [ ] All 200+ features present

---

## Session Handoff Protocol

Each session should:
1. Read `.planning/V2_MIGRATION_BRIEF.md` (this file)
2. Check `.planning/STATE.md` for current phase
3. Read phase-specific context in `.planning/V2_MILESTONE_CONTEXT.md`
4. Read phase PLAN.md if exists
5. Update STATE.md with progress on exit

---

## Commands

```bash
# Check current state
/gsd:progress

# Research before planning
/gsd:research-phase [N]

# Plan a phase
/gsd:plan-phase [N]

# Execute a plan
/gsd:execute-plan

# Pause work
/gsd:pause-work
```

---

*Last updated: 2025-12-20*
