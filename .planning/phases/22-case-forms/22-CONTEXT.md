# Phase 22: Case Forms - Context

**Gathered:** 2025-12-25
**Status:** Ready for planning

---

## CRITICAL: Cascading Requirements

> **These instructions apply to THIS phase, ALL PLAN.md files created, and ALL subagents/Task tools invoked.**

### Mandatory Documentation (Must Read Before Any Work)

| Document | Path | Purpose |
|----------|------|---------|
| **perm_flow.md** | `/perm_flow.md` | **SOURCE OF TRUTH** - Case statuses, progress statuses, date validation, deadline logic |
| **frontend-design skill (its a plug-in)** | `.planning/FRONTEND_DESIGN_SKILL.md` | Design guidance, neobrutalist aesthetic, status colors |
| **Design Inspiration 1-5** | `.planning/phases/17-design-system/design1-5` | Design examples, hard shadows, animations |
| **This Context** | `.planning/phases/22-case-forms/22-CONTEXT.md` | Phase requirements |
| **V2 Design System** | `v2/docs/DESIGN_SYSTEM.md` | Component library, utility classes |

### Code Quality Standards (Non-Negotiable)

- **Clean** - No clutter, no dead code
- **Organized** - Logical structure, proper separation of concerns
- **Minimal** - No over-engineering, no unnecessary abstraction
- **Abstractable** - Reusable patterns where appropriate
- **Scalable** - Handles growth without refactoring
- **Maintainable** - Easy to modify and extend
- **Readable** - Self-documenting, clear naming
- **Global fixes** - Fix at the source, never repeat patterns

### TDD Requirements

- Tests BEFORE implementation (red-green-refactor)
- Full coverage of validation logic
- Edge case coverage
- Integration tests for cascade behavior

### UI/Design Standards

- Animations, transitions, microinteractions
- Lottie animations for celebrations/success states
- Reactive, snappy, responsive
- Creative use of existing design system components
- Create new components via Storybook when needed
- User hints and guidance
- Polish everything

### V1 Feature Parity

- **ALL v1 features must be present**
- Nothing lost
- Only improvements and v2 polish

### Subagent/Task Tool Requirements

**ALL Task tools and subagents MUST have these instructions explicitly in their prompts:**

```
CRITICAL REQUIREMENTS:
1. Read these docs FIRST: perm_flow.md, .planning/FRONTEND_DESIGN_SKILL.md,
   .planning/phases/17-design-system/design1-5, .planning/phases/22-case-forms/22-CONTEXT.md
2. perm_flow.md is SOURCE OF TRUTH for all case logic
3. V1 feature parity - all features must be preserved
4. Code quality: clean, organized, minimal, abstractable, scalable, maintainable, readable
5. Global fixes only - no repeated patterns
6. Full TDD - tests before implementation
7. UI: animations, transitions, microinteractions, Lottie, reactive, snappy, polish
8. Use Explore and Task subagents for research and complex work
```

---

<vision>
## How This Should Work

A single, comprehensive form for adding and editing PERM cases. The form should feel **guided, fast, and polished** - all three at once.

**Guided:** The form anticipates what you need. When you enter a PWD determination date, the expiration auto-calculates. When you check "Professional Occupation," the additional recruitment methods section slides in with a satisfying animation. Validation hints appear contextually, guiding you toward valid data without being annoying.

**Fast:** Power users can tab through fields efficiently. Keyboard navigation works. No unnecessary clicks or modals. Save and cancel are always accessible. The form respects your time.

**Polished:** Every interaction has feedback. Auto-calculated fields pulse briefly to draw attention. Validation errors shake subtly. Success states feel satisfying. The neobrutalist design with hard shadows, Forest Green accents, and snappy animations makes it feel premium.

**Improved over v1:** Same features, better organization. Clearer section groupings. More intuitive flow. Better visual hierarchy.

</vision>

<essential>
## What Must Be Nailed

