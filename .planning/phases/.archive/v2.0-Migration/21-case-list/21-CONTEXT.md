# Phase 21: Case List + Actions - Context

## Vision Summary

**Core Experience:** Card grid with manila folder metaphor — cases look like physical manila folders with tabbed edges. On hover, folder "opens" with a smooth animation to reveal detailed info (replacing the v1 "Show More" button with a tactile hover interaction).

**Design Direction:** v1 functionality with v2 neobrutalist polish. User is open to design improvements — the v1 layout feels cluttered.

---

## How It Works

### Case Cards (Manila Folder Metaphor)

Each case displays as a manila folder with:

**Always Visible (Folder Tab):**
- Employer name on the folder tab
- Position title below
- Badges: Professional (if applicable), RFI Active (red), RFE Active (red)
- Status badge (colored by stage: PWD blue, Recruitment purple, ETA 9089 orange, I-140 green)
- Favorite star toggle
- Calendar sync indicator (if enabled)
- Next critical deadline with urgency styling

**On Hover (Folder Opens):**
- Smooth Framer Motion animation — folder lifts and opens to reveal contents
- Shows detailed dates: PWD (filed/determined/expires), ETA 9089 (filed/certified/expires), I-140 (filed/approved)
- Shows progress status
- Shows recruitment dates (started/expires) and ETA 9089 filing window opens date
- Lottie micro-interactions for the opening effect

**Action Buttons (Bottom of Card):**
- View → navigates to case detail (Phase 23)
- Edit → navigates to edit form (included in this phase)
- Delete → confirmation modal
- Close/Archive → appropriate action

### Filtering & Search

**Show By (Tabs/Buttons):**
- Active (default)
- Completed
- Closed/Archived
- All

**Filters:**
- Case Status dropdown (matches perm_flow.md: PWD, Recruitment, ETA 9089, I-140, Closed)
- Progress Status dropdown (Working on it, Waiting for intake, Filed, Approved, Under review, RFI/RFE)
- Search (employer name, robust and responsive)

**Sort By:**
- Next deadline (default)
- Favorites
- Recently updated
- Employer name
- Case status
- PWD filing date
- ETA 9089 filing date
- I-140 filing date

**Per Page:**
- Options: 6, 12 (default), 24, 50

**Smart Filters (Pre-built Views):**
- Urgent deadlines
- Recent activity
- Needs attention

### Selection Mode & Bulk Actions

- Toggle "Select Cases" mode
- Checkboxes appear on cards
- Select All / Deselect All buttons
- Export CSV / Export JSON (shows count when items selected)
- Bulk actions: Delete, Archive (with confirmation)

### Import/Export

**Export:**
- CSV with comprehensive fields
- JSON with full case data
- Respects current filters and selection

**Import:**
- JSON file upload
- Auto-detect old PERM Tracker format (Firebase migration)
- Preview before import
- Validation with error messages

### Pagination

- Previous/Next buttons
- Page X of Y display
- "Showing X of Y cases" count
- URL parameter support (?status=, ?category=)

---

## What's Essential

1. **Manila folder cards with hover-to-open animation** — the signature v2 interaction
2. **All v1 filtering/sorting** — status, progress, search, sort options, per-page
3. **All badges** — Professional, RFI Active, RFE Active, stage status
4. **All actions** — View, Edit, Delete, Close/Archive, Favorite toggle
5. **Selection mode + bulk export** — CSV/JSON export with selection
6. **Import functionality** — JSON import with legacy format migration
7. **Deadline display** — Next critical deadline with urgency styling
8. **Case creation/editing** — Add Case button + forms (included in this phase per user)
9. **Pagination** — with URL parameter support
10. **Preferences persistence** — sort/per-page saved to backend

---

## What's Out of Scope

- **Case detail view** — Phase 23 (navigates there from View button)
- **Calendar two-way sync** — Phase 30 (just show indicator if enabled)
- **Notifications** — Phase 24

---

## Design Recommendations

**Layout Improvements (vs v1):**

1. **Cleaner filter bar:** Group filters logically — Show By as tabs at top, then a single filter bar with search + dropdowns. Avoid the cluttered horizontal spread of v1.

2. **Card spacing:** Increase gap between cards. v1 feels cramped. Let the folders breathe.

3. **Visual hierarchy on cards:**
   - Employer name should dominate (larger, bolder)
   - Deadline is second priority (prominent but not competing with employer)
   - Badges should be subtle chips, not attention-grabbing

4. **Folder aesthetics:**
   - Subtle paper texture on cards
   - Tab extends from top of card (like a real folder tab)
   - Shadow shifts on hover to suggest depth
   - Optional: slight rotation on hover for playfulness

