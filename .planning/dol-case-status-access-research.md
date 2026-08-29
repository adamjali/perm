# Can we get daily per-case PERM status legitimately? — research 2026-08-27

Full transcript: /tmp/dolresearch.jsonl (backed up). Verdicts below.

## The short version
There is **no sanctioned machine route** to daily per-case PERM status. DOL has
an open-data program (~200 datasets) and NONE is OFLC/PERM. FLAG has no export,
no API. The quarterly disclosure files carry decided cases only — OFLC states on
its performance page that cases "currently being processed without final
determination" are deliberately excluded.

## The load-bearing fact (VERIFY VERBATIM IN A BROWSER)
The case-status page's own help text reads: **"The search feature includes
automated verification to prevent abuse."** That is DOL characterising the 401
mechanism as a deliberate anti-abuse control. Clearing it is circumvention no
matter that the data is public. Read via r.jina.ai proxy (the page is a JS app),
identical on two prompts — confirm it on the real page before citing it.

## The prohibition that kills "log in as the attorney"
Login.gov Rules of Use §5: "Automated access to Login.gov is strictly
prohibited ... This includes ... data scraping, form submissions, and
circumventing security." FLAG separately bans account sharing, penalty = the
attorney's FLAG access revoked. So authenticated automation is out, twice over,
and the risk falls on the attorney's practice — not ours to accept for her.

## The precedent that makes "ask DOL" strong
**SeasonalJobs.dol.gov (OFLC's own) publishes live PENDING H-2A/H-2B case data
via daily third-party feeds.** "available to any third-party ... through data
feeds, which can be extracted daily." So OFLC understands and has shipped
exactly this concept for another category. The absence of a PERM equivalent is
a policy choice, not a tech gap. This is the argument to make.

## Unresolved conflict — SETTLE BEFORE BUILDING
Practitioner sources claim the PUBLIC form returns only FINAL determinations for
PERM (Certified/Denied/Withdrawn/Expired) and that pending statuses (Analyst
Review, RFI, Audit) show ONLY inside the logged-in FLAG account. Unverified. If
true, permtrack's live pending data comes from authenticated automation (the
prohibited category), and our mirror inherits that exposure. One case number in
each state settles it.

## FOIA
Correct office: DOL/ETA FOIA, foiarequest@dol.gov, efoia.dol.gov. But FOIA
reaches EXISTING records only — cannot produce a feed. The one bulk PERM attempt
on record (MuckRock 2012) drew a $3,920 fee estimate, waiver denied, closed
unpaid. Good for a one-time snapshot at most.

## Legitimate routes, ranked
1. **Attorney-authorized human-in-the-loop batch check.** DOL's form takes 30
   cases at once behind its verification step. Product holds the caseload,
   generates the batch, attorney/paralegal pastes it + completes verification +
   pastes back; we diff and fire the cascade. ~2 min/day for a large portfolio,
   fully within DOL's design, describable to a firm's GC. First-party pending
   status, legitimately.
2. **Attorney-forwarded FLAG notifications.** FLAG emails the account holder on
   events; forwarding her own mail is her call. Parse the mailbox. Confirm which
   events email out and what fields they carry before scoping.
3. **The statistical product we already have** — quarterly disclosure (fresher
   than permtrack), processing frontier, Selected Statistics inventory, I-140,
   visa bulletin. "We estimate from published data and show you the data."
4. **Ask OFLC directly**, via the PERM Help Desk and AILA's DOL Liaison
   Committee, citing the SeasonalJobs precedent. Low cost, creates a record.
5. **FOIA** — one-time snapshot only, budget for a fee fight.

## Not recommended
Automating the public endpoint at any volume. DOL published it carries anti-abuse
verification; our audience is compliance-bound attorneys. It is the one build
that could cost us the audience outright. permtrack doing it is a fact about
permtrack's risk, not evidence the route is open.

## USCIS contrast (proves the point)
USCIS runs a real Case Status API (developer.uscis.gov, OAuth, for case-mgmt
vendors) — for USCIS receipt numbers. No DOL equivalent. Any vendor advertising
"government case tracking" means USCIS, not DOL PERM.
