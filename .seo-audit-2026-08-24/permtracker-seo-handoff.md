# permtracker.app — SEO metadata fixes (audited 2026-08-24)

Context you don't have: I audited all 31 URLs in permtracker.app's sitemap against Google's
published limits. The site is in good shape overall — no duplicate titles, descriptions or
canonicals, brand in every title, `/login` correctly noindexed, WebSite schema and og:site_name
consistent, sitemap and robots clean. Two classes of defect are worth fixing.

**Every file in section A is currently modified in your working tree** (`git status` shows them
as `M`). I deliberately did not touch them — an earlier session of mine edited that repo and the
work was reverted mid-task, so this is a handoff rather than a patch. Please fold these into
whatever you're already doing to those files.

---

## A. Meta descriptions over 155 characters

Google truncates around 155 characters, mid-sentence. These lose the tail shown after the cut.
Rewrite to **≤155** while keeping the meaning — most just need the last clause tightened or
dropped, and several of these are genuinely good sentences that only need trimming.


### `https://permtracker.app/tools/perm-deadline-calculator` — 208 chars **(modified in your tree)**
`src/app/(public)/tools/perm-deadline-calculator/page.tsx`

```
Work out every PERM deadline from the prevailing wage determination date: recruitment window, notice of filing, quiet period and the ETA-9089 filing window. Exact arithmetic under 20 CFR 656, not an estimate.
```
Cut at 155 → loses: `…. Exact arithmetic under 20 CFR 656, not an estimate.`


### `https://permtracker.app/tools/green-card-timeline` — 201 chars **(modified in your tree)**
`src/app/(public)/tools/green-card-timeline/page.tsx`

```
Every stage of an employment-based green card, drawn to scale from published DOL and USCIS figures: the prevailing wage queue, recruitment, the PERM decision, the I-140, and the wait for a visa number.
```
Cut at 155 → loses: `…on, the I-140, and the wait for a visa number.`


### `https://permtracker.app/tools/pwd-calculator` — 187 chars **(modified in your tree)**
`src/app/(public)/tools/pwd-calculator/page.tsx`

```
See exactly how many prevailing wage requests are ahead of yours in DOL's queue, from DOL's own published backlog. The first step of a PERM, and the one that sets every deadline after it.
```
Cut at 155 → loses: `…at sets every deadline after it.`


### `https://permtracker.app/tools/i140-calculator` — 178 chars **(modified in your tree)**
`src/app/(public)/tools/i140-calculator/page.tsx`

```
How many I-140 petitions are waiting in your category, how fast USCIS is clearing them, and how that compares to the processing time USCIS publishes. All figures are USCIS's own.
```
Cut at 155 → loses: `…igures are USCIS's own.`


### `https://permtracker.app/tools` — 168 chars **(modified in your tree)**
`src/app/(public)/tools/page.tsx`

```
Free PERM calculators built on the Department of Labor's own published data: decision-time estimates, the prevailing wage queue, and every statutory deadline in a case.
```
Cut at 155 → loses: `…ne in a case.`


### `https://permtracker.app/tools/perm-timeline-calculator` — 165 chars **(modified in your tree)**
`src/app/(public)/tools/perm-timeline-calculator/page.tsx`

```
Estimate when the Department of Labor will decide your PERM case. Every figure comes from DOL's own published queue data and disclosure files, with its source shown.
```
Cut at 155 → loses: `…rce shown.`


### `https://permtracker.app/tutorials/tracking-perm-deadlines` — 160 chars
`content/tutorials/tracking-perm-deadlines.mdx`

```
Learn how to use PERM Tracker's automated deadline engine to stay on top of every critical date in your PERM cases, from PWD expiration to I-140 filing windows.
```
Cut at 155 → loses: `…dows.`


### `https://permtracker.app/perm-processing-times` — 159 chars **(modified in your tree)**
`src/app/(public)/perm-processing-times/page.tsx`

```
Where DOL's PERM queue actually stands, from the Department's own published figures with the date they carry. Analyst review, audit review and prevailing wage.
```
Cut at 155 → loses: `…age.`


### `https://permtracker.app/faq` — 157 chars
`src/app/(public)/faq/page.tsx`