### 1. Live Validation UX
- Cross-field validation that helps, not annoys
- Real-time feedback as you type/blur
- Validation BLOCKS save (no partial saves, no drafts)
- Clear error messages with visual indicators (red borders, shake animations)
- Success indicators (green borders, checkmarks)
- Constraint hints under fields

### 2. Auto-Fill Cascade
- PWD determination → PWD expiration (auto-calculate per 20 CFR 656.40(c))
- Notice of Filing start → end (+10 business days, excludes weekends/holidays)
- Job order start → suggestion for end (+30 days minimum)
- ETA 9089 certification → expiration (+180 days)
- Visual feedback when fields auto-update (highlight pulse animation)
- Downstream fields recalculate when upstream changes

### 3. V1 Feature Parity (Complete)
Every single v1 feature must work:
- All form fields (see V1 Features section below)
- Professional occupation toggle with 3 additional methods
- Dynamic RFI/RFE entries
- Filing window indicators
- Calendar sync toggle
- Favorite toggle
- Duplicate prevention
- All validation rules

</essential>

<boundaries>
## What's Out of Scope

- **File attachments** - Deferred (complex file storage)
- **Bulk editing** - Phase 21 covered bulk actions
- **Case deletion from form** - Separate action (case detail page)
- **Import from form** - Phase 21 covered import

</boundaries>

<specifics>
## Specific Requirements

### Form Structure
- **Single form** - Not a multi-step wizard (matches v1)
- **Add/Edit same component** - Mode switching based on route
- **Dedicated routes** - `/cases/new` and `/cases/:id/edit`
- **Simple save/cancel** - No "save & continue" complexity
- **Validation blocks save** - Cannot submit with errors

### Route & Navigation
- `/cases/new` - Add new case (empty form)
- `/cases/:id/edit` - Edit existing case (pre-populated)
- Cancel returns to previous page (case list or case detail)
- Save success redirects to case detail page

### Duplicate Prevention
- Check for existing case with same employer + beneficiary combination
- Show warning before allowing duplicate
- User can override if intentional

### Empty States (Post-Cleanup)
After Phase 22, all mock data is removed. Empty states must work perfectly:
- Dashboard with 0 cases: Helpful guidance, prominent "Add Case" CTA
- Case list with 0 cases: "No Cases Yet" image + title + CTA button
- Smooth onboarding experience for new users

</specifics>

---

## V1 Features Reference (Must Preserve)

### Form Fields by Section

#### Basic Information
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `employer_name` | text | Yes | |
| `position_title` | text | Yes | |
| `case_number` | text | No | Internal reference |
| `case_status` | dropdown | Yes | PWD, Recruitment, ETA 9089, I-140, Closed |
| `progress_status` | dropdown | Yes | Working, Under Review, Filed, etc. |

#### PWD Section
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `pwd_filing_date` | date | No | When submitted to DOL |
| `pwd_determination_date` | date | No | When DOL issued PWD |
| `pwd_expiration_date` | date | Auto | Calculated from determination |

#### Recruitment Section
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `sunday_ad_first_date` | date | No | Must be Sunday |
| `sunday_ad_second_date` | date | No | Must be Sunday, after first |
| `sunday_ad_newspaper` | text | No | For recruitment summary |
| `job_order_start_date` | date | No | |
| `job_order_end_date` | date | No | >= 30 days after start |
| `job_order_state` | dropdown | No | All 50 states + DC |
| `notice_of_filing_start_date` | date | No | Internal posting start |
| `notice_of_filing_end_date` | date | Auto | +10 business days |
| `recruitment_applicants_count` | number | No | Default 0 |
| `is_professional_occupation` | checkbox | No | Toggles additional methods |

#### Additional Recruitment Methods (Professional Only)
- Shows when `is_professional_occupation` checked
- Up to 3 methods required
- Each method has: type dropdown, date(s), outlet name (conditional)
- 11 method types with different field configurations
- Dynamic add/remove with animations

