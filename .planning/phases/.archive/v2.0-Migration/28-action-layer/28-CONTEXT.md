# Phase 28: Action Layer - Context

**Gathered:** 2026-01-09
**Status:** Ready for planning

---

<execution_standards>
## CRITICAL: Execution Standards for All Plans & Subagents

**This section MUST be included in every PLAN.md and passed to ALL subagents/Task tools.**

### Quality Standards

- **DRY/KISS**: Minimal, consolidated. No duplicates. Work within existing.
- **Clean code**: Maintainable, abstractable, scalable, readable.
- **Token-efficient**: Save context, be concise.
- **LSP Priority**: `findReferences` > grep, `goToDefinition` > grep, `documentSymbol` > grep. Fallback to Glob/Grep if LSP errors.

### Implementation Rules

1. **Explore First**: Fully explore to understand current implementation before coding
2. **No Clashing**: No duplicate, clashing, or non-integrated implementations
3. **Work Within**: Use as much existing code, patterns, and components as possible
4. **Refactor as Needed**: Improve code as you go to fit fixes and future work
5. **Global Fixes**: Ensure fixes are global, not repeated in multiple places
6. **Central Sources of Truth**: Use existing validation, deadline logic, form handling
7. **Clean Up**: Thoroughly clean up after each task

### Required Documents to Read

- **perm_flow.md**: Canonical source for case statuses, progress statuses, transitions, deadline logic
- **v2/CLAUDE.md**: Dev workflow, commands, v2-specific patterns
- **v2/docs/API.md**: Convex mutations/queries reference
- **.planning/V2_VALIDATION_RULES.md**: 44 validation rules, edge cases
- **.planning/V2_DEADLINE_FLOWS.md**: Deadline calculations, formulas

### UI Work Requirements

