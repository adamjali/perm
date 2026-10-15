# PERM Tracker design system

**The calm system, Oct 14 2026.** One flat page, plain type, light lines, one lime
for the main action, nothing moving unless the visitor did something. The owner's
brief: "super simple, not crowded, readable, breathable ... minimal, clear,
frictionless ... no particles or dots."

The tokens live in `src/app/globals.css`, the rules are held by
`src/app/__tests__/calm-system.test.ts`, and the parts are in `src/components/ui/`.
When this file and the code disagree, the code is right and this file is stale.

## The rules

1. **One answer first.** Every page opens with its title, one short lede and the one
   fact it exists to give, then the one action that follows from it.
2. **One tinted panel per page** (`bg-tint`), for that answer. Everything else sits
   on the page or on a white card.
3. **Lime is for the main action only**, one per screen. It's never text (2.05:1);
   text and links in green use the green ink (`text-primary-text`, `.link`).
4. **Square corners.** Every radius token is 0. `rounded-full` is kept only for
   things that are round by nature: dots, spinners, the switch.
5. **Two shadows, no more**: the lime button's small hard edge in light mode
   (`shadow-press`), and a soft neutral shadow under things that float over the
   page (`shadow-overlay`: menus, the search, dialogs, toasts).
6. **Sentence case everywhere.** No `uppercase`, no wide letter spacing.
7. **Mono only for case numbers, dates and figures** in tables and chart ticks.
8. **Nothing moves by itself.** Hover changes a colour or an underline; press
   darkens a fill; nothing lifts, scales or slides on load or scroll.
9. **The floor:** 16px body, 14px smallest text, 4.5:1 text contrast (3:1 large),
   3:1 for anything a reader must see to understand (control outlines, chart
   marks), 44px tap targets, full keyboard use, reduced motion honoured.

## Colour

Light values; dark values are in the `.dark` block beside them.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | #FAFAFA | #111111 | the page |
| `--card` | #FFFFFF | #1A1A1A | a raised surface |
| `--muted` | #F5F5F5 | #222222 | a sunken ground, a hover wash |
| `--tint` | #EDF4EE | #1C2C1E | the one answer panel, a chosen option |
| `--foreground` | #141414 | #EDEDED | text level 1 (17.65:1) |
| `--soft-foreground` | #3D3D3D | #C4C4C4 | text level 2 (10.41:1) |
| `--muted-foreground` | #5E5E5E | #A3A3A3 | text level 3 (6.21:1) |
| `--border` | #E5E5E5 | #2E2E2E | a line that only groups content |
| `--input` | #858585 | #737373 | a line around a control, a chart mark (3:1 or better) |
| `--primary` | #2ECC40 | #2ECC40 | the main action's fill |
| `--primary-text` | #1A7A25 | #2ECC40 | green as text: links, focus, a chosen tab |
| `--ring` | #1A7A25 | #2ECC40 | the keyboard focus ring |

- **Which line colour.** `border-border` for a line that groups (a card edge, a table
  rule, a divider). `border-input` around anything a person types into or presses,
  and `bg-input` for a chart mark that carries a value (a median, a split point, an
  axis tick). The old `--border` was ink, so a mark drawn in it vanished when the
  token lightened; that's why the distinction is written down.
- **Status and data colours** (`--data-good`, `--data-warn`, `--data-bad`,
  `--data-none`, `--data-info`, each with an `-ink` twin for text) appear in charts,
  status dots and badges, never on chrome.
- **Stage colours** (`--stage-pwd`, `--stage-recruitment`, `--stage-eta9089`,
  `--stage-i140`, `--stage-closed`, each with an `-ink` twin) mark a case's stage in
  timelines and the case card, and nowhere else.
- **Hatching** (`bg-hatch`, `bg-hatch-reverse`) means "not decided yet", "not known"
  or "withheld". It takes the text colour: `text-muted-foreground` for a placeholder,
  `text-input` where it has to be seen against a neighbour.

Contrast is tested: `calm-system.test.ts` checks every text token against every
surface in both themes.

## Type

| Role | Class | Size |
|---|---|---|
| Display (homepage, hub H1) | `text-4xl` | 34 to 44px, fluid |
| Title (page H1) | `text-3xl` | 28 to 32px, fluid |
| Heading (H2) | `text-2xl` | 24px |
| Subheading (H3) | `text-lg` / `text-xl` | 18px |
| Body | `text-base` | 16px |
| Small (the floor) | `text-sm` | 14px |

`text-xs` is mapped to 14px and `text-5xl` to `text-7xl` to the display size, so an
old class can't break the scale. Space Grotesk 700 for headings (`font-heading`),
Inter for text, JetBrains Mono (`font-mono`) for numbers only. Headings are bold,
never black-weight. Prose runs at 68 characters at most (`max-w-prose` or
`max-w-3xl`); paragraphs are 1em apart with no indent.

## Space and layout

- Steps of 4, 8, 12, 16, 24, 32, 48, 64 and 96px. Blocks on a page sit 48px apart on
  a phone and 64px on a desktop; cards have 16 or 24px inside.
- Widths: text 68ch; single-job pages (the case lookup, calculators, articles,
  settings) 960px; wide pages (data, entity pages, the dashboard, cases, calendar)
  1200px.
- **One page shape:** header, breadcrumb, title block (H1, a lede of 25 words or
  fewer), the answer panel, main sections (H2, then content; a box only around a
  figure, a form or a table), folded detail, one next step, at most three related
  links, footer. At most five boxes and one lime element in the first two screens,
  and never a card inside a card.
