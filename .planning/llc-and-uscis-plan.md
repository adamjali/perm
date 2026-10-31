# Asolys LLC (PERM Tracker) and the USCIS API: the plug-and-play plan

Written Mon Sep 22 2026, ~8:10 PM EDT, while the Florida filing is in Northwest's queue.
Everything below that is code is BUILT and deployed with the Sep 22 batch. What is left
is paperwork and secrets, in the order the gates fall. Nothing here needs a code change
unless a step says so.

**Owner decisions already made (Sep 22):** register the USCIS API as the LLC, not as a
person; STORE USCIS responses (so the privacy policy discloses it now, before USCIS reads
it); ship the bulletin month strip; the manager consented to being named.

## Where things stand

| thing | state |
|---|---|
| Florida LLC, filed as PERM Tracker LLC, renamed Asolys LLC Oct 8 2026, manager-managed | **FILED AND ACTIVE: Sunbiz document L26000495521, date filed 09/23/2026** (read on Sunbiz Sep 30 2026, ~3:05 PM EDT; three weeks ahead of Northwest's Oct 14 estimate). Principal, mailing and agent address Northwest's; manager listed, no members; FEI/EIN "NONE" until the EIN exists. FinCEN: US companies are exempt from BOI reporting (fincen.gov/boi, read Sep 30 2026) |
| operating agreement | DRAFT written (single member, manager without ownership, Chapter 605). Lives OUTSIDE this public repo, in the owner's Documents folder, because it names the owner |
| Terms, About, Organization schema | say "Asolys LLC, doing business as PERM Tracker" since Oct 30 to 31 2026 (`LEGAL_NAME`, `LEGAL_DBA` in `src/lib/constants/about.ts`) |
| USCIS Torch client, receipt parser, `/uscis-case-status` page | built (Track B); reads `USCIS_CLIENT_ID`, `USCIS_CLIENT_SECRET`, `USCIS_ENV` (Vercel only; nothing under `convex/` touches USCIS) and renders its waiting state until they exist. Registration notes: `.planning/uscis-api/registration.md`, `support-email.md`, `affidavit-and-demo.md`, `section-508.md` |
| USCIS quarterly ingest and three data pages | built (Track A); runs on the Mac's residential runner where `www.uscis.gov` 403s GitHub |
| seven USCIS guides | built (Track C) |
| privacy policy: USCIS lookups section | shipped in this batch (see below) |
| accessibility statement `/accessibility` | shipped in this batch; the USCIS gate asks for Section 508 |
| reminders | the "LLC Deadline Reminders" routine (Mondays 9 AM EDT): the rename on Sunbiz, the FL annual report (Jan 1 to May 1 yearly from 2027), the Northwest renewal (each September) |
| rename to Asolys LLC | articles of amendment mailed Oct 8 2026; Sunbiz still PERM TRACKER LLC on Oct 18 with Florida's queue at receipts of Sep 30 to Oct 1, so it lands about Oct 28 to Nov 2. Ask the amendments desk (AmendmentsCorpHelp@dos.fl.gov, 850-245-6000, document L26000495521) if nothing shows by about Nov 4 |

## Gate R: the day Sunbiz shows ASOLYS LLC (owner's yes for every step below, Oct 18 2026)

1. **Read Sunbiz**: the name, the amendment in "Events", the document number (unchanged, L26000495521).
2. **Register "PERM Tracker" as Asolys LLC's fictitious name** (Fla. Stat. 865.09: required before doing business
   under it, $50, one newspaper ad in the county, good to Dec 31 of the 5th year). The owner files; show the form first.
