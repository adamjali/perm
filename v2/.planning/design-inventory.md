# Design inventory

Machine counts over `src/**/*.ts(x)`, generated 2026-08-26. Excludes `__tests__`,
`*.stories.tsx`, and (except where stated) `src/emails/**`, which cannot use CSS
custom properties at all because email clients do not support them.

Scanned: **579 app files**, 23 email files.


## Arbitrary type sizes

Every one of these is a size that exists outside the scale.

24 distinct, 116 occurrences.

| value | count |
|---|---:|
| `10px` | 33 |
| `11px` | 16 |
| `13px` | 14 |
| `0.625rem` | 11 |
| `14px` | 10 |
| `9px` | 5 |
| `15px` | 4 |
| `0.72rem` | 3 |
| `0.68rem` | 3 |
| `0.85rem` | 2 |
| `0.65rem` | 2 |
| `12rem` | 1 |
| `16rem` | 1 |
| `2.5rem` | 1 |
| `3rem` | 1 |
| `22px` | 1 |
| `2rem` | 1 |
| `3.25rem` | 1 |
| `0.66rem` | 1 |
| `0.62rem` | 1 |
| `0.5rem` | 1 |
| `0.6rem` | 1 |
| `1.35rem` | 1 |
| `0.7rem` | 1 |

## Tailwind type scale

`text-xs` is 12px. The house floor for labels is 14px (`text-sm`).

10 distinct, 1738 occurrences.

| value | count |
|---|---:|
| `sm` | 567 |
| `xs` | 456 |
| `base` | 211 |
| `lg` | 175 |
| `2xl` | 138 |
| `3xl` | 56 |
| `4xl` | 56 |
| `xl` | 51 |
| `5xl` | 27 |
| `6xl` | 1 |

## Raw hex literals (app only)

Target: zero in TSX except a data-viz palette defined once.

106 distinct, 646 occurrences.

| value | count |
|---|---:|
| `#2ECC40` | 94 |
| `#1a1a1a` | 53 |
| `#DC2626` | 38 |
| `#0066FF` | 27 |
| `#000` | 25 |
| `#F5F5F5` | 25 |
| `#9333ea` | 23 |
| `#FBBF24` | 22 |
| `#ffffff` | 21 |
| `#059669` | 19 |
| `#404040` | 16 |
| `#D97706` | 15 |
| `#fff` | 12 |
| `#6B7280` | 12 |
| `#1c1917` | 11 |
| `#fafafa` | 11 |
| `#333` | 10 |
| `#0a0a0a` | 9 |
| `#000000` | 9 |
| `#FAFAFA` | 9 |
| `#e5e5e5` | 8 |
| `#EA580C` | 7 |
| `#84cc16` | 6 |
| `#FACC15` | 6 |
| `#2a2a2a` | 6 |
| `#dc2626` | 6 |
| `#666` | 5 |
| `#228B22` | 5 |
| `#f5f5f5` | 5 |
| `#F5E6C8` | 5 |
| `#ef4444` | 4 |
| `#ea580c` | 4 |
| `#16a34a` | 4 |
| `#E8FFE8` | 4 |
| `#22c55e` | 3 |
| `#FF5F57` | 3 |
| `#FFBD2E` | 3 |
| `#28CA41` | 3 |
| `#1A1A1A` | 3 |
| `#0066ff` | 3 |
| _(+66 more)_ | |

`src/emails/**` separately holds 343 hex literals across 53 distinct values. **Out of scope**: email clients do not support CSS custom properties, so tokens cannot reach them.


## Border widths

7 distinct, 937 occurrences.

| value | count |
|---|---:|
| `2` | 759 |
| `4` | 63 |
| `3` | 40 |
| `0` | 40 |
| `[3px]` | 32 |
| `8` | 2 |
| `[2px]` | 1 |

Plus **191** bare `border` (1px) uses.


## Radii

`--radius` is 0px, so `rounded-sm|md|lg` already compute to 0. `rounded-xl`/`2xl`/`3xl`/`full` and arbitrary values are real radii.

5 distinct, 230 occurrences.

| value | count |
|---|---:|
| `None` | 218 |
| `lg` | 7 |
| `[4px]` | 3 |
| `[inherit]` | 1 |
| `sm` | 1 |

