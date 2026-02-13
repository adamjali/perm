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

## Shoutouts (copy-paste into Product Hunt)

### Supademo

**Alternatives considered:** Arcade, Storylane

**What made you choose Supademo over the alternatives?**

Supademo was the fastest path from "I want a demo" to "it's live." The Chrome extension captured our entire 50-step flow in one session, the editor let us polish step descriptions instantly, and the embed just worked — responsive, lazy-loaded, no performance hit. Arcade and Storylane felt heavier for what we needed. Supademo nailed the balance of simplicity and polish.

---

### Convex

**Alternatives considered:** Supabase, Firebase

**What made you choose Convex over the alternatives?**

Real-time reactivity out of the box was the dealbreaker. With Convex, when one attorney updates a case deadline, every connected client sees it instantly — no websocket plumbing, no polling, no cache invalidation. The schema-as-code approach with TypeScript end-to-end meant our PERM validation logic runs identically on client and server. Supabase and Firebase would have required stitching together subscriptions, edge functions, and type generation separately. Convex gave us all of that in one coherent system.

---

### React

**Alternatives considered:** Tailwind CSS, shadcn/ui

**What made you choose React over the alternatives?**

React 19 with Server Components let us build a content hub (blog, tutorials, guides) that renders MDX at build time for instant page loads, while the authenticated dashboard stays fully interactive with real-time Convex subscriptions. We paired it with Next.js App Router for file-based routing, shadcn/ui for our neobrutalist component library, and Tailwind for rapid styling. The ecosystem depth meant every problem we hit already had a battle-tested solution.

---

### Vercel

**Alternatives considered:** Cloudflare Pages, Netlify

**What made you choose Vercel over the alternatives?**

Vercel is the team behind Next.js, so the integration is zero-friction — push to main and the build just works. Their edge network made our static content pages load in under 200ms globally, while dynamic routes (dashboard, cases) use serverless functions that cold-start fast. We considered Cloudflare Pages for the edge compute, but Vercel's native Next.js support — automatic ISR, image optimization, preview deployments — saved us weeks of configuration. Netlify was close but the Next.js 16 support wasn't as seamless.

---

### Next.js

**Alternatives considered:** Remix, Astro

**What made you choose Next.js over the alternatives?**

Next.js 16 with App Router gave us the best of both worlds — static generation for our content hub (blog, tutorials, guides load instantly) and dynamic server rendering for the authenticated dashboard with real-time Convex subscriptions. The file-based routing, built-in image optimization, and metadata API meant we spent zero time on plumbing and all our time on the product. Remix was tempting for its data loading model, but Next.js's ecosystem (Vercel deployment, middleware, ISR) was unmatched. Astro would have been great for the content pages but couldn't handle the interactive app side.

---

### Resend (extra shoutouts help get featured)

**Alternatives considered:** SendGrid, Mailgun

**What made you choose Resend over the alternatives?**

Resend powers all our deadline notification emails. The React Email integration meant we could build beautiful, branded email templates using the same JSX components as our app. Deliverability has been flawless — every PWD expiration warning and filing deadline reminder lands in the inbox, not spam. The developer experience is leagues ahead of SendGrid or Mailgun.

---

### shadcn/ui (add this one too)

**Alternatives considered:** Radix UI, Chakra UI

**What made you choose shadcn/ui over the alternatives?**

shadcn/ui gave us a headless component foundation that we restyled into a full neobrutalist design system — hard shadows, zero border radius, forest green accents. Copy-paste components that we own and customize beats locked-in component libraries every time. The Radix primitives underneath handle accessibility perfectly, so our app works with screen readers and keyboard navigation out of the box.

---

### Tailwind CSS (add this one too)

**Alternatives considered:** Styled Components, CSS Modules

**What made you choose Tailwind CSS over the alternatives?**

Tailwind let us ship a complete neobrutalist design system without writing a single CSS file from scratch. Utility classes mean our components are self-documenting — you can read the styling inline. Dark mode was a one-line config change. The JIT compiler keeps our production CSS tiny despite using hundreds of custom utilities.

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
