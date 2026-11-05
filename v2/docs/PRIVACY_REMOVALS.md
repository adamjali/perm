# Taking a name off the site

A person, a company or a law firm can ask for its name to come off permtracker.app. The owner decides each request
on its own; there's no rule for any kind of request. Here's the whole process. It names no one, and nothing about a
request may ever go into this repository, which is public.

## The legal position (as of Oct 17 2026; not legal advice)

The site shows the Department of Labor's own disclosure records. As read from the laws' own texts:

- **California (CCPA).** Cal. Civ. Code §1798.140(v)(2) excludes "publicly available information", which includes
  "Information that is lawfully made available from federal, state, or local government records." The act also
  reaches only a "business" over its thresholds (§1798.140(d)): more than $25 million a year in revenue
  (inflation-adjusted), buying, selling or sharing 100,000 or more people's personal information, or half its
  revenue from selling it. PERM Tracker meets none.
- **EU and UK GDPR.** Article 3(2) reaches a company outside the EU or UK only when it offers goods or services to
  people there or monitors their behaviour there. Even where it applies, the erasure right gives way to "the right
  of freedom of expression and information" (Article 17(3)(a)).
- Other US state privacy laws follow the same pattern of thresholds and public-records exclusions, but haven't been
  read one by one. The attorney is the one to confirm any of this for a given request.

So a request isn't a legal obligation today. The owner has chosen to honor them as a courtesy.

## What a removal does (owner's decisions, Nov 5 2026)

The name goes; the numbers stay.

- **Everywhere the name showed, a label shows instead**, numbered once for the whole site: "Law firm 3",
  "Employer 1", "Private household employer 2". The number is stored in the entry and never reused, so "Law firm 3"
  is the same firm on every page.
- **Every row, count, total, share, rank, chart and share card stays exactly as it was.** A ranking shows "Law firm
  3" at its real rank. A client's page lists "Law firm 3" among its firms.
- **The label links to a neutral page**: `/perm-attorneys/law-firm-3`, `/perm-employers/employer-1`. It's the
  entity's own page, every figure kept, with its name, its spellings, its aliases and any profile it published taken
  off. Its title, heading, breadcrumb, share card and badge use the label. It's marked noindex,follow and kept out
  of the sitemap and the name suggestions, so it's never a search result of its own.
- **The old named URL answers 404**, and so do its card, badge, aliases, A to Z entry and sitemap entry. It never
  redirects to the neutral page: a redirect would tie the name to the number for anyone following it.
- **A search or filter by the real name or the old slug finds nothing and says so.** It never falls back to the
  closest other name. A case search by the neutral page (a firm's `?firm=law-firm-3`) works.
- **A lookup by case number keeps working**, with the label in place of the name.
- **DOL's records in the database are never changed.** The masking happens as each read leaves the database, so a
  data reload, a gap fill or a rebuild can't bring the name back, and undoing a removal brings everything back.
- **Convex masks the same names** in every email, alert, digest and webhook, and a withheld firm can't be claimed.

DOL's own files stay public. The aim is that the name is hard to find on our pages and on Google; tracing the
filings back to it from DOL's files stays possible, and that's accepted.

## Doing it

1. **Read the request.** Support mail reaches the owner's Gmail through Cloudflare; check Spam too (the first
   request landed there). Note every page the person names.
2. **Find the page's slug**, from the URL they named, on the owner's Mac, never in a commit. Pick the label only for
   an employer: what DOL's record shows it to be ("Private household employer" for a person employing a household
   worker; "Employer", the default, otherwise). A firm is always "Law firm". Never a word like "withheld" or
   "removed", which would mark the entry.
3. **Run the one command** (from `v2/`, with ssh to the server, `gh` and the Convex CLI signed in):
   ```bash
   python3 scripts/withhold.py add <page-slug> --label "Private household employer"   # an employer
   python3 scripts/withhold.py add --firm <page-slug>                                 # a law firm
   ```
   It reads the database (read-only) for every slug and printed spelling the page is known by, shows the counts
   and the neutral page it will link to, and asks before it changes anything. Then it gives the entry its number,
   saves `WITHHELD_EMPLOYERS`, `WITHHELD_FIRMS` and `WITHHELD_NUMBERS` in the server's production.env (the one
   source of the lists), mirrors the two lists to the GitHub secrets the build reads and to Convex production,
   redeploys so no page cache holds the name, has the deploy drop Cloudflare's copies of every affected page,
   checks the live site and tells IndexNow. About 15 minutes.

   The live check prints passes and failures, never a name: the old page answers 404, the neutral page answers 200
   with the label and no name, the pages that showed the name don't, a case search by the name finds nothing, and
   (for an employer with case numbers) a case lookup shows the label.

   The redeploy empties every page cache at once, so unless the request is urgent run it at night (after midnight
   Eastern), when few people are reading. **The redeploy builds main as it stands**, so a red test suite or a
   failing page check holds the removal too: get main green first. If the tool reports the deploy failed (the
   settings are already saved), fix main, run `gh workflow run oracle-deploy.yml -f when=now`, and once it succeeds
   run `python3 scripts/withhold.py check` for the live checks and IndexNow (it saves nothing). While Cloudflare's Under Attack Mode is on, the
   live check sees Cloudflare's 403 where it expects a 404; check from the server instead:
   `ssh permtracker 'curl -s -o /dev/null -w "%{http_code}" -H "Host: permtracker.app" http://127.0.0.1:8081/perm-attorneys/<slug>'`.
