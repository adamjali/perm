# Taking a person's name off the site

A person can ask for their name to come off permtracker.app. The owner decides each request on its own; there's
no rule for any kind of employer. Here's the whole process. It names no one, and nothing about a request may ever go
into this repository, which is public.

## The legal position (as of Oct 17 2026; not legal advice)

The site shows the Department of Labor's own disclosure records. As read from the laws' own texts:

- **California (CCPA).** Cal. Civ. Code §1798.140(v)(2) excludes "publicly available information", which includes
  "Information that is lawfully made available from federal, state, or local government records." The act also
  reaches only a "business" over its thresholds (§1798.140(d)): more than $25 million a year in revenue
  (inflation-adjusted), buying, selling or sharing 100,000 or more people's personal information, or half its
  revenue from selling it. PERM Tracker LLC meets none.
- **EU and UK GDPR.** Article 3(2) reaches a company outside the EU or UK only when it offers goods or services to
  people there or monitors their behaviour there. Even where it applies, the erasure right gives way to "the right
  of freedom of expression and information" (Article 17(3)(a)).
- Other US state privacy laws follow the same pattern of thresholds and public-records exclusions, but haven't been
  read one by one. The attorney is the one to confirm any of this for a given request.

So a request isn't a legal obligation today. The owner has chosen to honor them as a courtesy.

## Doing it

1. **Read the request.** Support mail reaches the owner's Gmail through Cloudflare; check Spam too (the first
   request landed there). Note every page the person names.
2. **Find the identifiers,** on the owner's Mac, never in a commit: the employer page's slug (from its URL), the
   name exactly as DOL prints it, and the case numbers, from the read-only database:
   ```sql
   SELECT case_number, employer_name FROM perm_cases WHERE employer_slug = '<slug>';
   SELECT case_number, employer_name FROM pwd_cases  WHERE employer_slug = '<slug>';
   ```
   Pick a neutral label: what DOL's record shows the employer to be ("Private household employer" for a person
   employing a household worker; "Employer" otherwise). Never a word like "withheld" or "removed", which would
   mark the case.
3. **Run the one command** (from `v2/`, with ssh to the server and `gh` signed in):
   ```bash
   python3 scripts/withhold.py add "<slug>|<name as DOL prints it>|<label>|<case>,<case>"
   ```
   It saves the entry in `WITHHELD_EMPLOYERS` in the server's production.env (the one source of the list),
   mirrors it to the GitHub secret the build reads, redeploys so no page cache holds the name, has the deploy
   drop Cloudflare's copies of every affected page, checks the live site, and tells IndexNow. About 15 minutes.
4. **By hand in Search Console** (no API exists): Removals > New request > Temporarily remove URL for the employer
   page; then Clear snippet for any other page the person named. Check the Internet Archive too:
   `https://web.archive.org/cdx/search/cdx?url=permtracker.app/perm-employers/<slug>&output=json`. If it holds a
   copy, write to the Archive only with the owner's yes: that's an outward-facing message.
5. **Reply** from support@ (`supportEmail:replyToEmail`, threaded), on the owner's yes for that message. Pass the
   three paragraphs only: the email adds "Hi <first name>," and the sign-off itself.

   > Hi <first name>,
   >
   > Thanks for reaching out. The listing came from the Department of Labor's public disclosure data, but we're
   > happy to help, and your name is now off permtracker.app. The page you mentioned no longer exists, and your
   > name doesn't appear anywhere else on the site.
   >
   > We've also asked Google to drop the old page from its results, which usually takes a few days. The
   > Department of Labor still publishes the original records on its own website.
   >
   > If you spot your name anywhere else on our site, just reply here and we'll take care of it.
   >
   > Best regards,
   > The PERM Tracker team

To undo: `python3 scripts/withhold.py remove <slug>`. To see the count: `python3 scripts/withhold.py status`
(`--show` prints the list on the owner's machine only).

## What it changes on the site

- The employer's page answers 404, and it leaves every list, search, suggestion, ranking, sitemap and API answer.
- Its cases leave every list too, so no row stands out. Totals computed in SQL still count them.
- A lookup by one of its case numbers asks DOL live, shows the label, and records nothing.
- Nothing in the database changes: DOL's records stay as DOL published them, so a data reload, a gap fill or a
  rebuild can't bring the name back. The match also covers the case numbers, for a later file that spells the
  name differently.

Code: `src/lib/privacy/withheld.ts` (applied in `rows()` in `src/lib/db/client.ts` and `askDol` in
`src/lib/db/caseDiscovery.ts`), `scripts/withhold.py` and `scripts/lib_withheld.py`, and the deploy's last purge
step in `.github/workflows/oracle-deploy.yml`.

## Never

- Put a name, slug, case number or anything else that identifies a request in code, tests, comments, commit
  messages, workflow inputs, run logs, docs or `.planning/`. Even a hash of a name can be matched against DOL's
  files in seconds. Tests use made-up names.
- Show the label beside the case in a list, or use a label that says something was removed.
- Send the reply, or write to the Internet Archive, without the owner's yes for that message.
