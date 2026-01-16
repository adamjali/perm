# Phase 17: Design System - Context

**Gathered:** 2025-12-22
**Updated:** 2025-12-22
**Status:** Ready for planning

<vision>
## How This Should Work

A component library built on shadcn/ui with a Storybook catalog. Think of it as an internal "mini library" where all UI primitives live in `src/components/ui/` - buttons, inputs, cards, badges, status indicators, etc. Every component follows the neobrutalist design language: hard shadows, Forest Green accent, Space Grotesk headings.

Storybook runs at `localhost:6006` as a visual catalog - browse every component, see all variants (primary, secondary, destructive, disabled), test hover states, animations, and dark mode. Perfect for the Human Checkpoint review.

Animations should feel **snappy and responsive** - quick, crisp transitions (150-200ms) with a professional tool feel like Linear. Things happen instantly with subtle polish, not bouncy or playful.

The components become the building blocks that later phases (Dashboard, Case List, Forms) simply compose without building new primitives.

### Design Direction: "Match v1 + Polish"

Preserve the current design language but take the opportunity to:
- **Unify visual consistency** - Button styles, spacing, colors consistent across all pages
- **Refine typography** - Font sizes, weights, hierarchy properly unified
- **Strengthen status system** - Case stages and deadline urgency instantly readable

Keep existing design tokens (V2_DESIGN_TOKENS.json) as the foundation, with:
- **Linear-inspired polish** - Clean, minimal, modern aesthetic
- **Professional/serious tone** - This is for immigration attorneys, not a consumer app

</vision>

<essential>
## What Must Be Nailed

**All three inseparable — cannot pick one:**

1. **Reusable components** - Build once, use everywhere. Buttons, cards, forms, status badges all as composable primitives
2. **Status clarity** - At a glance, users instantly know case stage and deadline urgency. The status system is the product's core UX
3. **Consistent feel** - Every screen feels like the same app. Unified visual experience across all pages

These reinforce each other: consistent components enable status clarity; status clarity requires reusable patterns; all three together create a cohesive product.

</essential>

<boundaries>
## What's Out of Scope

- **Page layouts** - Just components. Dashboard/case pages are Phase 20+
- **Convex data wiring** - Pure UI with mock data. Real data integration comes later
- **Auth components** - Phase 18 handles auth UI
- **Complex forms** - Form field components yes, but full case forms are Phase 22

</boundaries>

<specifics>
## Specific Ideas

**Technical foundation:**
- shadcn/ui as component base (copy-paste ownership, Radix primitives, Tailwind-native)
- Framer Motion for animations (snappy 150-200ms transitions)
- Lottie via `lottie-react` for illustrative animations (loading, success, empty states)
- Storybook for component catalog and visual testing

**Design specifics:**
- **Status colors are critical** - Must match v1 exactly:
  - PWD: `#0066FF` (blue)
  - Recruitment: `#9333ea` (purple)
  - ETA 9089: `#D97706` (orange)
  - I-140: `#059669` (teal/green)
  - Closed: `#6B7280` (gray)
- **Dark mode parity** - Light and dark themes both first-class, not light-mode-first
- **Chatbot UI** - The AI assistant chat interface needs special attention as a core differentiator
- **Neobrutalist elements** - Hard shadows (`4px 4px 0px #000`), black borders, 6px border radius
- **Typography** - Space Grotesk for headings, Inter for body

**Inspiration:**
- Linear: Dark mode polish, professional density
- Greptile: Green palette, monospace accents, distinctive character
- Inngest: Geometric shapes, bold typography, scroll reveals
- VibeKanban: Clean developer aesthetic, kanban patterns
- Bento grid layouts for dashboard widgets

</specifics>

<notes>
## Additional Context

This phase has a **Human Checkpoint** - user must approve the component library before proceeding to Phase 18 (Auth).

The current production app (permtracker.app) already has the neobrutalist aesthetic established. The goal is to preserve this distinctive look while upgrading the implementation to React/Next.js with richer animations.

User wants to "stick relatively closely to the original, just if easy and/or opportunity to improve" - enhancement not revolution.

### Reference Materials

- **Design tokens:** `.planning/V2_DESIGN_TOKENS.json`
- **frontend-design skill (its a plug-in):** `.planning/FRONTEND_DESIGN_SKILL.md` (MUST read before implementation)
- **Design mockups:** 5 HTML prototypes in this folder exploring the neobrutalist aesthetic:
  - `design1` - Tectonic UI Strategy (bento grid, skeleton systems)
  - `design2` - Modular Assembly (shadcn/ui rationale, motion engine)
  - `design3` - Brainstorming (validation bridge, visual identity)
  - `design4` - Flash UI (skeleton patterns, stage progression)
  - `design5` - PERM Tracker Core (milled industrial aesthetic, knob controls)

All mockups demonstrate: hard shadows, Forest Green accent, JetBrains Mono code, bento grids, and the "snappy" interaction feel.

</notes>

---

*Phase: 17-design-system*
*Context gathered: 2025-12-22*