- A grid holding form controls needs `grid-cols-1` and `[&>*]:min-w-0` below its
  breakpoint (`responsive-grid-tracks.test.ts`), or iOS sizes the track from the
  control and it overflows.

## Parts

| Part | Where | Notes |
|---|---|---|
| `Button`, `buttonVariants` | `ui/button.tsx` | default (lime, the main action), outline, secondary, ghost, destructive, link. 44px on touch. A working button keeps its label and width and shows a spinner. |
| `choiceVariants({ on })` | `ui/choice.ts` | every row of choices (filters, views, tabs on a page): the chosen one has a green-ink edge on the tint and `aria-pressed`. |
| `.link` | `globals.css` | every text link: green ink, 1px underline, 2px on hover. Use `[&_a]:link` for links inside prose you don't render. |
| `StatusBadge`, `ToneBadge` | `ui/badge.tsx` | a muted chip with a coloured square; DOL's status words as DOL prints them. |
| `Input`, `Textarea`, `Switch`, `Checkbox` | `ui/` | 1px `--input` outline, 16px text at every width (iOS zooms below that). |
| `Dialog`, `Popover`, `DropdownMenu`, `Tooltip` | `ui/` | the only things with a shadow; they fade in 120 to 150ms. |
| `Skeleton`, `.skeleton-pulse` | `ui/skeleton.tsx`, `globals.css` | each page's own loading shape at measured heights, with a quiet sweep. |
| `FinePrint`, `MoreText`, `PageBasics` | `components/data/` | folded detail: a native `<details>`, so the words stay in the page for search and the palette. |
| `IndexHeader`, `ProfileHeader`, `Chapter`, `ChapterNav` | `components/data/`, `components/entities/` | the top of list pages and of employer, firm and occupation pages. |
| `CaseLookupForm`, `CaseNextStep` | `components/tools/` | the case-number box (a plain GET form, works without scripts) and the one next step for someone waiting on a case. |
| `DidYouMean`, `NameGroups` | `components/search/` | "did you mean" for any empty search; the pages a name can mean, beside its filings. |
| `ChartTips`, `DateRuler` | `components/data/`, `components/tools/` | every chart's hover and tap readout; a deadline drawn as a ruler. |
| `PageHeading`, `AppBreadcrumb`, `SettingsCard` | `app/(authenticated)/components/`, `components/settings/` | the signed-in app's title block, trail and settings sections. |

Month names and date labels come from one module, `convex/lib/months.ts`
(`MONTH_NAMES`, `MONTH_ABBR`, `longDate`, `shortDate`, `monthYear`), plain string
work so the server and every browser print the same day
(`one-month-list.test.ts`).

## Tables and charts

- **Tables:** sentence-case heads, 44 to 48px rows with 1px rules and no zebra,
  numbers right-aligned in tabular mono. On a phone a table becomes a list of short
  cards (the case browsers: number and status, then who, then when), CSS only where
  the rows can be restacked, so they exist once.
- **Charts:** a sentence-case title, at most four horizontal gridlines, one highlight
  colour for the reader's own thing (their case, DOL's current month), status and
  stage colours only where they mean something, a readout on hover, focus and tap
  (`ChartTips`). SVG `<text>` carries a trailing space so labels don't glue.
- **Every figure carries its date** and names its source (`DataProvenance`).

## Motion

Nothing animates on load or on scroll. What moves, and why:

| What | How | Why |
|---|---|---|
| Hover, press | colour or underline, 150ms | says the thing can be pressed |
| Menus, dialogs, popovers | fade, 120 to 150ms | shows where a new layer came from |
| Folds | the browser's own `<details>` | shows what opened |
| Loading skeleton | a faint band, 2.8s cycle, starting after 0.4s | a fast load never sweeps; a slow one doesn't look frozen |
| Spinner | inside a working button | the button keeps its label and width |

`MotionConfig reducedMotion="user"` wraps the site (`shared-providers.tsx`); under
reduced motion the sweep stops and the skeleton keeps its still ground. The gate
fails on `whileInView`, `whileHover`, `whileTap`, hover lifts, `transition-all`,
`animate-bounce/ping/pulse` and any looping animation but the sweep and the spinner.

## Words

Sentence case; sentences of 20 words or fewer; buttons start with a verb and run to
four words at most ("Check", "Email me changes", "Add case"). One term per thing:
case number, case alert, follow, queue alert, estimated decision; "wage request" in
public, "PWD" in the app. Numbers with separators; "October 27, 2026" in sentences and
"Oct 27" in tables. An empty state is a title, one sentence and one action. An error
sits under its field, with a summary at the top of the form.

## The gates

| Test | Holds |
|---|---|
| `src/app/__tests__/calm-system.test.ts` | no hard shadows, no hover movement, no `transition-all`, no black-weight headings, no all-caps, no self-running Motion props, reduced motion on, no loops but two, no textures, square corners, no wide tracking or black borders, one hatch, token contrast in both themes |
| `no-glued-jsx-text.test.ts`, `scripts/audit_glued_text.py` | words that render without a space between them (the rendered audit is the authority) |
| `responsive-grid-tracks.test.ts`, `form-controls-min-width.test.ts` | form grids that overflow on iOS |
| `one-month-list.test.ts` | one list of month names |
| `scroll-targets.test.ts` | every place the assistant can scroll to exists |

## Storybook

`pnpm storybook` (:6006). Every UI part has stories in light and dark; the app's real
pages are drawn from a recorded sample firm under "Tour/App pages"
(`src/components/tour/`). Theme is a class on `<html>`; a capture of the dark theme
has to set it.
