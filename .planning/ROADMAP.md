# Roadmap: PERM Tracker

## Milestones

- ✅ [v1.0 Codebase Cleanup](milestones/v1.0-ROADMAP.md) (Phases 1-10 + 6.1) - SHIPPED 2025-12-20
- 🚧 **v2.0 Complete Migration** - Phases 11-32 (in progress)

---

## 🚧 v2.0 Complete Migration (In Progress)

**Milestone Goal:** Complete platform rebuild from FastAPI + Supabase + Alpine.js to Next.js + Convex + React.

**Central Theme:** Deadlines and Validations as the CORE. Real-time everywhere. Production-grade AI chatbot.

**Context Documents:**
- `.planning/V2_MIGRATION_BRIEF.md` - Master context
- `.planning/V2_MILESTONE_CONTEXT.md` - Phase details
- `.planning/V2_FEATURE_INVENTORY.md` - 229 features checklist
- `.planning/V2_DEADLINE_SYSTEM.md` - Deadline ecosystem

---

### Stage 1: PREP (Phases 11-14)

#### Phase 11: Cleanup + Git Hygiene ✓
**Goal:** Clean slate for migration
**Depends on:** v1.0 complete
**Research:** No
**Plans:** 1/1 complete
**Completed:** 2025-12-20

#### Phase 12: Feature Inventory Verification ✓
**Goal:** Verify 229-feature inventory against actual codebase
**Depends on:** Phase 11
**Research:** No
**Plans:** 1/1 complete
**Completed:** 2025-12-20

#### Phase 13: Core Logic Extraction ✓
**Goal:** Create BUSINESS_RULES.md, DEADLINE_FLOWS.md, VALIDATION_RULES.md
**Depends on:** Phase 12
**Research:** YES (verify PERM regulations) - COMPLETE
**Status:** Complete
**Plans:** 3/3 complete
**Completed:** 2025-12-20

#### Phase 14: Schema + Design Extraction ✓
**Goal:** Create CONVEX_SCHEMA.md, DESIGN_TOKENS.json, FIELD_MAPPINGS.md
**Depends on:** Phase 13
**Research:** No
**Status:** Complete
**Plans:** 2/2
**Completed:** 2025-12-20

---

### Stage 2: FOUNDATION (Phases 15-19)

#### Phase 15: Scaffold + Testing Infrastructure ✓
**Goal:** Next.js + Convex + Vitest + Playwright + MCPs
**Depends on:** Phase 14
**Research:** YES (latest patterns) - COMPLETE
**Status:** Complete
**Plans:** 2/2 complete
**Completed:** 2025-12-20

#### Phase 16: Deadline & Validation Core ✓
**Goal:** Central TypeScript validation module (377 test behaviors)
**Depends on:** Phase 15
**Research:** YES (edge cases) - COMPLETE
**Status:** Complete
**Plans:** 4/4 complete
**Completed:** 2025-12-22

#### Phase 17: Design System ✓
**Goal:** Component library preserving current design
**Depends on:** Phase 16
**Research:** No
**Human Checkpoint:** YES (approved)
**Status:** Complete
**Plans:** 4/4 complete
**Completed:** 2025-12-22

> **⚠️ CRITICAL:** All agents working on Phase 17 MUST use the frontend-design skill (its a plug-in) - read `.planning/FRONTEND_DESIGN_SKILL.md` before any implementation work.

#### Phase 17.1: Improve Designs and Make it Match Design Examples (INSERTED) ✓
**Goal:** Refine design system components to match design references
**Depends on:** Phase 17
**Research:** No
**Human Checkpoint:** YES (approved)
**Status:** Complete
**Plans:** 2/2 complete
**Completed:** 2025-12-22

> **⚠️ CRITICAL:** All agents working on Phase 17.1 MUST use the frontend-design skill (its a plug-in) - read `.planning/FRONTEND_DESIGN_SKILL.md` before any implementation work.