5. **Empty state:** Illustration of an empty filing cabinet with CTA to add first case

6. **Loading state:** Skeleton folders (not generic rectangles)

7. **Action button layout:** v1 has 3 buttons crammed at bottom. Consider:
   - Primary action (View) as main button
   - Secondary actions in a "..." menu
   - Or: icons instead of text buttons

8. **Color usage:** Use stage colors (PWD blue, Recruitment purple, etc.) more prominently — maybe as folder tab color or left border accent.

---

## perm_flow.md Alignment

Per perm_flow.md Design section:

- **Export/import at bottom** — not prominently placed
- **Filter by case status AND progress status** — both dropdowns
- **Show by:** Active, All, Completed, Closed/Archived
- **Sort-by options:** Match the list (recently updated, favorites, next deadline, employer name, case status, PWD/ETA/I-140 filing dates)
- **Search:** "Good and for anything and robust"
- **Show more section should include:**
  - Recruitment started (date of start, earliest recruitment step)
  - Recruitment expires (180 days after that)
  - ETA 9089 filing window opens (30 days after recruitment ends)

---

## Micro-Interactions

- **Folder hover:** Lift + open animation (Framer Motion)
- **Favorite toggle:** Star fills with bounce
- **Delete confirmation:** Modal slides in from bottom
- **Card load:** Staggered entrance animation
- **Filter change:** Cards animate out/in (layout animation)
- **Checkbox toggle:** Subtle scale + check animation
- **Export success:** Brief confetti or checkmark Lottie

---

## Technical Notes

- Real-time via Convex subscriptions (cases update live)
- Deadline calculations using Phase 16 validation module
- Build on Phase 20 dashboard data layer
- Use Phase 17/17.1 design system components
- TDD throughout

---

## Open Questions (Resolved)

1. ~~Include case forms?~~ → **Yes, included in Phase 21**
2. ~~Include import?~~ → **Yes, included**
3. ~~Bulk actions scope?~~ → **Keep selection mode with export + bulk delete/archive**

---

## CRITICAL INSTRUCTIONS FOR PLANNING & EXECUTION

**These instructions MUST be included in ALL plan files and MUST be explicitly passed to ALL subagents and Task tool prompts.**

### Code Quality Standards

- **Clean & Organized:** Code must be clean, organized, minimal, abstractable, scalable, maintainable, and readable
- **Global Fixes:** Any fixes must be global — do NOT repeat fixes in multiple places. Abstract and centralize.
- **No Duplication:** If a pattern is used more than once, extract it into a reusable component/function/utility
- **Perfect Overall:** Strive for production-grade quality in every file

### Required Reading (MUST READ BEFORE ANY IMPLEMENTATION)

All agents/subagents working on Phase 21 MUST read these files:

1. **frontend-design skill (its a plug-in):** `.planning/FRONTEND_DESIGN_SKILL.md`
2. **Design Doc 3:** `.planning/phases/17-design-system/design3`
3. **Design Doc 4:** `.planning/phases/17-design-system/design4`
4. **Design Doc 5:** `.planning/phases/17-design-system/design5`
5. **PERM Flow (Source of Truth):** `./perm_flow.md`
6. **v2 Design System:** `v2/docs/DESIGN_SYSTEM.md`

### Feature Parity

- **ALL v1 features must be present** — use Explore agent to verify v1 implementation before building
- **Follow perm_flow.md exactly** — this is the source of truth for case statuses, progress statuses, stage transitions, and deadline logic

### Subagent & Task Tool Requirements

When using Task tool or spawning subagents, ALWAYS include in the prompt:

```
CRITICAL INSTRUCTIONS:
1. Read these files BEFORE any implementation:
   - .planning/FRONTEND_DESIGN_SKILL.md
   - .planning/phases/17-design-system/design3
   - .planning/phases/17-design-system/design4
   - .planning/phases/17-design-system/design5
   - perm_flow.md
   - v2/docs/DESIGN_SYSTEM.md

2. Code must be: clean, organized, minimal, abstractable, scalable, maintainable, readable

3. Fixes must be GLOBAL — no repeated code, abstract patterns into reusable utilities

4. Ensure ALL v1 features are present — verify against v1 implementation

5. Follow perm_flow.md as the source of truth for business logic
```

### Workflow

- Use **Explore agent** to understand existing code before implementing
- Use **Task subagents** for parallel work where appropriate
- **Reiterate the plan back to the user** before starting any implementation work

### Pre-Execution Checklist

Before starting any plan execution, the agent MUST:
1. Read all required documents listed above
2. Summarize understanding of the task
3. List all v1 features that will be replicated
4. Confirm design approach aligns with design docs
5. Reiterate the full plan back to the user for approval