4. **In Search Console and Bing** (no API exists; done in Claude-in-Chrome on the owner's go). **Google Search
   Console** (the `sc-domain:permtracker.app` property): Removals > New request > Temporarily remove URL, choose
   **"Remove all URLs with this prefix"** on the old page's URL (the prefix also covers its `/opengraph-image` card
   route), submit; it reads "Processing request" and is cancellable. Clear snippet for any other page the person
   named. **And in Bing Webmaster Tools** (it serves Yahoo, DuckDuckGo and Ecosia too): Configuration > Block URLs
   (`bing.com/webmasters/searchconfig/blockurl?siteUrl=https://permtracker.app/`) > Add URL to block, the old page,
   URL type Page, Block type **URL & Cache** (the default is Cache only), 90 days; read it back in the list. **The
   account matters in Bing:** the browser's default Bing session may be a different account that doesn't own
   permtracker.app, so the page reads "User is unauthorized to access the site"; have the owner switch Bing to the
   account that owns the property first (never sign in yourself). **Before calling it done, cross-check EVERY
   withheld page (`withhold.py status --show`) against BOTH consoles**; a prior removal had its Google removal done
   but its Bing block missed. Never submit a neutral page to either: it's noindex already. Crawlers with no removal
   tool (Apple, the AI crawlers) drop the page when they next fetch it and get 404. Check the Internet Archive too:
   `https://web.archive.org/cdx/search/cdx?url=permtracker.app/perm-attorneys/<slug>&output=json`. If it holds a
   copy, write to the Archive only with the owner's yes: that's an outward-facing message.
5. **Reply** from support@ (`supportEmail:replyToEmail`, threaded), on the owner's yes for that message. Pass the
   three paragraphs only: the email adds "Hi <first name>," and the sign-off itself. **A support-flow reply sends via
   Resend and doesn't land in the Gmail thread**, so to check whether a requester was already replied to, read the
   Convex `supportEmails` row (`repliedAt` / `replyBody` / `resendEmailId`) as well as Gmail. Keep the wording soft:
   say the data is public and anyone can access it; never claim a right to publish it ("we're allowed to publish" is
   too strong).

   > Hi <first name>,
   >
   > Thanks for reaching out. The listing came from the Department of Labor's public disclosure data, but we're
   > happy to help, and your name is now off permtracker.app. The page you mentioned no longer exists, and anywhere
   > else on the site that listed you now shows a neutral label instead of your name.
   >
   > We've also asked Google to drop the old page from its results, which usually takes a few days. The
   > Department of Labor still publishes the original records on its own website.
   >
   > If you spot your name anywhere else on our site, just reply here and we'll take care of it.
   >
   > Best regards,
   > The PERM Tracker team

## Undo, refresh and status

- **Undo:** `python3 scripts/withhold.py remove <page-slug>` (add `--firm` or `--employer` if a firm and an employer
  share the slug). The name comes back everywhere and the neutral page answers 404. The entry's number is never
  given to anyone else.
- **Refresh:** `python3 scripts/withhold.py refresh` re-reads every entry's slugs and spellings from the database
  and numbers any entry made before numbers existed. Run it when the deploy's log warns that page-map spellings
  aren't in the lists (the nightly map can give a page a new spelling); it never drops a spelling an entry held.
- **Status:** `python3 scripts/withhold.py status` prints counts; `--show` prints the lists, on the owner's machine
  only.

## Where it lives

The rule is one module, `convex/lib/withheldNames.ts` (read its header), applied in `rows()` in
`src/lib/db/client.ts` (every site read) and `query()` in `convex/lib/publicMirror.ts` (every Convex read), and to
DOL's live answers in `askDol` in `src/lib/db/caseDiscovery.ts`. The site's instance is
`src/lib/privacy/withheld.ts`. The tool is `scripts/withhold.py` with `scripts/lib_withheld.py`; the deploy's purge
step is in `.github/workflows/oracle-deploy.yml`. `scripts/fixtures/withheld_format.json` holds the Python and the
TypeScript readers of the lists to one reading.

## Switching from the old behaviour (before Nov 5 2026)

The old mechanism dropped every row that named a withheld employer. The entries made then have no number, so until
they're refreshed each is masked with its plain label, links nowhere and has no neutral page; its old page still
answers 404. After the code that masks is live, run `python3 scripts/withhold.py refresh` once to number them.

## Never

- Put a name, slug, case number or anything else that identifies a request in code, tests, comments, commit
  messages, workflow inputs, run logs, docs or `.planning/`. Even a hash of a name can be matched against DOL's
  files in seconds. Tests use made-up names.
- Redirect an old named URL to its neutral page, or use a label that says something was removed.
- Send the reply, or write to the Internet Archive, without the owner's yes for that message.
