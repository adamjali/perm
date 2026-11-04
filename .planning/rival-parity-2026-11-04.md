# Rival parity, Nov 4 2026

Owner, Wed Nov 4 2026, 10:12 AM EST: "yes on compare changes also make sure if anyone doing anything we're not
and we can let's do it plz", "yes for image discover", "fix the backlog and approval rate too", and asked why our
H-1B LCA history doesn't reach 2008. Source of the gap list: the read-only /compare audit of Nov 4 (session
scratchpad `compare-audit.md`, from `~/.claude/explanations/20261103_compare_recheck/raw/`).

Each item is ticked when it's built, tested and pushed; the night run ships the site.

## Approved, building now

- [ ] **LCA history FY2008 to FY2019.** DOL publishes one file a year (six names, read off its performance page
  Nov 4); we never loaded them because their columns are named differently. Discovery done (db47d8bf). Next: real
  headers from each file (GitHub runner, `dump_header`), column alternates per era, a dry run per file, then the
  loads one file per run at the history pace, then every LCA summary rebuilt and copy that says "FY2020 on" moved.
- [ ] **/compare**: per-picture capture dates; stale alt text (PERM Timeline's 336 days, Immigration Road's
  bulletin buttons); bulletin note ("every bulletin since October 2014, most back to 2005"); GreenCardClock's edge
  is applicants' own interview reports; languages listed the same way for every site; the 5-minute check with its
  hours; the operator line without "(Florida)" reading as a bar license; H1BGrader dated Oct 28; PERM Timeline's
  page counts; the freshness bar measured. New rows where a rival leads or ties: USCIS receipt status, a phone or
  installable app, push alerts, visa bulletin alerts, community data, languages, LCA history depth. Our live
  features claimed where true.
- [ ] **Discover images**: articles share their header photo (a 16:9 crop) as og:image, and the Article's
  structured data lists 16:9, 4:3 and 1:1 versions; the text title card goes.
- [ ] **"Backlog" in our words** where people say it (titles, headings, the homepage figure), and **a plain, dated
  approval-rate sentence** from DOL's own files (count, window, withdrawals included), beside our own check's
  newest month.

## Rival features we can build (the "if anyone's doing it and we can" list)

- [ ] Browser push when a visa bulletin moves (GreenCardClock has it; ours pushes DOL case changes only).
- [ ] An H-1B job-change check: what moves with you and what restarts (GreenCardClock's "transfer risk").
- [ ] An H-4 EAD timing tool (H1BGrader).
- [ ] A list of O*NET Bright Outlook jobs with their PERM and LCA counts (H1BGrader).
- [ ] An "install as an app" prompt for the public site (GreenCardClock's "add to home screen").
- [ ] Print or save a plan as PDF (GreenCardClock's paid PDF export).
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