- **MUST use frontend-design skill** (it's a plugin) for ALL UI work
- **Design docs**: Read `.planning/phases/17-design-system/design3.html`, `design4.html`, `design5.html`
- **Follow design system**: Soft Neobrutalism, Forest Green, hard shadows, Space Grotesk

### V1 Parity

- All v1 features must be in v2 (but better, polished, actually working)
- v1 is reference/vision, NOT working implementation
- Everything in v2 must be production-quality

### Subagent Instructions

All subagents and Task tools MUST be explicitly told:
- These quality standards
- Which documents to read
- To use explore agents before implementing
- To use frontend-design skill for UI work
- To keep code clean, organized, minimal, abstractable, scalable, maintainable

### Orchestration Pattern

1. **Explore**: Spawn explore subagents to understand codebase
2. **Implement**: Spawn task subagents to build
3. **Verify**: Review and test
4. **Follow-up**: Fix any issues
5. **Track**: Use JSON tracking for all issues
6. **Clean up**: Thoroughly after completion

</execution_standards>

---

<vision>
## How This Should Work

The chatbot becomes a full proxy for the user. Anything a user can do in the app, the chatbot can do - creating cases, editing fields, deleting cases, syncing to calendar, managing notifications, changing settings, everything. No artificial limits.

Actions chain together naturally. User says "find all PWD cases older than 6 months and close them" - chatbot queries, shows results, asks permission, executes bulk close. User says "create a case for Acme Corp, set the employer to X, then sync it to my calendar" - chatbot chains those actions with reasoning in between.

The permission system is three-tiered:
- **OFF**: Read-only mode. Chatbot only answers questions, never offers to take actions.
- **CONFIRM**: Shows inline permission cards for each action. User approves/denies.
- **AUTO**: Actions execute immediately (except destructive ones like delete/bulk which always show red confirmation cards).

A toggle in the chat header lets users switch between modes quickly. It's always visible, always accessible.

When the chatbot needs permission, inline cards appear in the chat flow (v1 style). They're sleek, animated, don't block the page. User can scroll past them if they want. For destructive actions, cards are styled red with warning icons.

When chaining multiple actions, each action shows as its own card: pending → executing → done. It's a visual pipeline. User sees progress step-by-step, can interrupt at any point.

Everything uses the central validation systems - the same deadline calculations, form validation, business rules that the rest of the app uses. No duplicate logic, no clashing implementations.

</vision>

---

<essential>
## What Must Be Nailed

- **Complete coverage** - Every action a user can take, the chatbot can do. No gaps. Cases, calendar, timeline, notifications, ALL settings.
- **Bulletproof permissions** - Users feel completely in control. Never surprised by what chatbot did. Clear visual feedback at every step.
- **Beautiful execution** - Inline cards, progress visualization, animations - premium feel. motion.dev, GSAP, snappy and responsive.
- **Chaining & bulk** - Can do multiple actions in sequence with reasoning between. Can do bulk operations on filtered results.
- **Uses central systems** - All validation, deadline logic, form handling from existing sources of truth. No duplicates.
- **Navigation** - Navigate to any page, case, form. Scroll to elements. Visual client-side actions.

</essential>

---

<boundaries>
## What's Out of Scope

- Nothing explicitly excluded - if it's an action a user can take, it's in scope for this phase
- Phase 29 (Advanced Automation) is for polish and anything missed

</boundaries>

---

<specifics>
## Specific Ideas

### Permission Cards (v1 inspired, v2 polished)

**Inline in chat flow, not modal blocking:**
- Animated entrance (spring physics, slide up)
- Status transitions: pending → confirmed/denied → executing → done
- Tool-specific icons and colors
- Arguments displayed clearly (key: value pairs)
- Duration badges on completion
- Can scroll past (non-blocking)

**For destructive actions:**
- Red styling with warning icon
- Always requires confirmation (even in AUTO mode)
- Cannot be bypassed

### Three-Tier Permission Toggle

```
┌─────────────────────────────────────┐
│ Chat Header                         │
│ ┌─────────────────────────────────┐ │
│ │ OFF │ CONFIRM │ AUTO            │ │ <- Always visible toggle
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

- Always visible in chat header
- Visual indicator of current mode
- Quick-switch interaction (click to cycle or segmented control)

### Action Categories

| Category | Actions | Permission Tier |
|----------|---------|-----------------|
| **Queries** | Already done (Phase 27) | Autonomous |
| **Navigation** | Pages, cases, forms, scroll | Autonomous |
| **Case Read** | Get details, list, search | Autonomous |
| **Case Create** | Create new case, fill fields | CONFIRM |
| **Case Edit** | Update any field | CONFIRM |
| **Case Archive** | Archive/close, reopen | CONFIRM |
| **Case Delete** | Permanent deletion | DESTRUCTIVE |
| **Calendar Sync** | Add/remove per case | CONFIRM |
| **Calendar Bulk** | Bulk sync/unsync | DESTRUCTIVE |
| **Timeline** | Add/remove cases | CONFIRM |
| **Notifications** | Mark read (single) | CONFIRM |
| **Notifications** | Mark all read, delete, clear | DESTRUCTIVE |
| **Settings** | All fields, toggles | CONFIRM |
| **Bulk Operations** | Any bulk edit/delete | DESTRUCTIVE |
| **Chained Actions** | Multiple actions | Per-action |

### Chaining UX

Each action in a chain shows as its own card:
```
┌─────────────────────────────────────┐
│ 🔍 Finding PWD cases...             │ ✓ Done (234ms)
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 📝 Found 5 cases matching criteria  │
│    Acme Corp, TechStart, ...        │
│                                     │
│ [Approve All] [Review Each] [Deny]  │ ← Permission card
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 🗄️ Archiving 5 cases...             │ ⏳ Executing...
└─────────────────────────────────────┘
```

### Client Actions (Visual Form Filling)

For "fill out form but don't submit" requests:
- Navigate to form page
- Programmatically fill fields (visual, user sees it happen)
- Uses existing form validation
- Can be interrupted

Client action types:
- `navigate` - Go to page
- `fill_field` - Populate input
- `fill_date` - Set date picker
- `select_option` - Choose dropdown
- `submit_form` - Send form
- `scroll_to` - Scroll to element

</specifics>

---

<design_system>
## UI Design Requirements

**Aesthetic: Soft Neobrutalism** (must match existing v2)

### Typography
- **Headings**: Space Grotesk (bold, uppercase for emphasis)
- **Body**: Inter (400-600 weight)
- **Mono/Data**: JetBrains Mono (tool names, durations, arguments)

### Colors
```css
--bg: #FAFAFA;
--surface: #FFFFFF;
--ink: #000000;
--accent: #228B22; /* Forest Green */
--accent-soft: rgba(34, 139, 34, 0.1);

/* Stage colors (use for tool-specific) */
--stage-pwd: #0066FF;      /* Blue - queries */
--stage-rec: #9333ea;      /* Purple - knowledge */
--stage-eta: #D97706;      /* Orange - web search */
--stage-i140: #059669;     /* Green - case actions */

/* Status colors */
--success: #059669;
--warning: #D97706;
--destructive: #DC2626;
```

### Shadows & Borders
```css
--shadow: 4px 4px 0px #000000;
--shadow-hover: 8px 8px 0px #000000;
--shadow-active: 0px 0px 0px #000000;
--border: 2px solid #000000;
```

### Motion Patterns

**Timing:**
- Hover: 150ms cubic-bezier(0.165, 0.84, 0.44, 1)
- Entry: 400ms spring physics
- Micro-interactions: CSS only
- Layout shifts: Framer Motion

**Card hover:**
```css
.card:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-hover);
}
```

**Button press:**
```css
.btn:active {
  transform: translate(4px, 4px);
  box-shadow: none;
}
```

**Permission card entrance:**
- Spring animation (opacity 0→1, y: 8→0)
- Stagger: 0.08s between cards

**Status transitions:**
- Scale pulse on status change
- Color fade for state changes

### Permission Card Design

```
┌─────────────────────────────────────────────────┐
│ ┌──────┐                                        │
│ │ Icon │  Tool Name                   ⏳ 234ms  │
│ └──────┘                                        │
├─────────────────────────────────────────────────┤
│ status: recruitment  search: TechCorp           │ <- Arguments (mono)
│ hasRfi: true                                    │
├─────────────────────────────────────────────────┤
│ "3 cases found"                                 │ <- Result summary
├─────────────────────────────────────────────────┤
│ [Cancel]                          [Confirm ✓]   │ <- Actions (if permission needed)
└─────────────────────────────────────────────────┘
  ↑ 2px border, 4px shadow, Forest Green accent for success
