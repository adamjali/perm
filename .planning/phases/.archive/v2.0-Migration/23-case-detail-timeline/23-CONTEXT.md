# Phase 23: Case Detail + Timeline - Context

**Gathered:** 2025-12-26
**Status:** Ready for planning

---

<vision>
## How This Should Work

### Case Detail Page (`/cases/[id]`)
A **command center** for each case. Users land here and instantly understand:
- Where this case is in the PERM journey (PWD → Recruitment → ETA 9089 → I-140)
- What's been completed, what's in progress, what's next
- Any urgent deadlines or actions needed
- The full story of this case's progress

The inline timeline shows the **story of progress** - a visual journey from start to (hopeful) I-140 approval. It should feel satisfying to see milestones completed, motivating to see what's ahead.

### Timeline Page (`/timeline`)
A **portfolio overview** showing all cases at once:
- Compare timelines across cases - who's ahead, who's behind, where are bottlenecks
- Track upcoming deadlines across the entire caseload
- Select/filter cases to focus on specific subsets
- Horizontal Gantt-style for desktop, vertical collapse for mobile

### Overall Feel
- **Command center** - Everything at a glance, powerful, information-dense, professional
- **Story of progress** - See the journey, satisfying, visual, motivating
- **Action-oriented** - Quickly see what needs attention and take action
- **Seamless** - Fluid movement between timeline, case detail, case list feels like one unified experience