```
Answers to common questions about PERM labor certification, the PERM Tracker platform, deadlines, recruitment, and case management for immigration attorneys.
```
Cut at 155 → loses: `…s.`


### `https://permtracker.app/tutorials/recruitment-tracking` — 157 chars
`content/tutorials/recruitment-tracking.mdx`

```
A detailed walkthrough of how to track PERM recruitment activities, manage checklists, and ensure compliance using PERM Tracker's built-in recruitment tools.
```
Cut at 155 → loses: `…s.`


### `https://permtracker.app/guides/ultimate-perm-guide-2026` — 156 chars
`content/guides/ultimate-perm-guide-2026.mdx`

```
A comprehensive strategic guide to PERM labor certification: timeline optimization, audit avoidance, regulatory deep-dives, and expert tips for every stage.
```
Cut at 155 → loses: `….`


---

## B. Titles over 60 characters

`src/app/layout.tsx:48` sets `template: "%s | PERM Tracker"`, which adds 15 characters to every
page title. Where the page's own title is already long, the brand gets truncated in the SERP.

Lower priority than section A — a cut brand suffix is cosmetic, a cut sentence is not. Two ways
to fix, your call:
1. shorten the individual page titles below (all live in clean `content/*.mdx` frontmatter), or
2. leave them; Google often rewrites long titles anyway.

- **68** `https://permtracker.app/blog/what-is-perm-labor-certification` — `content/blog/what-is-perm-labor-certification.mdx`
  `What is PERM Labor Certification? A Complete Overview | PERM Tracker`
- **66** `https://permtracker.app/tutorials/getting-started` — `content/tutorials/getting-started.mdx`
  `Getting Started with PERM Tracker: A Complete Guide | PERM Tracker`
- **65** `https://permtracker.app/blog/best-immigration-case-management-tools` — `content/blog/best-immigration-case-management-tools.mdx`
  `Best Tools for Immigration Case Management in 2026 | PERM Tracker`
- **65** `https://permtracker.app/blog/common-perm-audit-triggers` — `content/blog/common-perm-audit-triggers.mdx`
  `5 Common PERM Audit Triggers and How to Avoid Them | PERM Tracker`
- **63** `https://permtracker.app/tools/pwd-calculator` — `src/app/(public)/tools/pwd-calculator/page.tsx`
  `Prevailing Wage (PWD) Processing Time Calculator | PERM Tracker`
- **62** `https://permtracker.app/resources/manual-vs-automated-tracking` — `content/resources/manual-vs-automated-tracking.mdx`
  `Manual vs Automated PERM Tracking: A Comparison | PERM Tracker`
- **62** `https://permtracker.app/tutorials/recruitment-tracking` — `content/tutorials/recruitment-tracking.mdx`
  `Setting Up Recruitment Tracking in PERM Tracker | PERM Tracker`
- **62** `https://permtracker.app/tutorials/tracking-perm-deadlines` — `content/tutorials/tracking-perm-deadlines.mdx`
  `How to Track PERM Deadlines Without Missing One | PERM Tracker`

---

## Verify

```bash
curl -s https://permtracker.app/sitemap.xml | grep -o "<loc>[^<]*</loc>" | sed 's/<[^>]*>//g' \
| while read u; do
    printf "%-62s " "$u"
    curl -s "$u" | python3 -c "
import sys,re,html
t=sys.stdin.read()
d=re.search(r'<meta name=\"description\" content=\"((?:[^\"\\\\]|\\\\.)*)\"',t)
ti=re.search(r'<title>(.*?)</title>',t,re.S)
print('T',len(html.unescape(ti.group(1))) if ti else 0,' D',len(html.unescape(d.group(1))) if d else 0)"
  done
```

Target: every title ≤60, every description ≤155. `/login` and any other `noindex` page can be
ignored.

## Not a defect — checked and fine

Duplicate titles/descriptions/canonicals (none), missing meta (none), `WebSite` schema name vs
`og:site_name` (consistent), robots.txt and sitemap (clean), AI crawlers (all allowed),
Googlebot fetch (200). The `content/*.mdx` frontmatter is well written; only length is at issue.
