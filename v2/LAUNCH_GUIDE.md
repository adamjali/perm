# Product Hunt Launch Guide

## Interactive Demo (Supademo)

- **Link:** https://app.supademo.com/demo/cmli1lvlg1lkg5351b6olnd9n
- **Embed URL:** https://app.supademo.com/embed/cmli1lvlg1lkg5351b6olnd9n?embed_v=2
- **Steps:** 50
- **Also embedded on:** /demo page (between hero and screenshots)

---

## Media Assets (upload in this order)

### Gallery Image #1 — Dashboard
- **File:** `/Users/dev/cc/perm-tracker/v2/public/images/screenshots/dashboard.png`
- **Alt text:** PERM Tracker dashboard showing case summary tiles with deadline urgency columns
- **Caption:** The dashboard gives you a bird's-eye view of every case — organized by stage with deadline urgency at a glance.

### Gallery Image #2 — Create Case Video
- **File:** `/Users/dev/cc/perm-tracker/v2/public/images/screenshots/create-case.mp4`
- **Alt text:** Creating a new PERM case with automatic deadline calculation
- **Caption:** Create a case in seconds — deadlines, recruitment steps, and filing windows are calculated automatically per DOL regulations.

### Gallery Image #3 — Cases Grid
- **File:** `/Users/dev/cc/perm-tracker/v2/public/images/screenshots/cases.png`
- **Alt text:** Case management grid showing PERM cases with status badges and progress tracking
- **Caption:** Manage all your cases in one place with real-time status tracking, filtering, and search.

### Gallery Image #4 — Calendar
- **File:** `/Users/dev/cc/perm-tracker/v2/public/images/screenshots/calendar.png`
- **Alt text:** Calendar view showing PERM deadlines and filing windows
- **Caption:** Never miss a deadline — the calendar view highlights every critical date across all your cases.

### Gallery Image #5 — AI Chat
- **File:** `/Users/dev/cc/perm-tracker/v2/public/images/screenshots/chat-walkthrough.mp4`
- **Alt text:** AI chat assistant answering PERM process questions
- **Caption:** Ask the AI assistant anything about the PERM process — deadlines, regulations, next steps.

### Alternate Options (swap in if needed)

| File | Alt Text | Caption |
|------|----------|---------|
| `/Users/dev/cc/perm-tracker/v2/public/images/screenshots/cases-walkthrough.mp4` | Cases page walkthrough showing filtering and case details | Browse, filter, and drill into any case with one click. |
| `/Users/dev/cc/perm-tracker/v2/public/images/screenshots/settings-walkthrough.mp4` | Settings page with notification preferences | Configure email and push notifications so you never miss a deadline. |
| `/Users/dev/cc/perm-tracker/v2/public/images/screenshots/case-summary.png` | Case summary with stage-by-stage breakdown | Every case shows exactly where you are in the PERM process. |

### Logo / Branding

| Purpose | File |
|---------|------|
| App icon / logo | `/Users/dev/cc/perm-tracker/v2/public/icon-512.png` |
| OG / social image | `/Users/dev/cc/perm-tracker/v2/public/og-image.png` |

---

## Product Hunt Details

- **Name:** PERM Tracker
- **Tagline:** Free PERM case tracking for immigration attorneys
- **URL:** https://permtracker.app
- **Topics:** Legal Tech, Productivity, SaaS, Immigration

### Short Description
Free case management software for immigration attorneys. Track deadlines, manage labor certification cases, and never miss a DOL filing date.

### Long Description
PERM Tracker helps immigration attorneys manage labor certification cases with automatic deadline calculation per DOL regulations, real-time case validation, email and push notifications, progress timeline tracking, and a calendar view. Built specifically for PERM (Program Electronic Review Management) cases, it handles the complex ETA-9089 process including PWD determinations, recruitment deadlines, and I-140 filing windows. Completely free, no credit card required.

---

## First Maker Comment

Hey everyone! Maker here.

I built PERM Tracker because I saw how broken the process is for immigration attorneys managing labor certification cases.

The PERM process (Program Electronic Review Management) is how employers sponsor workers for green cards through the Department of Labor. It involves dozens of interconnected deadlines — PWD determinations expire after 1 year, recruitment ads have strict timing windows, the ETA-9089 filing has a 180-day constraint, and missing any single deadline can set an entire case back months or even force you to restart.

Most attorneys track all of this in spreadsheets. Some use generic case management tools that don't understand immigration law. I watched attorneys manually calculate deadlines, cross-reference DOL regulations, and still miss critical dates because the rules are genuinely complex — business day calculations, federal holiday exclusions, cascading dependencies between steps.

So I built something that does all of that automatically. You enter a case, and PERM Tracker calculates every downstream deadline per the actual regulations (20 CFR 656). Change one date, and all dependent deadlines cascade automatically. It validates your case against DOL requirements in real-time and sends email + push notifications before anything expires.

The approach evolved a lot during development. I started with just deadline calculation, but quickly realized attorneys needed the full picture — a dashboard showing case urgency at a glance, a calendar view for deadline planning, progress tracking through each PERM stage, and an AI assistant that actually understands the process.

It's completely free. No trial, no credit card, no catch. Immigration attorneys do important work helping people build lives in this country — they shouldn't have to fight their tools to do it.

Would love your feedback. What would make this more useful for your workflow?

---

## Directory Submission Checklist

### Week 1 — High Priority
- [ ] **Product Hunt** — producthunt.com (free, schedule launch day)
- [ ] **BetaList** — betalist.com ($129 priority recommended)
- [ ] **MicroLaunch** — microlaunch.net (free)
- [ ] **G2** — g2.com (free listing)

### Week 2 — Community
- [ ] **Indie Hackers** — indiehackers.com (free)
- [ ] **Crunchbase** — crunchbase.com (free)
- [ ] **SaaSHub** — saashub.com (free)

### Week 3 — Long Tail
- [ ] **AlternativeTo** — alternativeto.net (free)
- [ ] **Awesome Indie** — awesomeindie.com (free)
- [ ] **Uneed** — uneed.best (free)

### Post-Launch GSC Tasks
- [ ] Validate fixes in Google Search Console (404s, redirects)
- [ ] Request indexing for /contact, /login, /signup, /demo