```

**Destructive variant:**
- Red left border (4px)
- Red icon
- Red "Delete" button with destructive variant

### Loading States

- Shimmer effect for pending (existing pattern)
- Spinner icon rotating
- Skeleton matching card layout

### Grain Overlay (existing)

```css
.grain {
  position: fixed;
  opacity: 0.04;
  background-image: url("data:image/svg+xml,...");
  pointer-events: none;
  z-index: 9999;
}
```

</design_system>

---

<integration_points>
## Integration with Existing Systems

### Extends Phase 27 Infrastructure

- **Tool definitions**: Add action tools to existing `/v2/src/lib/ai/tools.ts`
- **Tool icons**: Extend `/v2/src/components/chat/tool-icons.tsx`
- **Result summaries**: Extend `/v2/src/components/chat/tool-result-summary.ts`
- **API route**: Modify `/v2/src/app/api/chat/route.ts` for permission flow
- **Tool cache**: Use existing cache invalidation for mutations

### Uses Central Validation

- Import from `/v2/src/lib/validation/` (Phase 16)
- Use existing date calculations, deadline logic
- Use existing form schemas (Zod)

### Convex Layer

- Use existing mutations in `/v2/convex/`
- Add permission state storage if needed
- Use existing RLS patterns

### Existing Confirmation Patterns

- Extend from `/v2/src/components/ui/dialog.tsx`
- Follow patterns from `UnsavedChangesDialog`, `DeleteConfirmDialog`
- New: `InChatConfirmationCard` component

</integration_points>

---

<notes>
## Additional Context

### Reference Materials
- `./chatbot.md` - Full chatbot requirements
- v1 chatbot for inspiration (InChatConfirmationCard, permission flow, ~28 tools)
- v2 existing: ToolCallCard, tool-icons, confirmation dialog patterns

### V1 Tools to Implement (All ~28)
```
Navigation (3): navigate, view_case, refresh_page
Data Query (8): list_cases, get_case, get_deadlines, query_by_status, search, etc.
Case Management (4): create_case, update_case, delete_case, archive_case
Calendar (2): google_calendar_sync, google_calendar_unsync
Notifications (3): delete_notification, clear_all, mark_read
Settings (2): update_settings, update_calendar_preferences
Forms (5): fill_field, fill_date, select_option, submit_form, etc.
Export (1): export_cases_data
```

### Must Work With
- Phase 27 tool infrastructure (queryCases, searchKnowledge, searchWeb)
- Tool caching and summarization (TTL-based)
- Existing Convex mutations/actions
- Central validation (perm_flow.md, form handling)
- Real-time Convex subscriptions

### UI Quality Bar (Non-Negotiable)
- motion.dev (framer-motion), GSAP where needed
- Smooth transitions, spring physics
- Hover effects, click feedback
- Loading states, skeletons, shimmer
- Neobrutalist theme (matches existing)
- Mobile responsive, snappy
- **MUST use frontend-design skill for all UI work**

</notes>

---

*Phase: 28-action-layer*
*Context gathered: 2026-01-09*