#### Phase 18: Auth (Clerk-Ready) ✓
**Goal:** Convex Auth + Google OAuth, architecture flexible for Clerk
**Depends on:** Phase 17.1
**Research:** YES (Convex Auth patterns) - COMPLETE
**Status:** Complete
**Plans:** 3/3 complete
**Completed:** 2025-12-23

#### Phase 18.1: Auth UI Polish (INSERTED) ✓
**Goal:** Match auth pages to v1 design (header, footer, brutalist styling)
**Depends on:** Phase 18
**Research:** No
**Human Checkpoint:** YES (approved)
**Status:** Complete
**Plans:** 2/2 complete
**Completed:** 2025-12-23

> **⚠️ CRITICAL:** All agents working on Phase 18.1 MUST use the frontend-design skill (its a plug-in) - read `.planning/FRONTEND_DESIGN_SKILL.md` before any implementation work.

#### Phase 19: Schema + Security ✓
**Goal:** Convex schema (all tables), security rules
**Depends on:** Phase 18.1
**Research:** No
**Status:** Complete
**Plans:** 4/4 complete
**Completed:** 2025-12-23

---

### Stage 3: REAL-TIME CORE (Phases 20-24)

#### Phase 20: Dashboard + Deadline Hub ✓
**Goal:** Real-time dashboard with deadline widget
**Depends on:** Phase 19
**Research:** No
**Human Checkpoint:** YES
**Status:** Complete
**Plans:** 4/4 complete
**Completed:** 2025-12-24

> **⚠️ CRITICAL:** All agents working on Phase 20 MUST use the frontend-design skill (its a plug-in) - read `.planning/FRONTEND_DESIGN_SKILL.md` before any implementation work.

**Plan breakdown:**
- 20-01: Dashboard Data Layer & Deadline Queries ✓
- 20-02: Dashboard Layout, Header & Summary Tiles ✓
- 20-03: Deadline Hero Widget ✓
- 20-04: Recent Activity, Upcoming Deadlines & Add Case Button ✓

#### Phase 21: Case List + Actions ✓
**Goal:** Case list with consistent action patterns everywhere
**Depends on:** Phase 20
**Research:** No
**Status:** Complete
**Plans:** 4/4 complete

**Plan breakdown:**
- 21-01: Data Layer & Case Queries ✓
- 21-02: CaseCard Component ✓
- 21-03: Case List Page & Filters ✓
- 21-04: Selection Mode + Export/Import ✓

#### Phase 22: Case Forms ✓
**Goal:** Add/Edit with live cross-validation, auto-fill, cascade
**Depends on:** Phase 21
**Research:** No
**Status:** Complete
**Plans:** 5/5 complete
**Completed:** 2025-12-26

**Plan breakdown:**
- 22-01: Form Infrastructure (Zod schemas, FormField components, useFormCalculations hook) ✓
- 22-02: Form Sections Part 1 (BasicInfo, PWD, Recruitment sections) ✓
- 22-03: Form Sections Part 2 (ETA 9089, I-140, RFI/RFE dynamic entries) ✓
- 22-04: Add/Edit Pages (/cases/new, /cases/:id/edit, duplicate detection) ✓
- 22-05: Polish + Cleanup (Professional occupation, mock data removal, empty states) ✓

#### Phase 23: Case Detail + Timeline ✓
**Goal:** Case detail with improved timeline visualization
**Depends on:** Phase 22
**Research:** No
**Human Checkpoint:** YES
**Status:** Complete
**Plans:** 5/5 complete
**Completed:** 2025-12-28

**Plan breakdown:**
- 23-01: Timeline Data Layer (timelinePreferences table, Convex functions, milestone utilities) ✓
- 23-02: Case Detail Page (6 sections, inline timeline, quick actions, 80 tests) ✓
- 23-03: Timeline Page Core (grid, milestones, range bars, controls, legend, 113 tests) ✓
- 23-04: Case Selection Modal (search/filter/sort, bulk actions, Convex persistence, 94 tests) ✓
- 23-05: Polish + Animations (Framer Motion, privacy mode, responsive, dark mode, V1 parity) ✓

