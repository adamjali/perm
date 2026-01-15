# v2.0 Milestone Context

> **Purpose:** Comprehensive phase details, requirements, and accumulated decisions
> **Created:** 2025-12-20
> **Companion to:** V2_MIGRATION_BRIEF.md

---

## Phase Details

### Stage 1: PREP (Phases 11-14)

#### Phase 11: Cleanup + Git Hygiene
**Goal:** Clean slate for migration

**Deliverables:**
- Delete stale files: `firebase-debug.log`, `perm-tracker-cases-2025-11-26.json`
- Delete obsolete configs: `render.yaml`, `fix-render-env-vars.sh`, `test_oauth_flow.sh`
- Move misplaced files: `logo-min.png` → `frontend/public/`, `FIX_REFRESH_TOKENS.sql` → `backend/database/adhoc-fixes/`
- Remove duplicate: root `vercel.json` (keep `frontend/vercel.json`)
- Investigate/delete orphaned dirs: `/ai/`, `/tests/` (root level)
- Update `.gitignore`: add `.next/`, `.convex/`, `frontend/dist/`
- Secure credential storage pattern documented
- Add `REFACTORING_AUDIT.md` to git

**Research:** No

---

#### Phase 12: Feature Inventory + Archive
**Goal:** Document everything, archive old docs

**Deliverables:**
- Create `V2_FEATURE_INVENTORY.md` - Complete 200+ feature checklist
- Archive to `.planning/archive/v1.0/`:
  - `docs/plan.md`, `docs/tracking.md`, `docs/VERCEL_SETUP.md`, `docs/MIGRATION_020_NOTES.md`
- Update `CLAUDE.md`: tech stack section for Next.js + Convex
- Verify feature inventory against actual codebase

**Research:** No

---

#### Phase 13: Core Logic Extraction
**Goal:** Create migration reference docs for business logic

**Deliverables:**
- `docs/migration/BUSINESS_RULES.md`:
  - PWD expiration calculation (Apr 2-Jun 30: +90 days, else Jun 30)
  - ETA 9089 filing window (30-180 days after recruitment)
  - I-140 deadline (180 days after certification)
  - Sunday ad validation rules
  - All regulation references (20 CFR § 656.40)
- `docs/migration/DEADLINE_FLOWS.md`:
  - Complete dependency graph (PWD → Recruitment → ETA 9089 → I-140)
  - Supersession rules (when deadlines become irrelevant)
  - Notification/calendar cleanup triggers
- `docs/migration/STAGE_TRANSITIONS.md`:
  - 11-stage progression
  - What triggers each transition
  - Status enum values
- `docs/migration/VALIDATION_RULES.md`:
  - All 15+ validation rules
  - Error vs warning categorization
  - Cross-validation dependencies

**Research:** YES - Verify PERM regulation edge cases

---

#### Phase 14: Schema + Design Extraction
**Goal:** Extract schema and design for TypeScript port

**Deliverables:**
- `docs/migration/CONVEX_SCHEMA.md`:
  - All 5 tables translated to Convex format
  - Field types and defaults
  - Relationships and indexes