### Design Direction
Neobrutalist aesthetic with:
- Hard shadows (4px 4px 0px #000), thick borders (2-4px)
- Forest Green (#228B22) accents
- Stage colors: PWD blue, Recruitment purple, ETA orange, I-140 green
- Motion.dev + GSAP for premium, snappy animations
- Full light/dark mode - seamless theming
- Mobile-first responsive: vertical layout with collapsible sections

</vision>

<essential>
## What Must Be Nailed

ALL of these are equally critical - no compromises:

1. **Visual Polish** - Timeline looks stunning. Neobrutalist, animated, dark/light mode perfect. Not boring or ugly like v1.

2. **Information Clarity** - Instantly understand case status, what's done, what's next, what's urgent. No confusion.

3. **Seamless Navigation** - Fluid movement between timeline, case detail, case list. Feels like one cohesive experience.

4. **All V1 Features Preserved** - Every feature from v1 timeline must exist in v2. Add to Timeline button, Remove from Timeline, case selection modal, time range picker, phase filtering, DOL processing times info, days elapsed between events, tooltips, click-to-navigate, etc.

5. **Mobile Excellence** - Vertical layout on mobile, collapsible where needed. Best possible UX, not just "it works."

</essential>

<boundaries>
## What's Out of Scope

Standard exclusions only:
- File attachments (deferred to post-MVP)
- Google Calendar sync (Phase 30)
- Notes/journal feature (not in current schema)

Everything else from v1 + improvements is IN scope.

</boundaries>

<specifics>
## Specific Requirements

### Features to Include (from v1 + old codebase)
- **Timeline Page:**
  - Time range selector (3/6/12/24 months)
  - Case selection modal with search, sort, filter, bulk actions
  - Phase filtering buttons (PWD/Recruitment/ETA/I-140)
  - Milestone dots (16 types) color-coded by stage
  - Range bars for duration periods (job order)
  - Tooltips with date + label
  - Click milestone to navigate to case
  - Legend showing stage colors
  - Privacy mode (blur employer names)

- **Case Detail Page:**
  - Add to Timeline / Remove from Timeline buttons
  - Inline 6-month centered timeline
  - All case info sections (read-only display)
  - Quick actions (edit, delete, archive)
  - Status/deadline summary

- **From old perm-tracker-new:**
  - DOL Processing Times info box (embedded educational content)
  - Days elapsed between events
  - Event status progression (future=gray, current=yellow, past=phase color)
  - Key vs non-key event differentiation

### Persistence
- **Convex database** - NO localStorage
- `timelinePreferences` table: userId, selectedCaseIds, timeRange
- Real-time sync across devices via subscriptions

### Default Behavior
- Show all active cases by default (no selection = all active)
- If no cases exist: illustration + CTA to add cases

</specifics>

<notes>
## Additional Context

### Animation Stack
- **Motion.dev** (formerly Framer Motion) for component animations
- **GSAP** for premium effects where appropriate
- Spring physics, 150ms transitions, snappy and responsive

### Mobile Strategy
- Vertical layout on mobile (not horizontal scroll)
- Collapsible sections for progressive disclosure
- Touch-friendly tap targets
- Best UX approach, not compromises

</notes>

---

<standards>
## Code Quality Standards (NON-NEGOTIABLE)

These standards apply to ALL work in this phase:

- **Clean & organized** - No clutter, logical structure
- **Minimal** - No over-engineering, simplest effective solution
- **Abstract-able** - Patterns that can be reused
- **Scalable** - Works with 1 case or 1000 cases
- **Maintainable** - Future developers can understand it
- **Readable** - Self-documenting code
- **Global fixes** - No repeated code, DRY everywhere. Fixes are global, not local patches.
- **Perfect overall** - High bar for quality

</standards>

<required_reading>
## Required Reading (MANDATORY)

ALL agents, subagents, and Task tools working on UI/frontend MUST read these before implementation:

1. **Design Philosophy:**
   - `.planning/FRONTEND_DESIGN_SKILL.md` - frontend-design skill (its a plug-in) - Neobrutalist design system rules

2. **Design References:**
   - `.planning/phases/17-design-system/design3.md`
   - `.planning/phases/17-design-system/design4.md`
   - `.planning/phases/17-design-system/design5.md`

3. **Business Logic (SOURCE OF TRUTH):**
   - `perm_flow.md` - Case statuses, progress statuses, stage transitions, deadline logic

4. **Existing v2 Patterns:**
   - `v2/src/components/` - Existing component patterns
   - `v2/src/app/globals.css` - Design tokens, CSS variables

</required_reading>

<compliance>
## Compliance Requirements

1. **All v1 features preserved** - Nothing lost. Every timeline feature from v1 exists in v2.

2. **Follow perm_flow.md** - All statuses, transitions, and deadline calculations per the source of truth.

3. **Match existing v2 patterns** - Consistent with dashboard, case list, forms already built.

</compliance>

---

<propagation>
## Propagation Instructions

### For plan-phase (Creating PLAN.md files):

When creating PLAN.md files for Phase 23, you MUST:

1. **Include in every PLAN.md:**
   - The Code Quality Standards section above
   - The Required Reading list above
   - The Compliance Requirements above

2. **Instruct PLAN.md to propagate to subagents:**
   - Every PLAN.md must contain explicit instructions that ANY subagent or Task tool invoked during execution MUST have these standards and required reading included in their prompt.

### For execution (Running PLAN.md files):

When executing plans and invoking Task tools or subagents:

1. **Explicitly include in EVERY subagent/Task prompt:**
   ```
   REQUIRED READING (read these before implementation):
   - .planning/FRONTEND_DESIGN_SKILL.md
   - .planning/phases/17-design-system/design3.md
   - .planning/phases/17-design-system/design4.md
   - .planning/phases/17-design-system/design5.md
   - perm_flow.md (source of truth for business logic)

   CODE QUALITY STANDARDS:
   - Clean, organized, minimal, abstract-able, scalable
   - Maintainable, readable, DRY (global fixes, no repetition)
   - Follow existing v2 patterns

   COMPLIANCE:
   - All v1 features must be preserved
   - Follow perm_flow.md for all business logic
   ```

2. **Use Explore agents** for codebase understanding before implementation

3. **Verify against v1** to ensure no features are lost

</propagation>

---

*Phase: 23-case-detail-timeline*
*Context gathered: 2025-12-26*