> **⚠️ CRITICAL:** All agents working on Phase 23 MUST use the frontend-design skill (its a plug-in) - read `.planning/FRONTEND_DESIGN_SKILL.md` before any implementation work.

#### Phase 23.1: Calendar View Page (INSERTED) ✓
**Goal:** In-app calendar view page showing all case deadlines
**Depends on:** Phase 23
**Research:** No
**Human Checkpoint:** YES (approved)
**Status:** Complete
**Plans:** 3/3 complete
**Completed:** 2025-12-31

**Deliverables:**
- Calendar view page with month/week/day views
- Case deadlines displayed with status colors
- Hover shows full case details
- Consistent case status + progress status display
- Filter by case status, deadline type

> **⚠️ CRITICAL:** All agents working on Phase 23.1 MUST use the frontend-design skill (its a plug-in) - read `.planning/FRONTEND_DESIGN_SKILL.md` before any implementation work.

> **Note:** This is separate from Phase 30 (Google Calendar two-way sync). This phase builds the in-app calendar UI; Phase 30 handles external Google Calendar integration.

#### Phase 24: Notifications + Email ✓
**Goal:** In-app + email notifications with cleanup on case changes
**Depends on:** Phase 23.1
**Research:** No
**Status:** Complete
**Plans:** 5/5 complete
**Completed:** 2025-12-31

**Plan breakdown:**
- 24-01: Data Layer & Core Functions ✓
- 24-02: NotificationBell + Dropdown UI ✓
- 24-03: Full Notifications Page ✓
- 24-04: Email Integration (React Email templates, Resend actions) ✓
- 24-05: Scheduled Functions + Push (crons, web-push, service worker) ✓

#### Phase 24.1: API Documentation (INSERTED) ✓
**Goal:** v2/CLAUDE.md, Convex API docs, v2 README updates
**Depends on:** Phase 24
**Research:** No
**Status:** Complete
**Plans:** 2/2 complete
**Completed:** 2025-12-31

**Deliverables:**
- `v2/CLAUDE.md` - Dev workflow, commands, v2-specific patterns
- `v2/docs/API.md` - Convex mutations/queries reference
- `v2/README.md` - Updated with complete project docs

**Process:**
1. Use **Explore agents** to analyze codebase structure, Convex functions, patterns
2. Use **documenter agent** to generate and write documentation
3. Establish documentation maintenance pattern for subsequent phases

> **⚠️ POST-PHASE DOCUMENTATION RULE (Phases 25+):**
> After completing each phase, check if documenter agent should run to update:
> - `v2/CLAUDE.md` (new commands, patterns, decisions)
> - `v2/docs/API.md` (new/changed Convex functions)
> - `v2/README.md` (feature updates)
>
> Run documenter if: new APIs added, patterns changed, or commands added.

---

### Stage 4: SETTINGS (Phase 25)

#### Phase 25: Settings + Preferences ✓
**Goal:** Profile, notification preferences, calendar sync, data export/import
**Depends on:** Phase 24.1
**Research:** No
**Status:** Complete
**Plans:** 4/4 complete
**Completed:** 2026-01-01

**Plan breakdown:**
- 25-01: Settings Infrastructure (layout, tabs, ProfileSection, Motion) ✓
- 25-02: Notification Preferences (email toggles, push subscription, reminder days, urgent threshold) ✓
- 25-03: Quiet Hours + Calendar Sync + Auto-Close (time pickers, 7 deadline toggles, integration) ✓
- 25-04: Account Management + Support (privacy toggle, export, soft-delete, support links, 76 tests) ✓

#### Phase 25.1: Calendar + Two-Way Sync (INSERTED) ✓
**Goal:** Full Google Calendar integration with webhooks for two-way sync
**Depends on:** Phase 25
**Research:** YES (webhook patterns, Convex HTTP actions) - COMPLETE
**Status:** Complete
**Plans:** 5/5 complete
**Completed:** 2026-01-01