- `docs/migration/DESIGN_TOKENS.json`:
  - Colors (Forest Green #228B22, not blue)
  - Typography (Space Grotesk headings, Inter body)
  - Spacing, shadows, border radius
- `docs/migration/FIELD_MAPPINGS.md`:
  - All 50+ case fields with types
  - Default values (critical: `is_professional_occupation: false`)
  - Field labels and help text
- `docs/migration/AUTH_FLOW.md`:
  - OAuth popup flow
  - FedCM fallback
  - Token refresh mechanism
- `docs/migration/CALENDAR_FLOW.md`:
  - Event creation triggers
  - Sync logic
  - Cleanup on deletion/archive

**Research:** No

---

### Stage 2: FOUNDATION (Phases 15-19)

#### Phase 15: Scaffold + Testing Infrastructure
**Goal:** Working app shell with testing from day 1

**Deliverables:**
- Next.js 14+ with App Router initialized
- Convex backend setup and connected
- TypeScript strict mode configured
- Project structure following conventions:
  ```
  src/
    app/           # Pages and routes
    components/    # Shared components
    lib/           # Utilities
    hooks/         # Custom hooks
  convex/          # Backend functions
  ```
- Vitest configured for unit tests
- Playwright configured for E2E
- MCP tools verified (Chrome DevTools, Playwright, Claude Chrome)
- Connection between Next.js and Convex verified

**Research:** YES - Latest Next.js + Convex patterns

---

#### Phase 16: Deadline & Validation Core
**Goal:** Central validation module that everything builds on

**Deliverables:**
- `lib/validation/` module:
  - `rules.ts` - All 15+ validation rules
  - `calculations.ts` - Auto-calculation functions
  - `relevance.ts` - Deadline supersession logic
  - `business-days.ts` - Federal holiday aware
  - `types.ts` - TypedDict equivalents
- All rules from Python ported to TypeScript
- Extensible architecture (easy to add/remove rules)
- Works with chatbot tool system
- 377 test behaviors replicated
- Zod schemas for validation

**Research:** YES - Verify deadline validation edge cases

**Critical Implementation Notes:**
- PWD expiration: Apr 2-Jun 30 = +90 days, else Jun 30 rule
- PWD/Recruitment interaction: If recruitment starts AFTER PWD, expiration doesn't limit filing
- Professional occupation: Only ONE of 3 additional steps can end within 30 days of filing
- Weekend/holiday extension for I-140 deadline

---

#### Phase 17: Design System
**Goal:** Component library preserving current design

> **⚠️ frontend-design skill (its a plug-in) REQUIREMENT**
>
> All agents working on this phase MUST read `.planning/FRONTEND_DESIGN_SKILL.md` (the frontend-design skill, its a plug-in) before any implementation work. This document contains critical design system requirements, component patterns, and visual design principles that must be followed.

**Deliverables:**
- `tailwind.config.ts` with design tokens:
  ```json
  {
    "colors": {
      "bgPrimary": "#FAFAFA",
      "accent": "#228B22",
      "accentHover": "#1B6B1B",
      "destructive": "#FF4747"
    },
    "shadows": {
      "hard": "4px 4px 0px #000"
    }
  }
  ```
- Component library:
  - Button (primary, secondary, destructive)
  - Card (neobrutalist hard shadow)
  - Input, Select, Checkbox
  - Modal, Toast
  - StatusBadge (case stages with colors)
- Dark mode with Tailwind
- Animations (loading spinners, scroll reveal)
- SEO meta components

**Research:** No
**Human Checkpoint:** YES - Visual review

---

#### Phase 18: Auth (Clerk-Ready)
**Goal:** Auth that works, architecture allows Clerk swap

**Deliverables:**
- Convex Auth configured
- Google OAuth flow working
- Login/register pages
- Session management
- Activity timeout logic
- Architecture documented for potential Clerk swap
- Protected routes working

**Research:** YES - Convex Auth patterns

---

#### Phase 19: Schema + Security
**Goal:** Database ready with security rules

**Deliverables:**
- Convex schema (`convex/schema.ts`):
  - `users` table
  - `cases` table (50+ fields)
  - `notifications` table
  - `conversations` table
  - `rfi_rfe` table
- Indexes for common queries
- Security rules (replaces RLS):
  - Users can only access own data
  - Auth checks in every query/mutation
- Relationships defined

**Research:** No

---

### Stage 3: REAL-TIME CORE (Phases 20-24)

#### Phase 20: Dashboard + Deadline Hub
**Goal:** Real-time dashboard with deadline visibility

**Deliverables:**
- Dashboard page with:
  - Deadline hero widget (overdue/urgent/upcoming)
  - Case statistics cards
  - Quick actions
  - Upcoming deadlines preview
- Real-time subscriptions (updates without refresh)
- Case categories (open, due soon, overdue, completed)
- Empty states
- Responsive design

**Research:** No
**Human Checkpoint:** YES - UX review

---

#### Phase 21: Case List + Actions
**Goal:** Case management with consistent action patterns

**Deliverables:**
- Cases list with:
  - Filters (status, stage, date ranges)
  - Search
  - Pagination (cursor-based for Convex)
  - Sorting
- **Consistent action patterns everywhere:**
  - Archive/Close - always available, same UI
  - Delete - confirmation, soft delete
  - Reopen - from detail or list, clear flow
  - Edit - inline or modal, consistent
- Bulk actions where appropriate
- Real-time updates

**Research:** No

---

#### Phase 22: Case Forms
**Goal:** Add/Edit with live cross-validation

**Deliverables:**
- Shared CaseForm component
- All 50+ fields organized by section:
  - Basic Info
  - PWD Phase
  - Recruitment Phase
  - ETA 9089 Phase
  - I-140 Phase
- **Live validation:**
  - No invalid dates possible
  - Sunday ads must be Sundays (instant feedback)
  - Dates that can't be before X are blocked
  - Cross-validation (changing one date validates related)
- Auto-fill/auto-calculation:
  - PWD expiration auto-calculated
  - ETA 9089 expiration auto-calculated
  - Recruitment end date auto-calculated
- **Cascade handling:**
  - If date changes, downstream recalculates
  - If recalculation makes later date invalid, show warning
- Field dependencies (recruitment method → show/hide fields)
- Unsaved changes warning
- Real-time (changes reflect immediately)

**Research:** No

---

#### Phase 23: Case Detail + Timeline
**Goal:** Case view with improved timeline

**Deliverables:**
- Case detail page with all fields
- **Improved timeline visualization:**
  - Clear stage progression
  - Visual indicator of current stage
  - Past stages marked complete
  - Future stages with expected dates
  - Deadlines shown inline
- RFI/RFE display with response tracking
- Deadline relevance display (hide irrelevant)
- Actions available (edit, delete, archive, reopen)
- Stage-specific information

**Research:** No
**Human Checkpoint:** YES - Timeline UX review

---

#### Phase 24: Notifications + Email
**Goal:** Complete notification system

**Deliverables:**
- In-app notification center:
  - List with filters
  - Mark read (individual/bulk)
  - Delete
  - Unread count badge
- Deadline reminders (scheduler equivalent)
- Email notifications via Resend:
  - Templates for each type
  - User preferences respected
- **Cleanup on case changes:**
  - Delete case → notifications deleted
  - Archive case → notifications cleaned
  - Stage progress → irrelevant notifications removed
- Real-time notification updates

**Research:** No

---

### Stage 4: SETTINGS (Phase 25)

#### Phase 25: Settings + Preferences
**Goal:** User settings and data management

**Deliverables:**
- Profile settings (name, email, phone)
- Notification preferences:
  - Email toggles per type
  - In-app toggles
- Calendar sync settings (per event type)
- Data export (CSV, JSON)
- Data import with validation
- Dark mode toggle
- Privacy mode toggle

**Research:** No

---

### Stage 5: AI CHATBOT (Phases 26-29)

#### Phase 26: Chat Foundation
**Goal:** Streaming chat with history

**Deliverables:**
- Vercel AI SDK integration
- Chat UI components:
  - Message list
  - Input area
  - Typing indicator
  - Error display
- Convex-based chat history
- Streaming responses
- Error handling with recovery
- Request ID tracking for debugging

**Research:** YES - Vercel AI SDK patterns
**Human Checkpoint:** YES - Chat UX review

---

#### Phase 27: Knowledge Layer
**Goal:** Chatbot that knows everything

**Deliverables:**
- **PERM regulation knowledge:**
  - Can answer any PERM question
  - Cites regulations
  - Explains deadlines
- **Website knowledge:**
  - Knows every page
  - Can explain how to do anything
  - Navigation suggestions
- **Case data access:**
  - Read any user's cases
  - Parse and reason about data
  - Answer questions about deadlines
  - Compare cases
  - Identify issues
- **Web search integration:**
  - Detect search intent
  - Search and synthesize
  - Provide sources
- Context management (conversation history)

**Research:** No

---

#### Phase 28: Action Layer
**Goal:** Chatbot can do anything user can do

**Deliverables:**
- Tool infrastructure for Vercel AI SDK
- **Permission system:**
  - Confirm destructive actions
  - Show what will change
  - Allow cancel
- **All user actions as tools:**
  - Create case
  - Update case
  - Delete case
  - Archive/reopen case
  - Manage notifications
  - Update settings
  - Calendar operations
- Form filling (populate fields from conversation)
- Navigation (take user to pages)

**Research:** No

---

#### Phase 29: Advanced Automation
**Goal:** Multi-step workflows and bulk operations

**Deliverables:**
- **Multi-step workflows:**
  - "Create a case and set up all dates"
  - "Mark all notifications as read and delete old ones"
- **Action chaining:**
  - One command triggers multiple actions
  - Proper sequencing
- **Bulk operations:**
  - "Archive all completed cases"
  - "Update all cases with employer X"
- **Complex queries:**
  - "Which cases have deadlines this month?"
  - "Show me all cases where PWD expires before recruitment ends"
- Edge case handling
- Consistent UI feedback for all actions

**Research:** No
**Human Checkpoint:** YES - Capability review

---

### Stage 6: CALENDAR (Phase 30)

#### Phase 30: Calendar + Two-Way Sync
**Goal:** Full Google Calendar integration

**Deliverables:**
- Google Calendar OAuth for Next.js
- Event CRUD:
  - Create on case creation
  - Update on case update
  - Delete on case delete/archive
- Sync preferences (per event type)
- **Two-way sync:**
  - Webhook infrastructure in Convex
  - Handle Google → App changes
  - Conflict resolution
- Deadline relevance cleanup (remove irrelevant events)
- Sync status display

**Research:** YES - Webhook patterns for Convex

---

### Stage 7: PRODUCTION (Phases 31-32)

#### Phase 31: PWA + Performance + SEO
**Goal:** Production-ready with all optimizations

**Deliverables:**
- Service worker:
  - Network-first for all requests
  - Cache static assets only
  - **NEVER cache HTML/JS**
  - Version-based cache busting
- Manifest configuration
- Offline handling (graceful degradation)
- Performance optimization:
  - Code splitting
  - Image optimization
  - Bundle analysis
- **Full SEO:**
  - Meta tags
  - Sitemap
  - Structured data
  - OG images
- Final E2E testing

**Research:** No

---

#### Phase 32: Data Migration + Go-Live
**Goal:** Ship it

**Deliverables:**
- Convex HTTP action to read from Supabase API
- Migration with validation:
  - Users
  - Cases (all 50+ fields)
  - Notifications
  - Conversations
- Verification:
  - Count verification
  - Spot-check random records
  - Validate all dates pass business rules
- **Feature verification:**
  - Run through 200+ feature checklist
  - Every feature works
- DNS switch
- Production deployment

**Research:** No

---

## Chatbot Requirements (Phases 26-29)

### Must Be Able To:

**Answer Questions About:**
- Any PERM regulation or deadline
- How to use any feature of the website
- User's cases, deadlines, status
- Comparisons between cases
- What needs attention

**Take Actions:**
- Create, update, delete cases
- Manage case status (archive, close, reopen)
- Handle notifications (read, delete)
- Update settings
- Calendar operations
- Fill forms from conversation

**Automate:**
- Multi-step workflows
- Bulk operations
- Action chaining
- Complex queries

### UI/UX Requirements:
- Streaming responses (not waiting for full response)
- Clear indication of what actions will be taken
- Confirmation for destructive actions
- Ability to cancel
- Error recovery
- History preserved across sessions

---

## Deadline System Architecture

### Central Module Requirements

The deadline/validation module must be:

1. **Central:** Single source of truth, used everywhere
2. **Extensible:** Easy to add new rules
3. **Removable:** Easy to remove rules if needed
4. **Testable:** 377 behaviors covered by tests
5. **Real-time:** Works with Convex subscriptions
6. **Chatbot-compatible:** Tools can use it

### Validation Rules (15+)

1. PWD filing < determination < expiration
2. PWD expiration calculation (Apr 2-Jun 30 rule)
3. Sunday ads must be on Sundays
4. Second Sunday ad > first Sunday ad
5. Job order ≥ 30 days
6. Recruitment end = max(second ad, job order end)
7. ETA 9089 filing ≥ 30 days after recruitment
8. ETA 9089 filing ≤ 180 days after recruitment
9. ETA 9089 filing before PWD expiration (if recruitment started before PWD)
10. ETA 9089 certification > filing
11. ETA 9089 expiration = certification + 180 days
12. I-140 filing > certification
13. I-140 filing ≤ 180 days after certification
14. I-140 approval > filing
15. RFI/RFE response deadlines

### Supersession Rules

| Deadline | Superseded By | Calendar/Notification Action |
|----------|---------------|------------------------------|
| PWD expiration | ETA 9089 filing | Delete events/notifications |
| Recruitment end | ETA 9089 filing | Delete events/notifications |
| ETA 9089 filing window | ETA 9089 filing | Delete events/notifications |
| ETA 9089 expiration | I-140 filing | Delete events/notifications |
| RFI response | RFI response submitted | Delete events/notifications |
| RFE response | RFE response submitted | Delete events/notifications |

### Cascade Behavior

When a date changes:
1. Recalculate dependent dates
2. Validate all related fields
3. If validation fails, show warning (not block)
4. Update notifications/calendar accordingly

---

## Testing Strategy

### TDD Approach
- Write tests BEFORE implementation
- Especially critical for validation logic
- Cover all 377 behaviors from current tests

### E2E Testing
- Playwright for user flows
- MCP tools for visual verification
- Cover all critical paths

### MCP Tools
- Chrome DevTools MCP for debugging
- Playwright MCP for automation
- Claude Chrome MCP for AI-assisted testing

---

## Credential Security

### Requirements
- Never commit credentials to git
- Use `.env.local` (gitignored)
- Secure storage pattern for test credentials
- Handle if credentials were previously committed:
  - Rotate them
  - Clean git history if needed

### Test Credentials
- Store in secure location outside repo
- Document access pattern
- Production-grade handling

---

*Last updated: 2025-12-20*