#### ETA 9089 Section
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `eta9089_filing_date` | date | No | 30-180 days post-recruitment |
| `eta9089_certification_date` | date | No | |
| `eta9089_expiration_date` | date | Auto | +180 days from cert |
| Filing window indicator | UI | - | Color-coded status badge |

#### RFI Entries (Dynamic)
- Add/remove RFI entries
- Fields: title, description, received_date, response_due (auto +30 days), submitted_date, notes
- Only one active RFI at a time

#### I-140 Section
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `i140_filing_date` | date | No | |
| `i140_approval_date` | date | No | Triggers "Complete" state |
| `i140_category` | dropdown | No | EB-1, EB-2, EB-3 |
| `i140_service_center` | text | No | |
| `i140_premium_processing` | checkbox | No | |
| Filing window indicator | UI | - | Color-coded status badge |

#### RFE Entries (Dynamic)
- Add/remove RFE entries
- Fields: title, description, received_date, response_due (manual, ~87 days hint), submitted_date, notes
- Only one active RFE at a time

#### Notes & Settings
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `notes` | textarea | No | Case notes |
| `calendar_sync_enabled` | toggle | No | Default true |
| `is_favorite` | toggle | No | Default false |

### Validation Rules (From perm_flow.md)

1. PWD filing < determination < expiration
2. First Sunday ad MUST be on Sunday
3. Second Sunday ad MUST be on Sunday AND after first
4. Job order >= 30 days duration
5. Notice of filing >= 10 consecutive business days
6. ETA 9089 filing 30-180 days after recruitment ends
7. ETA 9089 filing before PWD expiration
8. I-140 filing <= 180 days after ETA 9089 certification
9. RFI: due date = received + 30 days (strict, not editable)
10. RFE: due date is editable (no auto-calculation)
11. All response submitted dates must be after received and before due

### Auto-Calculation Cascade

1. **PWD determination → expiration**
   - Apr 2 - Jun 30: +90 days
   - Otherwise: Next Jun 30

2. **Notice of Filing start → end**
   - +10 business days (excludes weekends + federal holidays)

3. **Job order start → suggested end**
   - +30 days minimum (can extend, not shorten)

4. **ETA 9089 certification → expiration**
   - +180 days

5. **RFI received → due**
   - +30 days (strict)

### UX Patterns (From v1)

- **Loading:** Full-page spinner when fetching case data
- **Errors:** Inline validation with red borders, shake animation
- **Success:** Green borders, checkmarks, toast notifications
- **Animations:**
  - Highlight pulse when auto-calculating (0.5s ease-in-out)
  - Slide-in for dynamic entries (RFI/RFE/methods)
  - Fade-out on remove
  - Filing window badge with subtle pulse
- **Layout:** Multi-column where appropriate, stacks on mobile

---

## Mock Data Cleanup (End of Phase 22)

After Phase 22 completes:

### Remove
- `v2/convex/seed.ts` - Delete or disable seed mutations
- All existing mock case records from Convex database

### Keep (For Testing)
- `v2/test-utils/*.ts` - Test fixture factories
- Storybook stories with hardcoded data

### Result
- 0 cases initially for all users
- Empty states work perfectly
- Real case data only from this point forward

---

<notes>
## Additional Context

### Design References
- Neobrutalist aesthetic with Forest Green (#228B22)
- Hard shadows (4px 4px 0px #000)
- Space Grotesk headings, Inter body, JetBrains Mono data
- Status colors: PWD blue, Recruitment purple, ETA orange, I-140 green
- Framer Motion for layout animations
- CSS for micro-interactions (hovers, focuses)
- Lottie for celebrations (I-140 approved)

### Technical Stack
- React Hook Form for form state
- Zod schemas (reuse Phase 16 perm-engine validators)
- Convex mutations for create/update
- Server-side validation (never trust client)

### Priority
All three pillars equally critical:
1. Live validation UX
2. Auto-fill cascade
3. V1 feature parity

No compromises.

</notes>

---

*Phase: 22-case-forms*
*Context gathered: 2025-12-25*
