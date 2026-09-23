# Affidavit and demo notes for USCIS production access

Drafted Tue Sep 22 2026, 8:30 PM EDT. From the portal's own Get Started page
(captured Sep 21): production credentials are issued after a demo (offered
Wednesdays and Thursdays, 1 to 2 PM Eastern) and a signed affidavit. The
portal's affidavit template is the form to sign; this file is what we can
truthfully attest to and what to show in the demo, so nothing on the day is
improvised.

## What we can attest, sentence by sentence

Each line names where it is true in the code, so a reviewer can check it.

- **Entity.** PERM Tracker LLC, a Florida limited liability company, operates
  permtracker.app. (Sunbiz filing; the About page names the site's public
  face.)
- **Purpose.** A receipt-number lookup for members of the public waiting on an
  employment-based petition, displaying USCIS's own status text. No
  resale, no bulk export, no republication of any receipt's status.
  (`src/app/(site)/(public)/uscis-case-status/page.tsx`.)
- **Credentials handling.** The client id and secret live only in the hosting
  provider's environment store, marked sensitive, bound at deploy time. They
  are never logged, never in the repository, never in a browser. The client
  reads them from `process.env` inside a server-only module.
  (`src/lib/uscis/torchClient.ts`, the `server-only` import; the repository's
  secret-scanning history is clean.)
- **Transport.** HTTPS only to `api.uscis.gov`; the token is requested by POST
  with the credentials in the form body, never in a URL.
- **Rate limits.** A local token bucket at the published TPS and a global
  daily counter, charged before every call, capped at 350,000 in production
  against the 400,000 quota. A 429 from USCIS is surfaced to the visitor, never
  retried in a loop. (`takeTpsToken`, `underUscisDailyBudget`, and the 429
  branch in `fetchCaseStatus`; each is pinned by a test.)
- **Input handling.** Only a string matching USCIS's own receipt regex reaches
  the API; the length is capped before the regex runs; a visitor is limited per
  address. (`src/lib/uscis/routeHandler.ts`, tests in
  `src/app/api/uscis-case-status/__tests__/route.test.ts`.)
- **Storage and retention.** Receipt number, form type, status text, dated
  history and lookup time; deleted twelve months after the last lookup; no
  identifier of the visitor. (`src/lib/turso/uscisCaseStatus.ts`; the table's
  columns are held to the privacy policy's list by `uscis-wiring.test.ts`.)
- **Privacy policy.** Public, and section 18 describes exactly this lookup:
  https://permtracker.app/privacy#uscis-case-status
- **Accessibility.** Section 508 attestation in `section-508.md`.
- **Confidential cases.** USCIS returns 404 for receipts protected under
  8 U.S.C. 1367 and for unknown receipts alike; the page says "USCIS has no
  case under that number" and points to USCIS's own status page. We do not
  attempt to distinguish the two.

Things we must NOT attest, because they are not true today: that a screen-
reader review has been done (open), that an automated accessibility scan has
been run on the page (open), that any USCIS data is encrypted separately from
the rest of the database (it is encrypted at rest with the database as a
whole, which is what the policy says).

## The demo, minute by minute

Sandbox hours are weekdays 7 AM to 8 PM Eastern; the demo slot is inside them.
Set `USCIS_ENV=sandbox` and the sandbox credentials on a preview deployment
(never production) the day before, and run through this once alone first.

1. **The page, keys absent** (30 s). Show production's
   `/uscis-case-status` as it is today: the receipt decodes, the panel says
   "USCIS access is pending", the links go to USCIS's own status page and
   Emma. Point: nothing is invented while access is pending.
2. **A staging receipt with history** (1 min). On the preview deployment,
   look up `EAC9999103403`. Show USCIS's status text, the two USCIS dates, the
   dated history, and "Status seen" with the Eastern time. Point: the panel
   prints USCIS's words and the time they were read.
3. **A staging receipt without history** (30 s). `EAC9999103400`. The
   history block is absent rather than empty.
4. **The stored copy** (30 s). Reload the same receipt: "our copy, under six
   hours old" beside "Status seen", and no second call in the server log.
   Point: repeat lookups do not spend the quota.
5. **A wrong shape** (30 s). Type `EAC123` and `G-100-26125-868956`. The
   first is refused with the shape sentence and nothing is sent; the second is
   sent to the DOL page. Point: only a receipt-shaped string ever reaches the
   API.
6. **An unknown receipt** (30 s). `EAC9999999999`: "USCIS has no case under
   that number", with the confidential-case sentence.
7. **The budget** (1 min). Show the day's counter row in `perm_docs`
   (`uscis_budget_<date>`), and the test that proves the charge happens before
   the call. Point: the cap is global, not per visitor, so it cannot be rotated
   around.
8. **The privacy policy** (30 s). Section 18, and the test that holds the
   table's columns to it.

Staging receipts USCIS lists for the sandbox (from the Sandbox Test Cases
page, captured Sep 21). With history: EAC9999103403, EAC9999103404,
EAC9999103405, EAC9999103410, EAC9999103411, EAC9999103416, EAC9999103419,
LIN9999106498, LIN9999106499, LIN9999106504, LIN9999106505, LIN9999106506,
SRC9999102777 through SRC9999102787, SRC9999132710, SRC9999132719. Without
history: EAC9999103400, EAC9999103402, EAC9999103406 to 09, EAC9999103412 to
15, EAC9999103420, 21, 24, 25, 26, 28, 29, 31, 32, LIN9999106501,
LIN9999106507, SRC9999132694, 95, SRC9999132706, SRC9999132707.

## Questions to expect, and the honest answer

- *Who can use the lookup?* Anyone; that is question 1 in `support-email.md`
  and we will gate it if USCIS says so.
- *Do you cache?* Yes, six hours, stated on the page; twelve-month deletion.
- *Do you poll?* No. Nothing re-checks a receipt on a schedule in this release.
- *What happens at 400,000?* We stop at 350,000 and the page says the day's
  budget is spent, with a link to USCIS's own page.
- *What if the token leaks?* Rotate in the portal and in the hosting
  provider's environment; the client refetches on the next call. The secret is
  never in a log or a browser.