3. **The site, in one change**: `LEGAL_NAME` in `src/lib/constants/about.ts` becomes "Asolys LLC", so the Terms,
   Privacy, API terms, About, accessibility page, footer, email footer and Settings follow; the Terms read
   "Asolys LLC, doing business as PERM Tracker"; the Organization keeps `name` "PERM Tracker" with `legalName`
   "Asolys LLC" (Google: the registered legal name "if applicable and different from the name property").
   **Add one line to the About page and the footer** (owner's yes, Oct 18): "PERM Tracker is a trade name of Asolys
   LLC, a Florida company managed by immigration attorney" plus the name from `SABRINA`, never typed twice.
   `legal-name.test.ts` holds them together; set both legal pages' "Last Updated" to that day.
4. **Then the money order**: EIN, Mercury, and TWO Stripe accounts under one login (Stripe requires separate
   accounts for businesses that operate independently): PERM Tracker, whose public name and statement line read
   PERM TRACKER, and the Asolys agency. Both are Asolys LLC.

## Gate A: the state files the Articles

The routine's Check 4 watches Sunbiz. When the record appears (or Northwest emails):

1. **Download the filed Articles** from the Northwest dashboard (Documents) or Sunbiz.
   Save beside the operating agreement, not in this repo.
2. **EIN, same day, by the owner, at irs.gov** (free, instant, "Apply for an EIN Online").
   Entity type LLC, one member, Florida, formation date = the Sunbiz filing date, reason
   "started a new business", responsible party = the owner. Third-party EIN services are
   never needed. Save the CP 575 letter with the Articles.
3. **Sign the operating agreement.** Fill the four brackets (effective date = the filing
   date; owner's mailing address; cash contributed, if any; the manager's notice address),
   delete the drafting note, both sign (PDF signatures are fine under Florida's UETA), keep
   the signed PDF with the Articles. The manager is an attorney and should read it first.
4. **Bank account** is the owner's call and is not needed for anything below.
5. **Nothing on the site changes.** The name and state are already there; the test
   `legal-name.test.ts` holds Terms, About and the schema to one constant.
6. **Calendar:** FL annual report window opens Jan 1 2027 ($138.75, $400 after May 1);
   Northwest's $125 agent renewal in Sep 2027. Both are in the routine already.

## Gate B: register with USCIS as the LLC (needs Gate A)

**On hold by the owner's call (Oct 7 2026): register only after the LLC's planned name change**, so the
identity form, the developer account and USCIS's due diligence carry the final legal name once.

USCIS's own gate, quoted from developer.uscis.gov: APIs are for "software development
organizations incorporated within the United States" that comply with the Terms of Use,
offer Section 508 compliant apps, and post a suitable privacy policy; "USCIS will
complete due diligence to validate that your policies are compliant." Then: developer
account, a Developer App for Case Status API Sandbox, five consecutive calendar days of
sandbox traffic with 200 and 4xx responses exercised, an email to
developersupport@uscis.dhs.gov, a demo, production keys.

1. **Support mailbox first.** `support@permtracker.app` is a Squarespace forward today, so
   replies would leave from a Gmail address. For a government correspondence thread, set a
   send-as: Gmail "Send mail as" through Resend's SMTP (`smtp.resend.com`, the existing
   API key as the password) so replies carry the domain. Ten minutes, no code.
2. **Developer account at developer.uscis.gov.** Identity form: organization = Asolys
   LLC, doing business as PERM Tracker, address = the registered address on the Articles, contact = the support
   mailbox. SHOW THE FILLED FORM TO THE OWNER BEFORE SUBMITTING (identity rule).
3. **Create the Developer App** for "Case Status API - Sandbox". Two credentials appear:
   client ID and client secret.
4. **Move the secret without reading it.** **Since Sep 28 2026 the site runs on the Oracle
   server, not Vercel**: server-only settings live in `/srv/permtracker/app/env/production.env`
   (root:permtracker 640, see `v2/scripts/oracle/README.md`). In the automation tab, select the
   secret and send a `cmd+c` key event; then pipe it straight in without printing it:
   `pbpaste | tr -d '\n' | ssh permtracker 'v=$(cat); printf "USCIS_CLIENT_SECRET=%s\n" "$v" | sudo tee -a /srv/permtracker/app/env/production.env >/dev/null'`,
   add `USCIS_CLIENT_ID` and `USCIS_ENV=sandbox` the same way, clear the clipboard
   (`printf '' | pbcopy`), and restart the web copies per the server README so they read the
   file. The Vercel commands below are the pre-move route, kept for the record only:
   ```
   pbpaste | tr -d '\n' | npx vercel env add USCIS_CLIENT_SECRET production --sensitive
   printf '' | pbcopy
   ```
   The client ID is not secret and goes in plainly:
   `npx vercel env add USCIS_CLIENT_ID production`, and `USCIS_ENV=sandbox`.
   If Track B's handoff put the client behind Convex as well, repeat for Convex with
   `pbpaste | tr -d '\n' | npx convex env set USCIS_CLIENT_SECRET --prod` (the value is
   read from stdin; never type it).
   **Vercel binds env at deploy time**, so a build carrying a change under `src/` has to
   follow (a docs-only push is skipped by `ignoreCommand`).
5. **Five sandbox days.** The lookup page against sandbox answers only the staging
   receipts (EAC9999103403 and its siblings, listed in the spec). Exercise it once a day
   for five consecutive calendar days, hitting a good receipt (200), a malformed one
   (400) and an unknown one (404), and keep the dates. If Track B shipped a warm-up job,
   its log is the record; otherwise five manual lookups from the page are enough.
6. **Email USCIS Torch developer support** from the support mailbox. Contents: legal
   name and state, the app name, the five dates, the privacy policy URL
   (`/privacy#uscis-case-status`), the accessibility statement (`/accessibility`), one
   sentence on what the lookup does and that a person supplies only their own receipt
   number. Ask what the demo needs.
7. **Demo.** Show the page against sandbox, the waiting state, the error states and the
   privacy section. Record a two-minute screen capture as a fallback.
8. **Production keys** arrive as a new app or new credentials. Same clipboard route,
   then `USCIS_ENV=production`, redeploy, and one live lookup with a real receipt the
   owner holds. The first successful production response is the moment
   `datasetCoverage`'s USCIS case-status line is true; it is already written.
9. **Rotation.** The spec does not state a credential lifetime. Read the app's page in
   the developer portal after production access and put the expiry, if any, into the
   due-check routine as a self-retiring check (the Check 4 shape). Until read, assume a
   year and schedule a look at day 340.

## Gate C: what changes when production answers

- `/uscis-case-status` starts answering real receipts; nothing to flip.
- Stored responses: the table keeps the receipt, form type, current status text and the
  dated history, per the owner's decision (`src/lib/db/uscisCaseStatus.ts`; a test holds
  its columns to the privacy bullet). The privacy policy says so, names the retention (12
  months after the last lookup, or on request), and `/api/cron/prune-uscis` deletes on that
  clock nightly at 5:20 AM ET. No email is sent, so the preference center is not involved.
