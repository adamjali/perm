# FOIA request to DOL/ETA for PERM case-status data — DRAFT

**Status: draft for Adam's review. Not sent. Requires a real requester name,
address and phone — see the note at the bottom before sending.**

---

## Why this is the route

DOL already discloses exactly this data, one case at a time, through the
public FLAG case-status search at `flag.dol.gov/case-status-search`. Anyone
may type a case number and read that case's current status. That is the
strongest argument available that the same data is disclosable in bulk: the
agency has already decided it is public. What does not exist is a machine
route to it — the endpoint requires a reCAPTCHA token, and the quarterly
disclosure files contain only DECIDED cases, so pending status is absent from
every bulk product DOL publishes.

Checked before drafting this, all on 2026-08-27: no DOL public API
(`api.dol.gov` serves nothing usable, `developer.dol.gov` does not resolve),
no matching dataset on data.gov, and the quarterly OFLC disclosure release
carries a decision date on every record.

---

## Draft

**To:** U.S. Department of Labor, Employment and Training Administration
FOIA Officer
(submit via https://efoia.dol.gov — ETA is the correct component for OFLC
records)

**Subject:** Request for PERM (ETA-9089) case status data in machine-readable
form

Dear FOIA Officer,

Under the Freedom of Information Act, 5 U.S.C. § 552, I request records in
the following form.

**Records requested.** For each PERM labor certification application
(ETA-9089) received by the Office of Foreign Labor Certification with a
receipt date on or after October 1, 2023, and still pending as of the date
this request is processed:

1. the case number;
2. the receipt date;
3. the current case status as displayed by the FLAG case-status search
   (for example: Analyst Review, RFI Issued, Application on Hold, Pending
   Audit Response, Supervised Recruitment, Reconsideration Appeals, BALCA
   Appeals);
4. the date that status was last changed, if recorded.

**Form of production.** I request production in a machine-readable format —
CSV, TSV or XLSX. I am not requesting a new record be created: this is a
query against existing case-management data, and OFLC already publishes the
same fields individually through its public case-status search and publishes
comparable bulk extracts quarterly through its Performance Data disclosure
files.

**Why the existing releases do not cover it.** The quarterly OFLC disclosure
files contain only cases with a decision date. Pending applications appear in
no bulk release, while their status is individually public through FLAG. This
request seeks only that already-public information, in aggregate.

**No personal information sought.** I am not requesting beneficiary names,
employer contact details, wages, addresses, or any information identifying a
natural person. Case number, receipt date and status are sufficient. If any
requested field is thought to implicate Exemption 6 or 7(C), please withhold
that field and produce the remainder rather than denying the request; the case
number and status alone would satisfy it.

**Fee category.** [SELECT ONE BEFORE SENDING — see note below.]

**Fee limit.** I agree to pay reasonable fees up to $50. Please contact me
before incurring costs above that amount.

**Format and scope flexibility.** If the scope above is burdensome, I would
welcome a call or email to narrow it. A monthly refresh of the same extract,
or a smaller field set, would serve the purpose. If OFLC would prefer to
publish this as a routine dataset alongside the existing quarterly
disclosures rather than answer individual requests, I would support that and
withdraw this request.

I look forward to your response within the twenty working days provided by
5 U.S.C. § 552(a)(6)(A)(i).

Sincerely,

[Full legal name]
[Postal address]
[Phone]
[Email]

---

## Before Adam sends this

- **The fee category is a real choice with real consequences.** "Commercial
  use" attracts search, review AND duplication fees. "Educational or
  noncommercial scientific institution" and "representative of the news
  media" attract duplication only. permtracker.app is a free public data site
  which is a plausible news-media/public-interest posture, but it is a
  business, and misstating this is the kind of thing that sinks a request and
  damages the next one. Worth thirty minutes with the attorney who asked for
  this.
- **FOIA requires a real identity.** This one cannot go under the persona:
  the requester is making a statement to a federal agency and receiving
  records. Use the real legal name and a real address.
- **Twenty working days is the statutory clock, not the realistic one.**
  Plan on months. This is the durable route, not the fast one — the mirror
  covers the interim.
- **Consider calling OFLC first.** A short conversation about whether they
  would add pending status to the quarterly release is cheaper for everyone
  than a FOIA, and agencies frequently prefer it. The FOIA is the fallback if
  that goes nowhere.
