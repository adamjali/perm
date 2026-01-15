# Project State

## Project Summary

**Building:** Complete platform migration from FastAPI + Supabase + Alpine.js to Next.js + Convex + React.

**Core requirements:**
- Preserve all 229 features (no feature loss)
- Deadlines & Validations as the CORE
- Real-time updates everywhere (Convex subscriptions)
- Production-grade AI chatbot (can do anything a user can do)
- Same visual design (users don't notice change)
- 377 test behaviors replicated
- TypeScript strict mode, no `any` types

**Constraints:**
- TDD throughout (tests before code)
- Human checkpoints for all UI work
- Research before planning on flagged phases
- Never lose a feature

**TEST WORKTREE CONTEXT (IMPORTANT):**
- This is `perm-tracker-test/` worktree on branch `test`
- Database: Isolated test Supabase (`lkbhdshknusfrvxgtahz`) - NOT production
- All development is LOCAL ONLY: `localhost:3000` + `localhost:8000`
- Do NOT reference production URLs in plans or verification steps

## Current Position

Phase: 32 of 32 (Data Migration + Go-Live)
Plan: 4 of 4 in current phase
Status: **COMPLETE - MILESTONE SHIPPED**
Last activity: 2026-01-15 - Completed 32-04-PLAN.md (Go-Live & Decommission)

Progress: ████████████████████████████████████████████████████████████████████ 100%

**v2 is now live at https://permtracker.app**

## Context Documents

| Document | Purpose |
|----------|---------|
| `v2/CLAUDE.md` | **DEVELOPER GUIDE** — Central PERM logic API, import patterns, anti-patterns |
| `perm_flow.md` | **SOURCE OF TRUTH** — Case statuses, progress statuses, stage transitions, deadline logic |
| `V2_ORIGINAL_VISION.md` | **User requirements (canonical source)** |
| `V2_MIGRATION_BRIEF.md` | Master context, decisions, overview |
| `V2_MILESTONE_CONTEXT.md` | Detailed phase requirements |
| `V2_FEATURE_INVENTORY.md` | 229+ features checklist |
| `V2_DEADLINE_SYSTEM.md` | Deadline ecosystem reference |
| `V2_BUSINESS_RULES.md` | PERM process, stage progression (5+6 status) |
| `V2_DEADLINE_FLOWS.md` | Deadline calculations, recruitment formulas |
| `V2_VALIDATION_RULES.md` | 44 validation rules, edge cases |
| `V2_CONVEX_SCHEMA.md` | Schema + Convex type mappings + security |
| `V2_DESIGN_TOKENS.json` | Design system tokens (status colors fixed) |
| `V2_FIELD_MAPPINGS.md` | v1 → v2 field mappings for Phase 32 |

## Accumulated Context

### Decisions Made

| Phase | Decision | Rationale |
|-------|----------|-----------|
| - | Next.js 16+ App Router | Industry standard, Vercel integration |
| - | Convex for backend/DB | Real-time subscriptions, TypeScript |
| - | Convex Auth (Clerk-ready) | Start simple, architecture allows swap |
| - | Vercel AI SDK + CopilotKit | Copilot UI components, multi-provider |
| - | Same visual design | Users shouldn't notice change |
| - | Central validation module | Extensible, testable, used everywhere |
| - | Calendar two-way sync in v2.0 | Part of Phase 25.1 (moved from Phase 30) |
| - | TDD throughout | Tests before code, especially validation |
| 15 | Next.js 16.1.0 (not 15) | create-next-app@latest installed newest stable |
| 15 | Tailwind CSS v4 | CSS-first config, no tailwind.config.ts |
| 15 | Convex cloud dev deployment | Convex is cloud-first, no local-only mode |
| 15 | Test utils in test-utils/ not convex/ | import.meta.glob is Vite-specific, Convex can't deploy it |
| 15 | @ts-expect-error for import.meta.glob | Surgical TS suppression, self-documenting |
| 16 | Math-based holiday detection | Custom per 5 U.S.C. 6103, zero external deps |
| 16 | ISO string date protocol | All dates as YYYY-MM-DD, parse only for math |
| 16 | Custom addDaysUTC helper | Avoids date-fns DST issues for UTC date math |
| 16 | UTC date formatting in cascade | Prevents EST timezone off-by-one errors |
| 17 | shadcn/ui New York style | Better suited to neobrutalist aesthetic |
| 17 | pnpm as package manager | Project already uses pnpm (lockfile exists) |
| - | **Two-tier status system (5+6)** | Case Status + Progress Status (simpler UX) |
| - | **RFI due date strict 30 days** | NOT editable (regulatory requirement) |
| - | **Complete vs Closed separate** | Complete = I-140 approved tile, Closed = terminal status |
| - | **Status colors from v1** | PWD blue, Recruitment purple, ETA orange, I-140 green |
| - | **No attachments in v2.0** | Deferred (complex file storage) |
| - | **Recruitment deadline formulas** | 143/150/120/150 days (accounts for 30-day wait) |
| - | **Extend-only end dates** | Notice +10 biz days, Job order +30 days (can extend, not shorten) |
| 18 | Separate userProfiles from users | 1:1 table for app-specific data, survives Clerk migration |
| 18 | @oslojs/crypto + Web Crypto API | 8-digit secure OTP generation for email verification |
| 18.1 | Square spinner (not circular) | Matches neobrutalist aesthetic - no rounded corners |
| 21 | SelectionBar fixed at bottom (z-40) | Persistent visibility, common mobile pattern |
| 21 | CSV export uses RFC 4180 | Standard format compatible with Excel |
| 21 | Auto-detect legacy Firebase format | Seamless v1 migration without manual conversion |
| 23 | Default timeRange 12 months | Better timeline overview than 6 months |
| 23 | CSS-only timeline tooltips | group-hover pattern, no state needed |
| 23 | useDeferredValue for debounced search | React 18+ built-in, ~200ms natural debounce |
| 23 | Badge shows "All" when no selection | Clear UX: "3/5" = filtered, "All" = all active |
| 23.1 | Reuse extractMilestones for calendar | Event mapper delegates to timeline for consistency |
| 23.1 | Urgency: overdue/urgent/soon/normal | <0, 0-7, 8-30, 31+ days thresholds |
| 24 | getCurrentUserIdOrNull for queries | Graceful null handling on logout for UI queries |
| 24 | RFI/RFE minimum priority is "high" | Never "normal" or "low" for compliance items |
| 24 | Auto-closure always sends email | If master email switch enabled |
| 24 | Urgent bypasses quiet hours | Critical notifications break quiet hours |
| 24 | notifications@permtracker.app for emails | Separate from noreply@ for auth emails |
| 24 | Bulk email limit (first 10 cases) | Prevent overwhelming users in bulk operations |
| 25 | Custom button-based tabs for settings | Consistency with NotificationTabs pattern |
| 25 | motion/react import in client components | Works with Next.js App Router "use client" |
| 25 | Preserve CSS button animations | Did NOT add Motion whileTap to avoid conflicts |
| 25 | Browser timezone auto-detect | US timezones for PERM context, fallback to Eastern |
| 25.1 | Separate calendar OAuth credentials | GOOGLE_CALENDAR_* separate from AUTH_GOOGLE_* for different scopes |
| 25.1 | Token encryption with AES-256-GCM | OAuth tokens encrypted at rest in userProfiles |
| 25.1 | Internal queries for token access | Tokens never exposed to client - server-side actions only |
| 25.2 | STAGGER_DELAY = 0.1s standardized | Consistent cascade timing across all grid components |
| 25.2 | Mobile stagger = 0.05s | Half of desktop for snappier sequences on mobile |
| 25.2 | Animation storyboard documented | v2/docs/ANIMATION_STORYBOARD.md for future reference |
| 26 | Chatbot authenticated-only (differs from v1) | No public chatbot - widget in (authenticated) layout only |
| 26 | AI SDK 5.x (v2 providers) for streaming | Version compatibility with OpenRouter provider |
| 26 | Manual fallback helpers (not ai-fallback) | ai-fallback package has version incompatibility |
| 26 | Gemini 2.0 Flash primary model | Fastest, most capable free model |
| 26 | Next.js API routes for streaming (not Convex HTTP) | Convex HTTP actions don't fully support AI SDK streaming |
| 26 | Probe-before-stream fallback pattern | Detect quota/rate limits before committing to stream |
| 26 | Devstral 2 + DeepSeek V3.1 Nex fallbacks | Best free-tier models for tool calling (Jan 2025) |
| 27 | Rolling summary (not hierarchical) | Simpler, sufficient for v1 |
| 27 | 12 message threshold for summarization | Industry standard: 10-15 messages |
| 27 | Keep 6 recent messages raw | Preserves immediate conversation context |
| 27 | TTLs: 5m/15m/24h by tool type | Cases may change (5m), web fresh (15m), knowledge static (24h) |
| 27 | Cache keyed by query hash | Simpler, more predictable than semantic similarity |
| 28 | Default action mode: CONFIRM | Safest default, requires user approval before actions |
| 28 | archiveCase = close case (not delete) | Sets caseStatus: "closed", can be reopened |
| 28 | deleteCase = hard delete | Permanently removes case + all related data |
| 28 | No soft delete for cases | Hard delete with full cascade cleanup |
| 29 | Phase 29 DEFERRED to post-MVP | Phase 28 covered scope; remaining gaps are convenience features |
| 31 | Build uses --webpack flag | Serwist requires webpack (Turbopack not supported yet) |
| 31 | NetworkOnly for HTML/JS/CSS | Prevents stale deployment bugs (v1 Nov 2025 lesson) |
| 31 | Separate service workers | sw.js (caching) + sw-push.js (push) kept separate |
| 31 | HD hero image over compression | User quality preference; Next.js Image handles runtime optimization |

### Research Phases

These phases need `/gsd:research-phase` BEFORE planning:

| Phase | Topic | Status |
|-------|-------|--------|
| 13 | Verify PERM regulation edge cases | COMPLETE |
| 15 | Latest Next.js + Convex patterns | COMPLETE |
| 16 | Deadline validation edge cases | COMPLETE |
| 18 | Convex Auth patterns | COMPLETE |
| 25.1 | Calendar webhook patterns, Convex HTTP actions | COMPLETE |
| 26 | Vercel AI SDK patterns | COMPLETE (2026-01-03) |
| 32 | Data migration patterns (Supabase → Convex) | COMPLETE (2026-01-12) |

### Human Checkpoints

UI review gates:
- Phase 17: Design System
- Phase 20: Dashboard
- Phase 23: Case Detail + Timeline
- Phase 26: Chat Foundation
- ~~Phase 29: Advanced Automation~~ (DEFERRED)

**CRITICAL:** For all UI/frontend/visual work, any agents or subagents MUST use the frontend-design skill (its a plug-in) - read `.planning/FRONTEND_DESIGN_SKILL.md` before implementation.

### Documentation Maintenance (Phases 25+)

**After completing each phase**, check if documenter agent should run:

| Trigger | Update |
|---------|--------|
| New Convex functions added | `v2/docs/API.md` |
| New commands/patterns/decisions | `v2/CLAUDE.md` |
| Feature changes | `v2/README.md` |

**Process:**
1. Use **Explore agent** to analyze changes made in phase
2. Use **documenter agent** to update relevant docs

Skip if phase only modified internal implementation without API/pattern changes.

### Deferred Issues

| Item | From | Target Phase | Notes |
|------|------|--------------|-------|
| Corner label component | Phase 17.1 | Phase 20 | Numbered box in card corners |
| Knob/slider controls | Phase 17.1 | Phase 25 | Custom slider UI |
| Typing cursor animation | Phase 17.1 | Phase 26 | Blinking chatbot cursor |
| Bouncing elements | Phase 17.1 | Post-MVP | Marketing decorations |
| Clip-path shapes | Phase 17.1 | Post-MVP | Angled polygon cutoffs |

**Completed:** Glass panel (✅), Grain overlay (✅), Skeleton components (✅), Hazard stripes (✅ Phase 20-03)

### Blockers/Concerns Carried Forward

None - fresh milestone.

### Roadmap Evolution

- Phase 17.1 inserted after Phase 17: Improve Designs and Make it Match Design Examples (URGENT) - 2025-12-22
- Phase 18.1 inserted after Phase 18: Auth UI Polish (match v1 header/footer/brutalist styling) - 2025-12-23
- Phase 24.1 inserted after Phase 24: API Documentation (v2/CLAUDE.md, API docs, README) - 2025-12-23
- Phase 23.1 inserted after Phase 23: Calendar View Page (in-app calendar UI, separate from Phase 30 Google sync) - 2025-12-23
- Phase 25.1 inserted after Phase 25: Calendar + Two-Way Sync (MOVED from Phase 30, no AI dependency) - 2025-12-31
- Phase 25.2 inserted after Phase 25.1: Home & Demo Page Polish (URGENT - v1 parity + v2 polish, animations) - 2026-01-01

## Project Alignment

Last checked: 2025-12-20
Status: ✓ Aligned
Assessment: Milestone v2.0 created with comprehensive planning.
Drift notes: None

## Session Continuity

Last session: 2026-01-15
Stopped at: **MILESTONE COMPLETE** - v2 deployed to permtracker.app
Resume file: None
Next action: Post-go-live monitoring and decommission timeline

### Recent Additions (This Session)
- ✅ Phase 32-04: Go-Live & Decommission - v2 deployed to permtracker.app, decommission scripts ready
- ✅ Phase 32-03: Data Migration Execution & Verification - Verification scripts, master orchestration, rollback documentation
- ✅ Phase 32-02: v2 Calendar Sync Fixes - Auto-cleanup on toggle, "Clear All Events" button, progress bars, dark mode styling
- ✅ Phase 32-01: Migration Scripts & Infrastructure - Export, transform, import scripts + Convex ID resolution mutations
- ✅ Phase 31-03: Performance & Polish - Bundle analyzer, image optimization, Speed Insights, Lighthouse 90+ verified
- ✅ Phase 31-02: SEO Infrastructure - robots.ts, sitemap.ts, OpenGraph image, page-level metadata (14 routes)
- ✅ Phase 31-01: PWA Infrastructure - Serwist + manifest + icons + SW registration + offline page + push notification icon fixes
- ⏭️ Phase 29: DEFERRED to post-MVP - Phase 28 delivered comprehensive action layer; remaining gaps (bulkUpdateField, duplicateCase, getAuditHistory) are convenience features
- ✅ Phase 28-05: Bulk Operations & Polish - 4 bulk tools (destructive tier), ActionChainProgress component, human verification PASSED
- ✅ Phase 28-04: Calendar/Notifications/Settings Tools - 8 tools (2 calendar, 4 notification, 2 settings), integrated with existing Convex mutations
- ✅ Phase 28-03 FIX: archiveCase → closes case (caseStatus: "closed"), deleteCase → hard delete, removed restoreCase
- ✅ Phase 28-03: Case CRUD Tools - 5 tools (create, update, archive, reopen, delete), 3-tier permission system (autonomous/confirm/destructive)
- ✅ Phase 28-02: Navigation Tools - 4 tools (navigate, viewCase, scrollTo, refreshPage), client action executor, useClientActions hook
- ✅ Phase 28-01: Permission Infrastructure - actionMode field (OFF|CONFIRM|AUTO), ActionModeToggle, InChatConfirmationCard
- ✅ Phase 27-05: Context Management - Rolling summarization (12+ → 6 recent + summary), TTL-based tool caching (5m/15m/24h)
- ✅ Phase 27-04: Chat API Integration - Enhanced system prompt, native tool calling, message persistence for tool calls, multi-step support
- ✅ Phase 27-03: Tool Definitions - Flexible queryCases Convex function, AI SDK tool definitions (query_cases, search_knowledge, search_web), 104 tests
- ✅ Phase 27-02: Web Search - Multi-provider (Tavily→Brave), rate limit tracking, graceful fallback, 33 tests
- ✅ Phase 27-01: RAG Infrastructure - @convex-dev/rag with Gemini embeddings, 18 PERM knowledge sections, semantic search, 14 tests
- ✅ Phase 25.2-06: Polish & Performance - Animation timing constants, useReducedMotion/useIsMobile hooks, mobile variants, ANIMATION_STORYBOARD.md
- ✅ Phase 25.2-05: Demo Page CRUD - DemoCaseCard, DemoCasesGrid, DemoCaseModal, DeleteConfirmDialog, DemoCTA
- ✅ Phase 25.2-04: Demo Page Core - localStorage utilities, 5 default cases, stats grid, mini calendar, mini timeline
- ✅ Phase 25.2-03: Home Page Completion - FAQ accordion (6 items), Contact form + cards, Extended footer, Grain overlay, Parallax shapes
- ✅ Phase 25.2-02: Home Page Sections - FeaturesGrid (3 cards), HowItWorks (3 steps), FeatureShowcase (6 items)
- ✅ Phase 25.2-01: Infrastructure & Hero - ScrollReveal, animations lib, (public) route group, HeroSection
- ✅ Phase 24.1-01: Comprehensive Convex API reference (3,617 lines) - 67 functions across 13 modules
- ✅ Phase 24.1-02: Enhanced CLAUDE.md (+467 lines) and README.md (+71 lines) with complete documentation
- ✅ Phase 25-01: Settings Infrastructure - 7-tab navigation, ProfileSection, Motion animations
- ✅ Phase 25-02: Notification Preferences - Email toggles, push subscription, reminder days, urgent threshold
- ✅ Phase 25-03: Quiet Hours + Calendar Sync + Auto-Close - Time pickers, 7 deadline toggles, integration
- ✅ Phase 25-04: Account Management + Support - Privacy toggle, export, soft-delete account deletion, 76 tests
- ✅ Phase 25.1-01: OAuth Infrastructure - Next.js API routes, Convex token storage, auto-refresh
- ✅ Phase 25.1-02: Calendar Event CRUD - create/update/delete actions, bulk sync, preference filtering
- ✅ Phase 25.1-03: Case Mutation Hooks - scheduler.runAfter for sync, best-effort pattern, toggleCalendarSync
- ✅ Phase 25.1-04: Settings UI Update - OAuth Connect/Disconnect, Sync All button, bulk selection sync/unsync
- ✅ Phase 25.1-05: Edge Cases + Tests - "Not connected" handling, exponential backoff, 131 calendar sync tests

## Performance Metrics

**v1.0 Completed:**
- 21 plans, ~4 hours execution
- Average 12 min/plan

**v2.0 Projection:**
- 22 phases, ~3-5 plans each = 66-110 plans
- Estimated 110-160 hours total
- Quality over speed