**Deliverables:**
- Google OAuth flow for Next.js
- Event CRUD (create/update/delete calendar events)
- Two-way sync via webhooks (Google → App)
- Sync preferences (7 deadline types)
- Conflict resolution
- Sync status display

**Note:** Moved from Phase 30. Webhooks require production HTTPS.

#### Phase 25.2: Home & Demo Page Polish (INSERTED) ✓
**Goal:** Production-quality home page and demo page with creative aesthetic, responsive animations, v1 feature parity + v2 polish
**Depends on:** Phase 25.1
**Research:** No
**Human Checkpoint:** YES (approved)
**Status:** Complete
**Plans:** 6/6 complete
**Completed:** 2026-01-02

**Plan breakdown:**
- 25.2-01: Infrastructure & Hero (ScrollReveal, animations lib, (public) route group, HeroSection) ✓
- 25.2-02: Home Page Sections (FeaturesGrid, HowItWorks, FeatureShowcase) ✓
- 25.2-03: Home Page Completion (FAQ accordion, Contact form, Extended footer, Decorative elements) ✓
- 25.2-04: Demo Page Core (localStorage utilities, stats grid, mini calendar, mini timeline) ✓
- 25.2-05: Demo Page CRUD (DemoCaseCard, DemoCasesGrid, DemoCaseModal, DeleteConfirmDialog, DemoCTA) ✓
- 25.2-06: Polish & Performance (animation timing, motion reduction, mobile optimization, storyboard docs) ✓

**Deliverables:**
- Home page with v1 features + v2 polish
- Demo page fully functional and polished
- Creative themed aesthetic matching design system
- Responsive animations (Motion, GSAP, Lottie)
- Clean, minimal, DRY implementation

> **⚠️ CRITICAL:** All agents working on Phase 25.2 MUST use the frontend-design skill (its a plug-in) - read `.planning/FRONTEND_DESIGN_SKILL.md` and design docs (`phases/17-design-system/design*`) before any implementation work.

---

### Stage 5: AI CHATBOT (Phases 26-29)

#### Phase 26: Chat Foundation ✓
**Goal:** Vercel AI SDK, streaming, history, UI
**Depends on:** Phase 25.2
**Research:** YES (AI SDK patterns) - COMPLETE
**Human Checkpoint:** YES (approved)
**Status:** Complete
**Plans:** 4/4 complete
**Completed:** 2026-01-04

**Plan breakdown:**
- 26-01: AI Infrastructure (providers, fallback, API route) ✓
- 26-02: Convex Layer (conversations, messages CRUD, 49 tests) ✓
- 26-03: Chat UI Core (widget, panel, input, messages) ✓
- 26-04: Integration & Polish (history, persistence hook, mobile) ✓

> **⚠️ CRITICAL:** All agents working on Phase 26 MUST use the frontend-design skill (its a plug-in) - read `.planning/FRONTEND_DESIGN_SKILL.md` before any implementation work.

#### Phase 27: Knowledge Layer ✓
**Goal:** PERM knowledge, website how-tos, full case data access, web search
**Depends on:** Phase 26
**Research:** No
**Status:** COMPLETE
**Plans:** 5/5 complete
**Completed:** 2026-01-09

**Plan breakdown:**
- 27-01: RAG Infrastructure (Convex RAG, Gemini embeddings, 18 PERM sections, semantic search) ✓
- 27-02: Web Search (Tavily→Brave fallback, rate limit tracking, graceful degradation, 33 tests) ✓
- 27-03: Tool Definitions (Flexible queryCases, AI SDK tools with Zod schemas, 104 tests) ✓
- 27-04: Chat API Integration (Enhanced system prompt, native tool calling, persistence, multi-step) ✓
- 27-05: Context Management (Rolling summarization, TTL-based tool caching, token optimization) ✓

#### Phase 28: Action Layer ✓
**Goal:** Tool infrastructure, permissions, all user actions as tools
**Depends on:** Phase 27
**Research:** No
**Status:** Complete
**Plans:** 5/5 complete
**Completed:** 2026-01-11

