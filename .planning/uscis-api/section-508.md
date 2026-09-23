# Section 508 self-attestation notes for the USCIS receipt lookup

Drafted Tue Sep 22 2026, 8:35 PM EDT. Section 508 requires ICT that federal
agencies procure or that interoperates with federal systems to conform to
WCAG 2.0 Level AA (the 2017 refresh adopts WCAG 2.0 AA by reference). The
portal asks developers to attest conformance. This file records, criterion by
criterion, what the lookup page does, and what has NOT been verified, so the
attestation Adam signs claims only what is true.

Scope: `/uscis-case-status` and its result panel and form, plus the shared
site chrome those pages inherit (header, footer, rail), which has its own
history of measured fixes (44px targets, header height variables, the footer
accordion's keyboard behaviour).

## Practices in the page, by WCAG 2.0 AA criterion

| Criterion | Status | Where |
|---|---|---|
| 1.1.1 Non-text content | Supports | The only icon is decorative (`aria-hidden`); no images. |
| 1.3.1 Info and relationships | Supports | One `<h1>`; `<h2>` sections; the decoded fields and the result are `<dl>`; the history is `<ol>`; the form control has a `<label for>`. |
| 1.3.2 Meaningful sequence | Supports | Source order is reading order; no CSS reordering. |
| 1.4.1 Use of colour | Supports | Every warning carries an icon and bold text; states are named in words ("stored copy", "pending"). |
| 1.4.3 Contrast (minimum) | Supports, by token | All text uses the site's measured tokens (`text-foreground`, `text-muted-foreground`, the `-ink` warn/bad variants), which the design pass measured at AA on every surface. Not re-measured on this page specifically. |
| 1.4.4 Resize text | Supports | Relative units; no fixed-height text containers. |
| 2.1.1 Keyboard | Supports | Native `<form>`, `<button>`, `<a>`, `<details>`; no custom widgets. |
| 2.1.2 No keyboard trap | Supports | Nothing captures focus. |
| 2.4.1 Bypass blocks | Supports, inherited | The site layout's skip link. |
| 2.4.2 Page titled | Supports | "USCIS Case Status by Receipt Number | PERM Tracker". |
| 2.4.3 Focus order | Supports | Source order. |
| 2.4.4 Link purpose | Supports | Every link names its destination ("USCIS's own status page", "Look up G-100-… at DOL"). |
| 2.4.6 Headings and labels | Supports | Skip-free outline h1 > h2 > h3; the input's label is visible text. |
| 2.4.7 Focus visible | Supports | `focus:ring-2` / `focus-visible:ring-2` on every control. |
| 3.1.1 Language of page | Supports, inherited | `<html lang="en">` in the root layout. |
| 3.2.1 On focus / 3.2.2 On input | Supports | Nothing submits or navigates on focus or on typing; the hint text changes only. |
| 3.3.1 Error identification | Supports | A malformed receipt is named in text next to the field (`aria-invalid`, `aria-describedby`), and again above the result area on submit. |
| 3.3.2 Labels or instructions | Supports | Label, example placeholder, and where to find the number. |
| 3.3.3 Error suggestion | Supports | The shape sentence says what a receipt looks like. |
| 4.1.1 Parsing | Supports | Valid HTML from React; no duplicate ids (`useId`). |
| 4.1.2 Name, role, value | Supports | Native elements throughout; the loading panel is `role="status" aria-live="polite"`. |
| 4.1.3 Status messages (2.1) | Supports | The loading and result states are announced. |

Motion: the only transition is the disclosure caret's rotate, wrapped in
`motion-reduce:transition-none`. No animation runs on its own.

Text size: nothing on the page is under 14px (`text-sm`); body copy is 16px.

Tap targets: every control is at least 44px tall (`min-h-[44px]` or
`min-h-[52px]`).

Themes: light and dark through the site's tokens; no colour is hardcoded in the
page.

JavaScript off: the form submits as a plain GET, the decode and the pending
panel render on the server, and the prefix dictionary is a native `<details>`.
Only the live result panel needs JavaScript, and it says so if the fetch fails.

## What has NOT been verified, and should be before signing

1. **A screen-reader pass** (VoiceOver on macOS is on this machine; NVDA is
   not). Read the page top to bottom, submit a receipt, and confirm the
   loading and result announcements are heard once each.
2. **An automated scan.** Run axe (the browser extension, or
   `npx @axe-core/cli`) against the page in both states. This is a five-minute
   job and it catches the class of thing nobody sees by reading.
3. **Contrast on this page's own surfaces.** The tokens are measured, but the
   `bg-tint-primary` panel and the `bg-data-warn/8` band should be sampled
   with the text they carry.
4. **Keyboard walk on a phone-width viewport** through the chrome-devtools
   MCP at 390px, which is where the header wraps and the rail becomes a drawer.

Until those four are done, the attestation should say "built to WCAG 2.0 AA
practices; automated and assistive-technology testing scheduled before
production access", which is true, rather than "conformant", which has not
been shown.

## The VPAT-style statement, if the portal wants one paragraph

PERM Tracker LLC attests that the USCIS receipt lookup at
permtracker.app/uscis-case-status is built to WCAG 2.0 Level AA practices as
required by Section 508: semantic HTML with a single H1 and a skip-free
heading outline, a labelled form control with visible focus and text error
messages, keyboard operability with native elements only, status messages
announced through live regions, no information conveyed by colour alone, a
14px text floor and 44px control floor, reduced-motion preferences honoured,
and full function with JavaScript disabled except the live status panel,
which states its failure in text. [Once done:] The page has been reviewed with
VoiceOver and scanned with axe with no outstanding findings.
