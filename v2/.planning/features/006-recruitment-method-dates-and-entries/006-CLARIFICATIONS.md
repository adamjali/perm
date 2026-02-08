# Feature 006: Clarifications

**Feature:** Professional recruitment method dates and additional entries
**Date:** 2026-02-08

## Questions & Answers

### Date Fields
**Q:** Should we add start/end dates to all 11 methods or only specific ones?
**A:** Only specific methods: `job_website_ad`, `employer_website`, `private_employment_firm` get start+end dates. Radio does NOT get start+end — it keeps a single date. All other methods also keep their single date.

### Radio Sub-Entries
**Q:** Should radio sub-entries have start+end dates or single date? Max count?
**A:** Single date + description per sub-entry. No explicit max mentioned (reasonable limit like 10).

### Legacy Fields
**Q:** Should the standalone Additional Recruitment Period (additionalRecruitmentStartDate/EndDate) be removed?
**A:** Yes, remove the legacy fields. Per-method dates replace them entirely.

### Sub-Entry Scope
**Q:** Should the sub-entries pattern apply only to radio or to other methods too?
**A:** Radio (`radio_ad`) AND TV ad (`tv_ad`) both get the sub-entries feature. All other methods are single-entry only.

## Implications

### Methods with Start+End Dates (3)
- `job_website_ad` — start date, end date
- `employer_website` — start date, end date
- `private_employment_firm` — start date, end date

### Methods with Sub-Entries (2)
- `radio_ad` — single date per entry + description, can add multiple sub-entries
- `tv_ad` — single date per entry + description, can add multiple sub-entries

### Methods with Single Date Only (6)
- `local_newspaper` — single date
- `job_fair` — single date
- `campus_placement` — single date
- `trade_organization` — single date
- `employee_referral` — single date
- `on_campus_recruitment` — single date

### Validation Rules (per user's spec)
For start+end date methods:
- **Start date**: must be after PWDDD, cannot be after end date, cannot be after min(PWDED, 180 days from recruitment start + 30 day buffer)
- **End date**: requires start date first, cannot be before start date, cannot be after min(PWDED, 180 days from recruitment start + 30 day buffer)

### Schema Impact
- Remove `additionalRecruitmentStartDate` and `additionalRecruitmentEndDate` from schema
- Add optional `startDate`/`endDate` to method object (for the 3 date-range methods)
- Add optional `subEntries` array (for radio_ad/tv_ad)
- Keep `date` field for backward compat + single-date methods
- `calculateRecruitmentEndDate` needs to use method `endDate` when present, otherwise fall back to `date`

### UI Impact
- Remove "Additional Recruitment Period" standalone section
- Conditionally render start+end date inputs for the 3 date-range methods
- Add sub-entry management (add/remove buttons, entry list) for radio_ad/tv_ad
- Handle overflow: "+X more" / "See all" for sub-entries when there are many