**Plan breakdown:**
- 28-01: Permission Infrastructure (actionMode field, ActionModeToggle, InChatConfirmationCard) ✓
- 28-02: Navigation Tools (navigate, viewCase, scrollTo, refreshPage, client action executor) ✓
- 28-03: Case CRUD Tools (create, update, archive, reopen, delete, 3-tier permissions) ✓
- 28-04: Calendar/Notifications/Settings Tools (8 tools, Convex integration) ✓
- 28-05: Bulk Operations & Polish (4 bulk tools, ActionChainProgress, human verification) ✓

#### ~~Phase 29: Advanced Automation~~ → DEFERRED
**Goal:** Multi-step workflows, action chaining, bulk operations
**Status:** DEFERRED to post-MVP
**Reason:** Phase 28 delivered comprehensive action layer with 32 tools, bulk operations, and natural tool chaining. Remaining gaps (generic bulk field update, case duplication, audit history viewer) are convenience features, not blockers.

**Deferred items for post-MVP:**
- `bulkUpdateField` tool (update any field across multiple cases)
- `duplicateCase` tool (clone case for similar positions)
- `getAuditHistory` chatbot tool (audit logs exist, need AI wrapper)
- Workflow templates (save common action sequences)

---

### ~~Stage 6: CALENDAR (Phase 30)~~ — MOVED

#### ~~Phase 30: Calendar + Two-Way Sync~~ → **Phase 25.1**
**Status:** MOVED to Phase 25.1 (inserted after Phase 25)
**Reason:** No dependency on AI Chatbot phases, infrastructure ready

See: `.planning/phases/25.1-calendar-two-way-sync/25.1-CONTEXT.md`

---

### Stage 6: PRODUCTION (Phases 31-32)

#### Phase 31: PWA + Performance + SEO ✓
**Goal:** Service worker (never cache HTML/JS), SEO, optimization
**Depends on:** Phase 28
**Research:** No
**Status:** Complete
**Plans:** 3/3 complete
**Completed:** 2026-01-11

**Plan breakdown:**
- 31-01: PWA Infrastructure (Serwist, manifest, icons, SW registration, offline page) ✓
- 31-02: SEO Infrastructure (robots.ts, sitemap.ts, OpenGraph image, page-level metadata) ✓
- 31-03: Performance & Polish (Bundle analyzer, image optimization, Speed Insights, Lighthouse 90+) ✓

#### Phase 32: Data Migration + Go-Live
**Goal:** Supabase → Convex migration, 229 features verified, ship it
**Depends on:** Phase 31
**Research:** YES - COMPLETE (2026-01-12)
**Status:** In progress
**Plans:** 3/4 complete

**Plan breakdown:**
- 32-01: Migration Scripts & Infrastructure (export, transform, import tools) ✓
- 32-02: v2 Calendar Sync Fixes (auto-cleanup on toggle, "Clear All" button) ✓
- 32-03: Data Migration Execution & Verification (infrastructure verified) ✓
- 32-04: Go-Live & Decommission (DNS cutover, v1 cleanup)