## Shadows

House scale is `shadow-hard-sm` / `shadow-hard` / `shadow-hard-lg` only.

24 distinct, 571 occurrences.

| value | count |
|---|---:|
| `hard-sm` | 230 |
| `hard` | 211 |
| `hard-lg` | 58 |
| `none` | 37 |
| `[2px_2px_0px_rgba(255,255,255,0.3)]` | 4 |
| `sm` | 4 |
| `xl` | 4 |
| `[4px_4px_0px_rgba(255,255,255,0.3)]` | 3 |
| `[4px_4px_0_hsl(var(--border))]` | 2 |
| `[6px_6px_0_hsl(var(--border))]` | 2 |
| `[2px_2px_0px_#000]` | 2 |
| `[4px_4px_0_rgba(255,255,255,0.2)]` | 2 |
| `md` | 1 |
| `lg` | 1 |
| `[4px_4px_0px_#000]` | 1 |
| `[2px_2px_0_hsl(var(--border))]` | 1 |
| `[3px_3px_0px_0px_rgba(0,0,0,0.1)]` | 1 |
| `[3px_3px_0px_0px_rgba(255,255,255,0.05)]` | 1 |
| `[4px_4px_0px_0px_rgba(0,0,0,0.15)]` | 1 |
| `[4px_4px_0px_0px_rgba(255,255,255,0.05)]` | 1 |
| `[2px_2px_0px_0px_rgba(0,0,0,0.15)]` | 1 |
| `[4px_4px_0_var(--foreground)]` | 1 |
| `[2px_2px_0_var(--border)]` | 1 |
| `[3px_3px_0_var(--border)]` | 1 |

## Gap scale

14 distinct, 875 occurrences.

| value | count |
|---|---:|
| `2` | 327 |
| `3` | 178 |
| `4` | 148 |
| `1.5` | 97 |
| `1` | 64 |
| `6` | 32 |
| `8` | 12 |
| `0` | 4 |
| `5` | 3 |
| `10` | 3 |
| `12` | 3 |
| `2.5` | 2 |
| `9` | 1 |
| `20` | 1 |

## Padding scale

99 distinct, 2023 occurrences.

| value | count |
|---|---:|
| `px-3` | 198 |
| `p-6` | 163 |
| `px-4` | 156 |
| `py-2` | 139 |
| `p-4` | 114 |
| `px-2` | 94 |
| `py-3` | 89 |
| `p-8` | 86 |
| `p-3` | 85 |
| `px-6` | 60 |
| `py-0.5` | 57 |
| `px-8` | 56 |
| `py-1` | 45 |
| `py-2.5` | 41 |
| `py-1.5` | 33 |
| `p-5` | 31 |
| `pt-4` | 28 |
| `px-1.5` | 27 |
| `py-16` | 25 |
| `py-4` | 24 |
| `pb-12` | 23 |
| `pt-12` | 22 |
| `py-8` | 22 |
| `pt-2` | 21 |
| `pb-16` | 21 |
| `pt-10` | 21 |
| `pl-4` | 18 |
| `p-0` | 18 |
| `py-12` | 18 |
| `px-5` | 17 |
| _(+69 more)_ | |

## Transition/animation durations (class)

House scale: 150 / 300 / 500ms.

5 distinct, 196 occurrences.

| value | count |
|---|---:|
| `150` | 129 |
| `200` | 37 |
| `300` | 16 |
| `500` | 13 |
| `100` | 1 |

## z-index

13 distinct, 110 occurrences.

| value | count |
|---|---:|
| `10` | 44 |
| `50` | 27 |
| `20` | 9 |
| `30` | 8 |
| `[60]` | 7 |
| `40` | 3 |
| `[100]` | 3 |
| `0` | 2 |
| `[9999]` | 2 |
| `[45]` | 2 |
| `[61]` | 1 |
| `[2]` | 1 |
| `100` | 1 |

## Font weights

`font-light` is banned by the readability rule.

6 distinct, 1158 occurrences.

| value | count |
|---|---:|
| `bold` | 623 |
| `black` | 197 |
| `medium` | 162 |
| `semibold` | 158 |
| `normal` | 12 |
| `extrabold` | 6 |

