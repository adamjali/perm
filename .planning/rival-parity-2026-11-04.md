# Rival parity, Nov 4 2026

Owner, Wed Nov 4 2026, 10:12 AM EST: "yes on compare changes also make sure if anyone doing anything we're not
and we can let's do it plz", "yes for image discover", "fix the backlog and approval rate too", and asked why our
H-1B LCA history doesn't reach 2008. Source of the gap list: the read-only /compare audit of Nov 4 (session
scratchpad `compare-audit.md`, from `~/.claude/explanations/20261103_compare_recheck/raw/`).

Each item is ticked when it's built, tested and pushed; the night run ships the site.

## Approved, building now

- [ ] **LCA history FY2008 to FY2019.** DOL publishes one file a year; we never loaded them because their columns
  are named differently. Discovery (db47d8bf), three layouts read (73210c39, 9c0bc38b, 49b506b0: e-file visa letters
  and units, FY2015's one-cell wage range, FY2019's numbered columns), every file dry-run clean on GitHub. They go to
  their own table, `lca_cases_history` (8ba1284f), so lca_cases and everything built from it stay as they were.
  Reads (dfcab888): the LCA lookup, the /lca-cases employer search, the yearly rankings, each employer's
  "H-1B LCAs year by year" (`lca_cases_years`). Loading since 12:19 PM, one file a run (FY2019 written 12:50 PM).
  Left: the copy that says "FY2020 on" (h1b-employers, llms.txt, /compare's LCA note) once every load is in; the
  all-programs case search and no-PERM employer pages don't read the history table yet.
- [x] **/compare** (4e9be7b7; card re-taken 5a47b184): per-picture capture dates; stale alt text (PERM Timeline's 336 days, Immigration Road's
  bulletin buttons); bulletin note ("every bulletin since October 2014, most back to 2005"); GreenCardClock's edge
  is applicants' own interview reports; languages listed the same way for every site; the 5-minute check with its
  hours; the operator line without "(Florida)" reading as a bar license; H1BGrader dated Oct 28; PERM Timeline's
  page counts; the freshness bar measured. New rows where a rival leads or ties: USCIS receipt status, a phone or
  installable app, push alerts, visa bulletin alerts, community data, languages, LCA history depth. Our live
  features claimed where true.
- [x] **Discover images** (4e9be7b7): articles share their header photo (a 16:9 crop) as og:image, and the Article's
  structured data lists 16:9, 4:3 and 1:1 versions; the text title card goes.
- [x] **"Backlog" in our words** (4e9be7b7; /perm-queue's card re-taken 5a47b184) where people say it (titles, headings, the homepage figure), and **a plain, dated
  approval-rate sentence** from DOL's own files (count, window, withdrawals included), beside our own check's
  newest month.

## Rival features we can build (the "if anyone's doing it and we can" list)

- [x] Browser push when a new visa bulletin is out, naming what it did to the reader's line (GreenCardClock's is one per bulletin). `convex/bulletinPushAlerts.ts`, its sweep, `/bulletin-alert/push`, `BulletinPushAlert` on every line page; the case button and this one share `BrowserPushAlert`. Needs the Convex deploy.
- [ ] An H-1B job-change check: what moves with you and what restarts (GreenCardClock's "transfer risk").
- [ ] An H-4 EAD timing tool (H1BGrader).
- [x] A list of O*NET Bright Outlook jobs with their PERM and LCA counts (H1BGrader): `/bright-outlook-jobs` (b995cbb4), 307 job codes with BLS's growth, PERM cases and H-1B LCAs.
- [x] Installing the site works for readers too: the app opens `/start` (the dashboard when signed in, the homepage otherwise; it had opened /dashboard for everyone), and the notification box tells an iPhone reader to add the site to the home screen first, which iOS needs before it delivers a notification.
- [x] Print or save as PDF on the green card planner and the deadline calculator (`PrintButton`; globals.css's print rules already open every fold).
- [ ] Visa bulletins before June 2005 and the 20 missing months, from the Internet Archive's copies of State's pages
  (Immigration Road reaches 2002).
- [ ] Consular interview reports from applicants, with no free text (GreenCardClock).

## Not built, and why

- USCIS receipt status: built and dark until USCIS grants API access (`.planning/llc-and-uscis-plan.md`).
- Store phone app, other languages (owner retired translations Oct 31 2026), named attorneys, a jobs board and video
  consultations (owner-declined), the civil surgeon export (USCIS's robots.txt bars it; we link USCIS's search).
- An AI-written summary in alert emails (ImmiLane): a model's summary can state a wrong date or status in mail
  that reads as ours; our alerts quote DOL's record and our measured estimate. Raise with the owner before building.
- A Telegram channel (PermTrack): an outward-facing account, the owner's to open.