---

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-10 | v1.0 | 21/21 | Complete | 2025-12-20 |
| 11. Cleanup + Git Hygiene | v2.0 | 1/1 | Complete | 2025-12-20 |
| 12. Feature Inventory | v2.0 | 1/1 | Complete | 2025-12-20 |
| 13. Core Logic Extraction | v2.0 | 3/3 | Complete | 2025-12-20 |
| 14. Schema + Design Extraction | v2.0 | 2/2 | Complete | 2025-12-20 |
| 15. Scaffold + Testing | v2.0 | 2/2 | Complete | 2025-12-20 |
| 16. Deadline & Validation Core | v2.0 | 4/4 | Complete | 2025-12-22 |
| 17. Design System | v2.0 | 4/4 | Complete | 2025-12-22 |
| 17.1. Improve Designs (INSERTED) | v2.0 | 2/2 | Complete | 2025-12-22 |
| 18. Auth | v2.0 | 3/3 | Complete | 2025-12-23 |
| 18.1. Auth UI Polish (INSERTED) | v2.0 | 2/2 | Complete | 2025-12-23 |
| 19. Schema + Security | v2.0 | 4/4 | Complete | 2025-12-23 |
| 20. Dashboard | v2.0 | 4/4 | Complete | 2025-12-24 |
| 21. Case List | v2.0 | 4/4 | Complete | 2025-12-25 |
| 22. Case Forms | v2.0 | 5/5 | Complete | 2025-12-26 |
| 23. Case Detail + Timeline | v2.0 | 5/5 | Complete | 2025-12-28 |
| 23.1. Calendar View Page (INSERTED) | v2.0 | 3/3 | Complete | 2025-12-31 |
| 24. Notifications | v2.0 | 5/5 | Complete | 2025-12-31 |
| 24.1. API Documentation (INSERTED) | v2.0 | 2/2 | Complete | 2025-12-31 |
| 25. Settings | v2.0 | 4/4 | Complete | 2026-01-01 |
| 25.1. Calendar + Two-Way Sync (INSERTED) | v2.0 | 5/5 | Complete | 2026-01-01 |
| 25.2. Home & Demo Page Polish (INSERTED) | v2.0 | 6/6 | Complete | 2026-01-02 |
| 26. Chat Foundation | v2.0 | 4/4 | Complete | 2026-01-04 |
| 27. Knowledge Layer | v2.0 | 5/5 | Complete | 2026-01-09 |
| 28. Action Layer | v2.0 | 5/5 | Complete | 2026-01-11 |
| ~~29. Advanced Automation~~ | v2.0 | - | DEFERRED | - |
| ~~30. Calendar~~ | v2.0 | - | MOVED → 25.1 | - |
| 31. PWA + SEO | v2.0 | 3/3 | Complete | 2026-01-11 |
| 32. Data Migration | v2.0 | 3/4 | In progress | - |

---

## Completed Milestones

<details>
<summary>v1.0 Codebase Cleanup (Phases 1-10 + 6.1) - SHIPPED 2025-12-20</summary>

### Overview

A comprehensive cleanup and refactoring of the PERM Tracker codebase, addressing 16 of 18 documented concerns while systematically cleaning every file. No unused code, no dead code, no duplicates.

### Phases

- [x] **Phase 1: Security Foundation** - LLM provider validation
- [x] **Phase 2: Logging Infrastructure** - Python logging + frontend logger
- [x] **Phase 3: Backend Core Cleanup** - main.py, dependencies.py polished
- [x] **Phase 4: Backend Services Cleanup** - All 16 services audited
- [x] **Phase 5: Backend Tools Cleanup** - TypedDicts, deprecated exports removed
- [x] **Phase 6: Frontend Monolith Decomposition** - 8-module chatbot architecture
- [x] **Phase 6.1: Fix Config Loading Bug** (INSERTED) - os.getenv → settings.*
- [x] **Phase 7: Frontend Security** - DOMPurify, Sanitizer, CSP headers
- [x] **Phase 8: Frontend Comprehensive Cleanup** - 0 console.* statements
- [ ] **Phase 9: Feature Completion** - DEFERRED (needs production HTTPS)
- [x] **Phase 10: Final Validation** - Sentry, 377 tests, ARIA labels

### Stats

- 21 plans completed, 3 deferred
- 136 files modified
- 377 tests (from 23)
- 2 days execution

See [full milestone archive](milestones/v1.0-ROADMAP.md) for details.

</details>

---

## Deferred Work

### Phase 9: Feature Completion (Deferred to Production)

**Goal:** Complete Google Calendar two-way sync
**Status:** Plans ready in `.planning/phases/09-feature-completion/`
**Blocker:** Requires production HTTPS endpoint + Google domain verification

**To execute:** Deploy to production, configure HTTPS, run plans sequentially.

**Note:** Two-way sync included in v2.0 Phase 30 for the new stack.
