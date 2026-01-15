# frontend-design skill (its a plug-in)

> **CRITICAL FOR SUBAGENTS**: This file MUST be read by any agent or subagent working on UI/frontend/visual components. Subagents cannot access skills directly - this file provides the design guidance.

---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when building web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

---

## Project-Specific Context: PERM Tracker v2

For this project, also consult:
- `@.planning/V2_ORIGINAL_VISION.md` - User requirements (canonical source)
- `@.planning/V2_DESIGN_TOKENS.json` - Established design tokens (colors, typography, spacing)
- `@.planning/V2_MILESTONE_CONTEXT.md` - Phase-specific UI requirements
- `@.planning/codebase/ARCHITECTURE.md` - v1 frontend patterns to preserve
- `@.planning/phases/17-design-system/17-CONTEXT.md` - Full design context
- `@v2/docs/DESIGN_SYSTEM.md` - **v2 component library & utility class reference**
- `@/Users/dev/cc/perm-tracker-test/.planning/phases/17-design-system/design1` - Design inspiration example 1
- `@/Users/dev/cc/perm-tracker-test/.planning/phases/17-design-system/design2` - Design inspiration example 2
- `@/Users/dev/cc/perm-tracker-test/.planning/phases/17-design-system/design3` - Design inspiration example 3
- `@/Users/dev/cc/perm-tracker-test/.planning/phases/17-design-system/design4` - Design inspiration example 4
- `@/Users/dev/cc/perm-tracker-test/.planning/phases/17-design-system/design5` - Design inspiration example 5

**Design System (Phase 17)**: Neobrutalist aesthetic with Forest Green (#228B22), hard shadows, Space Grotesk + Inter typography. See `v2/docs/DESIGN_SYSTEM.md` for complete component library and utility classes.

### Case Status Colors (from v1, preserved in v2)

| Status | Hex | Usage |
|--------|-----|-------|
| PWD | `#0066FF` | Blue - PWD phase |
| Recruitment | `#9333ea` | Purple - Recruitment phase |
| ETA 9089 | `#D97706` | Orange - ETA 9089 phase |
| ETA 9089 (working) | `#EAB308` | Yellow - Working on ETA 9089 |
| I-140 | `#059669` | Teal/Green - I-140 phase |
| Closed | `#6B7280` | Gray - Terminal/archived |

### Additional Tags

| Tag | Colors | Usage |
|-----|--------|-------|
| Professional | `#1F2937` bg / `#F9FAFB` text | Professional occupation |
| RFI Active | `#DC2626` | Active RFI |
| RFE Active | `#DC2626` | Active RFE |

### Urgency Colors

| Level | Hex | Days Until |
|-------|-----|------------|
| Urgent | `#DC2626` | ≤ 7 days |
| Soon | `#EA580C` | 8-30 days |
| Normal | `#059669` | 30+ days |