- Case-status ALERTS on USCIS receipts stay parked: the Resend 100-a-day cap binds long
  before the API's 400,000 does. The ledger in `convex/caseAlerts.ts` has no line for
  them, and a line has to be claimed before any sending path ships.

## Gate D: everything the keys make possible (owner, Oct 16 2026: "do it all, fully exhaustive")

Production allows 10 requests a second and 400,000 a day, and each answer carries the case's dated
history (`hist_case_status[]`: RFE sent, response received, interview, approval). That makes these
measurable for the first time, with the same rigour as the DOL side:

1. **RFE rates and timings for the I-140 and I-485** (and the I-765 and I-131): USCIS publishes RFE
   figures for the I-129 only (`/uscis-rfe-rates`, from its quarterly files). From case histories:
   share with an RFE, days from receipt to RFE, from RFE to response, from response to decision, by
   form, category and service center, each with its count and window.
2. **Processing times by form and center from real cases**, beside USCIS's published medians.
3. **Alerts on USCIS receipts**, like the DOL alerts, once the email budget has a line for them.
4. **A walk of receipt numbers**, like the FLAG serial walk, for the populations above.
   **BEFORE building this, read USCIS's API Terms of Use and the use case we describe in its
   due diligence:** looking up cases people ask about is the stated purpose; a walk of receipts
   wholesale may need USCIS's say-so, and the keys are the price of guessing wrong.
5. **The undocumented `/processing-times/` endpoint**: ask it what it returns the day the keys work.

## What was deliberately not done

- No developer account was created and no form was submitted. Both carry an identity
  decision and both are gated on the entity existing.
- No accessibility AUDIT was run. The statement describes the standard the site builds to
  and how to report a barrier; it does not claim a completed audit.
- No FTA/H008 event-code decoding: the sanctioned API returns human text, not those
  codes, so the guides say the codes are not available and why.
