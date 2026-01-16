# Phase 20: Dashboard + Deadline Hub - Context

**Gathered:** 2025-12-23
**Status:** Ready for planning

<vision>
## How This Should Work

When users log in, they land on a **command center** that's simultaneously professional, calm, and action-oriented. Everything important is visible at a glance - they're in charge of their caseload without feeling overwhelmed.

The **Deadline Hero Widget** is the crown jewel - prominently at the top, showing urgency groups (overdue, this week, this month, later) with satisfying animations and hazard stripes on overdue items. This is what the user loves about v1 and wants preserved and enhanced.

Below that, **Summary Tiles** show case counts by stage (PWD, Recruitment, ETA 9089, I-140, Complete, Closed/Archived) with the signature StageProgression expanding underline hover effect. Each tile has gray subtext breaking down the counts (e.g., "3 working, 2 filed"). Clicking a tile navigates to Cases List filtered by that status.

The dashboard also includes **Upcoming Deadlines** (next 30 days), **Recent Activity** (last 5 updated cases), and an **Add Case** button at the bottom.

Everything feels snappy (150-200ms transitions), premium (grain overlay, dot patterns), and polished (skeleton loading, responsive across all devices, proper dark mode).

</vision>

<essential>
## What Must Be Nailed

- **Deadline Hero Widget** - Full functionality from v1: 4 urgency groups, auto-refresh (5 min), click → case detail, badge counts, hazard stripes on overdue, dismissible deadlines synced to DB, manual refresh button, "+N more" overflow, staggered slide-in animations. This is THE feature.

- **Summary Tiles with StageProgression effect** - 7 tiles with the expanding underline hover animation, progress rings that animate/fill on scroll into view, subtext breakdowns per perm_flow.md requirements

- **Light/Dark mode** - Full support with toggle, consistent everywhere, not missing like on auth pages

- **Header with all nav links** - Include Cases, Calendar, Notifications, Settings links even if pages aren't built yet - so we can finish page-by-page

- **Premium polish** - Grain overlay, dot pattern background, skeleton loading on all sections, snappy 150-200ms timing (NO pulsing/glow), responsive across desktop/tablet/mobile

- **Responsive handling** - Long names truncate/wrap properly, no overflow/overlap, good padding/spacing/centering

</essential>

<boundaries>
## What's Out of Scope

- **Case interactions** - No editing/deleting/creating cases from dashboard directly. Click tile → goes to Cases List (Phase 21). Click deadline → goes to Case Detail (Phase 23). Dashboard is view + navigate only.

- **Notification bell/panel** - That's Phase 24. Dashboard just shows Recent Activity, not live notification dropdown.

- **Confetti/celebration animations** - Save those for when I-140 is approved (Case Detail page, not dashboard)

- **Chatbot** - That's Phases 26-29

- **Calendar view** - That's Phase 23.1

</boundaries>

<specifics>
## Specific Ideas

**From perm_flow.md (SOURCE OF TRUTH):**
- Complete = I-140 approved (separate from Closed/Archived)
- PWD subtext: "X working on it, Y filed"
- Recruitment subtext: "X ready to start, Y in progress"
- ETA 9089 subtext: "X prep, Y RFI, Z filed"
- I-140 subtext: "X prep, Y RFE, Z filed"

**Visual references:**
- Design4 (Flash UI) as primary aesthetic reference
- StageProgression component for stat tile hover effect (expanding underline, monospace numbers)
- Hazard stripes (diagonal yellow/black) for overdue items
- Grain overlay (4% opacity SVG noise) + dot pattern background
- Progress rings around stage icons that animate on scroll into view
- Quick-peek hover cards on deadline items

**Interactions:**
- All transitions 150-200ms, cubic-bezier timing, snappy NOT floaty
- Cards lift on hover (translate -2px, -2px, shadow expands)
- Buttons press into page on click (translate 4px, 4px, shadow collapses)
- Skeleton shimmer loading for all sections
- No pulsing glow effects (explicitly removed)

**Typography:**
- Space Grotesk for headings
- Inter for body
- JetBrains Mono for technical labels/numbers

**Status colors (from v1):**
- PWD: #0066FF (blue)
- Recruitment: #9333ea (purple)
- ETA 9089: #D97706 (orange)
- I-140: #059669 (teal/green)
- Closed: #6B7280 (gray)

</specifics>

<notes>
## Additional Context

**User's vibe:** "I never know fully what I want or how to say it, so try to understand my gist, vibe, vision, and make it happen even suggesting and recommending things I didn't even say or think of."

**User's philosophy:** Go over and beyond. Every detail matters. The deadline widget is beloved - don't just replicate, enhance where possible while preserving what works.

**From deferred items (STATE.md):**
- Hazard stripes - deferred from Phase 17.1 to Phase 20 ✓
- Corner label component - deferred from Phase 17.1 to Phase 20 ✓

**Technical context (for planning, not user's concern):**
- Real-time via Convex subscriptions
- Existing design system components in v2/src/components/
- Auth context from Phase 18
- Cases schema from Phase 19

**Human Checkpoint:** Phase 20 has a UI review gate - user must approve before moving to Phase 21.

</notes>

---

*Phase: 20-dashboard*
*Context gathered: 2025-12-23*