## Animation utilities

9 distinct, 121 occurrences.

| value | count |
|---|---:|
| `spin` | 46 |
| `in` | 37 |
| `fade-in` | 12 |
| `out` | 10 |
| `slide-up` | 8 |
| `pulse` | 3 |
| `shake` | 2 |
| `shimmer` | 2 |
| `blink` | 1 |

---

## Counts to beat

| axis | now |
|---|---:|
| arbitrary `text-[Npx]` | 116 |
| `text-xs` (12px) | 456 |
| raw hexes in app TSX | 646 |
| distinct hex values | 106 |
| non-house shadows | 72 |
| real (non-zero) radii | 4 |
| `font-light` | 0 |
| distinct durations | 5 |
| distinct z-indexes | 13 |


---

# Where the hexes actually come from

A flat count of 646 is not actionable, because four populations are mixed into
it and only one of them can be tokenised at all.

| population | n | what to do |
|---|---:|---|
| component code | 331 | **the target** |
| inline SVG artwork | 269 | illustrations with their own internal palettes; batch (f), by judgement |
| Satori OG renderers | 28 | **must stay raw** — `ImageResponse` does not resolve CSS custom properties |
| `Preloader.tsx` | 18 | owned by the lead |

Within the 331 in component code:

| | n |
|---|---:|
| the hex IS an existing token's value | **183** |
| not any token's value | 148 |

The 183 are mechanical: the value is already registered, the code just spells it
out instead of referencing it.

| hex | n | already registered as |
|---|---:|---|
| `#1A1A1A` | 36 | `--card` / `--muted` / `--popover` / `--secondary` (dark) |
| `#DC2626` | 23 | `--urgency-urgent` |
| `#0066FF` | 19 | `--stage-pwd` |
| `#9333EA` | 17 | `--stage-recruitment` |
| `#059669` | 13 | `--stage-i140` / `--urgency-completed` |
| `#FAFAFA` | 12 | `--background` / `--card` (light) |
| `#2ECC40` | 12 | `--primary` |
| `#EA580C` | 11 | `--urgency-soon` |
| `#6B7280` | 11 | `--stage-closed` |
| `#D97706` | 7 | `--stage-eta9089` |
| `#F5F5F5` | 6 | `--muted` / `--secondary` (light) |
| `#2A2A2A` | 6 | `--accent` (dark) |

## Two corrections to the brief

**`#0066FF` and `#9333EA` are not off-palette.** They are exactly `--stage-pwd`
and `--stage-recruitment`, already registered in `@theme`. Nothing needs
registering; the usages just need to reference the token. Same story for
`#DC2626`, which is `--urgency-urgent` — note it is NOT the destructive family,
`--destructive` is `#FF4747`.

**`#000001` is not a typo.** All 31 occurrences are in `src/emails/**`, used
consistently as `border: "3px solid #000001"`. Email templates already carry
deliberate client accommodations (table layouts "because flex is unsupported in
Outlook"), and this is the same class of workaround. It is undocumented, which
is worth one comment, but it is not a stray keystroke and it is out of
tokenisation scope regardless: email clients do not support custom properties.

## One file carries a quarter of the target

`components/calendar/CalendarView.tsx` holds **89** of the 331. It is
react-big-calendar theming through inline style objects, so it is one file with
high leverage rather than a scatter.

---

# What the counts say about the open questions

**Border width: 2px is the standard, 3px is emphasis.** `border-2` is 759 uses
against 40 `border-3` plus 32 `border-[3px]`. Two weights that should not exist:
`border-4` (63) and bare 1px `border` (191).

**Shadows are already close to house.** 499 of 571 are `shadow-hard-sm|hard|hard-lg`.
The 72 others are the work.

**Radii are nearly done.** Only 4 real (non-zero) radii in the whole app; the
rest resolve to 0 through `--radius`.

**`font-light` does not appear at all.** That rule is already satisfied.

**Type is the biggest single axis:** 456 `text-xs` (12px, under the 14px label
floor) plus 116 arbitrary `text-[Npx]` across 24 distinct sizes, of which
`10px` (33) and `11px` (16) are the worst.
