# The middle ground, round 2 (from Oct 15 2026, 6:15 PM EDT)

Adam, after seeing the redesign live: too plain, naked, text first. A step back toward the
original (busy) site: the middle between the two, with color, pictures and structure. Every
item below is his, from his messages of Oct 15 6:15 to 6:25 PM. The original is commit
c4a81299 (copies of its key files in the session scratchpad `old/`).

## Batch 1: the chrome
- [x] Header black again (he changed his mind), footer black.
- [x] The data side list back to the original: separated from the page by a line, the green
      current-page tab crossing that line, a gap between groups, each group's heading
      (icon, name, count) clearly the heading of the pages under it. Fixed in place while the
      page scrolls.
- [x] The board counts up on load (odometer for numbers, flip for the month), off under
      reduced motion, server-rendered at its final values.
- [x] The hover underline animation (`.hover-underline`) on nav links, headings that link,
      card titles and the like.
- [x] Sign-up's "This account is for people who file PERM cases" box: visual, not text.
- [x] Every search box and input gets gray placeholder text (an example, or "Search…").
- [x] Loading states and skeletons everywhere they belong, visible, done right.

## Batch 2: every public page, toward the middle
- [x] COLOR: the stage colors, lime, tints and colored bands where they carry meaning.
- [ ] IMAGES and media: the product's own screens, the real forms, charts, Sabrina's
      portrait, credited photos, the films; a picture of each page's answer up top.
- [x] Structure: sections framed, panels as objects (ink edge, hard shadow), clear
      separation between parts, nothing naked. Shared parts first (PageSection, IndexHeader,
      FigureRow, PageBasics, DataProvenance, Chapter), then every template, family by family.
- [ ] Go over any and all pages, light and dark, phone and desktop.

## Gates
- `calm-system.test.ts` enforces the calm look; each rule this round reverses is changed in
  the same commit as the markup, with the reason.
- Before each push: `pnpm check`, `pnpm exec vitest run src/app/__tests__`, glued text,
  phone sweep, axe on the changed templates.

## How it was done (Oct 15 2026, evening)
- Shared parts by hand: buttons, inputs, cards, choices and status chips (ink edges, hard
  shadows, colour fills, a 1px lift behind motion-safe); answer panels with an ink band and
  filled verdicts; chart frames with corner ticks; figure rows as compartments; section rules
  with a lime tab; scroll reveals below the fold (`AutoReveal`); back-to-top; reading bar.
- A reverse pass (`restore_classes.py`, session scratchpad) over 414 public files and 182 app
  files: where an element still exists, the original's structure comes back on top of today's
  classes. Never back: all-caps, wide tracking, rounded corners, pale lime, looping motion.
  A black panel comes back dark-scoped (`dark bg-[#141414]`), so its contents read unchanged.
- By hand: the attorney page's ink and paper bands, red and orange stakes cards, an ink
  security band, app windows on lime blocks; the sign-up pitch in ink; lifting tiles.
- `calm-system.test.ts` is now the middle-ground gate.

## Still open
- [ ] IMAGES: more pictures on data pages (each page's answer drawn up top).
- [ ] Go over every page in dark mode and at 390.
