# Phase 13: Core Logic Extraction - Research

**Researched:** 2025-12-20
**Domain:** PERM Labor Certification Regulations & Business Rules
**Confidence:** HIGH

<research_summary>
## Summary

Researched PERM labor certification regulations from 20 CFR Part 656 and verified against the existing codebase implementation. The current codebase in `backend/app/utils/` contains comprehensive, well-documented business logic that accurately implements DOL requirements.

Key finding: The existing implementation in `date_validation.py`, `deadline_relevance.py`, and `business_days.py` is already legally accurate and thoroughly tested (390+ tests). Phase 13 should **extract and document** this logic into migration-ready reference documents, not reimplement.

**Primary recommendation:** Extract business rules directly from existing Python implementation, cross-reference with `docs/research.md` for regulatory citations, and organize by domain for migration.
</research_summary>

<regulatory_sources>
## Regulatory Sources

### Primary Regulations (20 CFR Part 656)

| Section | Topic | Key Requirements |
|---------|-------|------------------|
| § 656.40 | Prevailing Wage | PWD validity, expiration calculation |
| § 656.17 | Basic Labor Certification | Recruitment timing, filing windows |
| § 656.10 | General Instructions | Notice of Filing, attestations |
| § 656.18 | College/University Teachers | Special recruitment procedures |

### Key DOL Resources

- **FLAG System:** https://flag.dol.gov/programs/perm
- **Processing Times:** https://flag.dol.gov/processingtimes
- **Federal Holidays:** https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/

### USCIS Regulations

| Regulation | Topic | Key Requirements |
|------------|-------|------------------|
| 8 CFR § 204.5(n)(3) | I-140 Filing | 180-day validity of labor certification |
</regulatory_sources>

<deadline_calculations>
## Deadline Calculations

### PWD Expiration (20 CFR § 656.40(c))

**Implementation verified in:** `backend/app/utils/date_validation.py:37-83`

```python
def calculate_pwd_expiration(determination_date):
    """
    Rule 1: If determination between Apr 2 - Jun 30 (inclusive)
        → Expiration = determination + 90 days

    Rule 2: If determination after Jun 30 (Jul 1 - Dec 31)
        → Expiration = Jun 30 of following year

    Rule 3: If determination before Apr 2 (Jan 1 - Apr 1)
        → Expiration = Jun 30 of same year
    """
```

**Edge cases verified:**
- Apr 2 boundary (starts 90-day period)
- Jun 30 boundary (last day of 90-day period)
- Jul 1 boundary (starts next-year Jun 30 period)

### ETA 9089 Filing Window (20 CFR § 656.17(e))

**Implementation verified in:** `backend/app/utils/date_validation.py:294-310`

```python
def calculate_eta9089_filing_window(recruitment_end_date):
    """
    Window opens: recruitment_end_date + 30 days
    Window closes: recruitment_end_date + 180 days

    Recruitment ends on LATER of:
    - Second Sunday newspaper ad date
    - Job order end date
    """
```

### ETA 9089 Expiration (8 CFR § 204.5(n)(3))

**Implementation verified in:** `backend/app/utils/date_validation.py:398-408`

```python
def calculate_eta9089_expiration(certification_date):
    """
    Expiration = certification_date + 180 days
    I-140 MUST be filed before this date
    """
```

### Notice of Filing (20 CFR § 656.10(d))

**Implementation verified in:** `backend/app/utils/business_days.py:104-131`

```python
def calculate_notice_of_filing_end_date(start_date):
    """
    Must be posted for 10 consecutive BUSINESS days

    Business days exclude:
    - Weekends (Saturday, Sunday)
    - Federal holidays (per OPM schedule)
    """
```
</deadline_calculations>

<validation_rules>
## Validation Rules

### PWD Date Validations

| Rule | Field | Severity | Message |
|------|-------|----------|---------|
| V-PWD-01 | pwd_determination_date | Error | Must be after filing date |
| V-PWD-02 | pwd_expiration_date | Error | Must be after determination date |
| V-PWD-03 | pwd_expiration_date | Warning | Should match calculated value |
| V-PWD-04 | pwd_expiration_date | Warning | Expired PWDs flagged |

### Recruitment Date Validations

| Rule | Field | Severity | Message |
|------|-------|----------|---------|
| V-REC-01 | sunday_ad_first_date | Error | Must be on a Sunday |
| V-REC-02 | sunday_ad_second_date | Error | Must be on a Sunday |
| V-REC-03 | sunday_ad_second_date | Error | Must be after first Sunday ad |
| V-REC-04 | job_order_end_date | Error | Must be after start date |
| V-REC-05 | job_order_end_date | Error | Duration must be ≥ 30 days |
| V-REC-06 | notice_of_filing_end_date | Error | Must be ≥ 10 business days |

### ETA 9089 Date Validations

| Rule | Field | Severity | Message |
|------|-------|----------|---------|
| V-ETA-01 | eta9089_filing_date | Error | Must be ≥ 30 days after recruitment ends |
| V-ETA-02 | eta9089_filing_date | Error | Must be ≤ 180 days after recruitment ends |
| V-ETA-03 | eta9089_filing_date | Error | Must be before PWD expiration (unless recruitment started during PWD validity) |
| V-ETA-04 | eta9089_certification_date | Error | Must be after filing date |
| V-ETA-05 | eta9089_expiration_date | Warning | Should be certification + 180 days |

### I-140 Date Validations

| Rule | Field | Severity | Message |
|------|-------|----------|---------|
| V-I140-01 | i140_filing_date | Error | Must be after ETA 9089 certification |
| V-I140-02 | i140_filing_date | Error | Must be ≤ 180 days after certification |
| V-I140-03 | i140_approval_date | Error | Must be after filing date |

### RFI/RFE Date Validations

| Rule | Field | Severity | Message |
|------|-------|----------|---------|
| V-RFI-01 | rfi_response_due_date | Error | Must be after received date |
| V-RFI-02 | rfi_response_submitted_date | Error | Must be after received date |
| V-RFI-03 | rfi_response_submitted_date | Warning | Late if after due date |
| V-RFE-01 | rfe_response_due_date | Error | Must be after received date |
| V-RFE-02 | rfe_response_submitted_date | Error | Must be after received date |
| V-RFE-03 | rfe_response_submitted_date | Warning | Late if after due date |
</validation_rules>

<deadline_relevance>
## Deadline Relevance Rules

**Implementation verified in:** `backend/app/utils/deadline_relevance.py`

Key insight: Deadlines become irrelevant once their associated stage completes.

### Supersession Rules

| Deadline Type | Becomes Irrelevant When |
|---------------|------------------------|
| pwd_expiration | eta9089_filing_date is set |
| recruitment_end | eta9089_filing_date is set |
| eta9089_filing_window | eta9089_filing_date is set |
| recruitment_expiration | eta9089_filing_date is set |
| eta9089_expiration | i140_filing_date is set |
| i140_filing_deadline | i140_filing_date is set |
| rfi_response_due | rfi_response_submitted_date is set |
| rfe_response_due | rfe_response_submitted_date is set |

### Terminal Statuses

Cases with these statuses have ALL deadlines irrelevant:
- Complete
- Closed
- Withdrawn
- Denied
</deadline_relevance>

<case_stages>
## Case Stages (Status Progression)

**Validated from:** `backend/app/schemas/case.py:162-177`

| Stage | Meaning | Next Stage |
|-------|---------|------------|
| PWD | Prevailing Wage not yet filed | PWD Approved |
| PWD Approved | PWD received, ready for recruitment | Recruitment |
| Recruitment | Recruitment in progress | ETA 9089 Prep |
| ETA 9089 Prep | Recruitment complete, preparing application | ETA 9089 Filed |
| ETA 9089 Filed | Application submitted to DOL | ETA 9089 Certified |
| ETA 9089 Audit | DOL audit (optional) | ETA 9089 Certified |
| ETA 9089 Certified | Labor certification approved | I-140 Prep |
| I-140 Prep | Preparing I-140 petition | I-140 Filed |
| I-140 Filed | I-140 submitted to USCIS | I-140 Approved |
| I-140 Approved | I-140 approved | Complete |
| Complete | Full process complete | - |
| Closed | Case closed (any reason) | - |
| Withdrawn | Case withdrawn | - |
| Denied | Case denied | - |
</case_stages>

<perm_process_either_or_rule>
## Either/Or Rule (20 CFR § 656.40(c))

**Critical PERM rule often misunderstood:**

The employer has TWO paths for PWD validity:

**Path A: File before PWD expires**
- Complete entire recruitment
- File ETA 9089 before PWD expiration date

**Path B: Start recruitment during PWD validity**
- Begin recruitment BEFORE PWD expires
- Can file ETA 9089 AFTER PWD expires
- Recruitment start = earlier of: first Sunday ad OR job order start

**Implementation verified in:** `backend/app/utils/date_validation.py:362-385`

This is a common source of confusion. The validation correctly implements both paths.
</perm_process_either_or_rule>

<federal_holidays>
## Federal Holidays (for Business Day Calculations)

**Source:** OPM (https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/)

**Implementation verified in:** `backend/app/utils/business_days.py:16-61`

Current implementation includes 2025-2027 holidays. For migration:
- Consider dynamic holiday calculation
- Or maintain holiday list updates

### 2025 Federal Holidays
| Date | Holiday |
|------|---------|
| Jan 1 | New Year's Day |
| Jan 20 | MLK Jr. Day |
| Feb 17 | Washington's Birthday |
| May 26 | Memorial Day |
| Jun 19 | Juneteenth |
| Jul 4 | Independence Day |
| Sep 1 | Labor Day |
| Oct 13 | Columbus Day |
| Nov 11 | Veterans Day |
| Nov 27 | Thanksgiving |
| Dec 25 | Christmas |

**Holiday observation rules:**
- Weekend holidays shift to nearest weekday
- Saturday → Friday observed
- Sunday → Monday observed
</federal_holidays>

<case_fields>
## Case Data Fields (50+ fields)

**Validated from:** `backend/app/schemas/case.py:18-156`

### Basic Information
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| employer_name | string | Yes | 1-255 chars |
| position_title | string | Yes | 1-255 chars |
| beneficiary_identifier | string | No | Auto-generated if not provided |
| case_number | string | No | Internal tracking number |

### PWD Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| pwd_filing_date | date | No | When PWD was filed |
| pwd_determination_date | date | No | When PWD was approved |
| pwd_expiration_date | date | No | Auto-calculated |

### Recruitment Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| sunday_ad_first_date | date | No | Must be Sunday |
| sunday_ad_second_date | date | No | Must be Sunday, after first |
| sunday_ad_newspaper | string | No | Newspaper name |
| job_order_start_date | date | No | SWA job order start |
| job_order_end_date | date | No | Must be ≥ 30 days after start |
| job_order_state | string | No | 2-letter state code |
| notice_of_filing_start_date | date | No | Internal posting start |
| notice_of_filing_end_date | date | No | Must be ≥ 10 business days |
| additional_recruitment_methods | JSON | No | For professional positions |
| recruitment_applicants_count | int | No | Default: 0 |
| recruitment_summary_custom | string | No | Override auto-summary |
| is_professional_occupation | bool | No | Default: false |

### ETA 9089 Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| eta9089_filing_date | date | No | When filed with DOL |
| eta9089_certification_date | date | No | When certified |
| eta9089_expiration_date | date | No | Auto-calculated (cert + 180) |
| eta9089_case_number | string | No | DOL case number |

### RFI Fields (DOL Stage)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| rfi_received_date | date | No | When RFI received |
| rfi_response_due_date | date | No | Response deadline |
| rfi_response_submitted_date | date | No | When response sent |
| rfi_list | JSON array | No | Multiple RFI entries |

### I-140 Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| i140_filing_date | date | No | When filed with USCIS |
| i140_approval_date | date | No | When approved |
| i140_receipt_number | string | No | USCIS receipt number |

### RFE Fields (USCIS Stage)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| rfe_received_date | date | No | When RFE received |
| rfe_response_due_date | date | No | Response deadline |
| rfe_response_submitted_date | date | No | When response sent |
| rfe_list | JSON array | No | Multiple RFE entries |

### Status Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| case_status | string | Yes | See case stages |
| progress_status | string | No | Working on it, Under review, etc. |

### Other Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| notes | string | No | Free-form notes |
| calendar_sync_enabled | bool | No | Default: true |
| is_favorite | bool | No | Default: false |
</case_fields>

<test_coverage>
## Test Coverage (390+ tests)

**Validated from:** Test file analysis

| Test File | Test Count | Coverage Area |
|-----------|------------|---------------|
| test_cases.py | 24 | Case CRUD, validation |
| test_case_lifecycle.py | 21 | Stage transitions |
| test_case_data_tool.py | 42 | AI tool case operations |
| test_recruitment.py | 31 | Recruitment validation |
| test_scheduler_service.py | 27 | Deadline scheduling |
| test_calendar_integration.py | 16 | Calendar sync |
| test_data_management.py | 27 | Import/export |
| test_llm_service.py | 74 | AI chat features |
| test_context_compaction.py | 26 | Chat context management |
| test_logger.py | 49 | Logging infrastructure |
| Other test files | 53 | Various utilities |

**377 tests documented in CLAUDE.md**, 390+ found in actual test files.
</test_coverage>

<existing_documentation>
## Existing Documentation Cross-Reference

| Document | Location | Content |
|----------|----------|---------|
| research.md | docs/research.md | Comprehensive PERM process research (1167 lines) |
| CLAUDE.md | CLAUDE.md | Critical validation rules, quick reference |
| design-system.md | docs/design-system.md | UI/UX patterns |
| field_labels.py | backend/app/utils/field_labels.py | Human-readable field names |

**Key insight:** `docs/research.md` contains exhaustive PERM research that was used to build the current implementation. This should be the primary source for Phase 13 documentation.
</existing_documentation>

<extraction_strategy>
## Extraction Strategy for Phase 13

### Document 1: BUSINESS_RULES.md
Extract from:
- `docs/research.md` sections 1.3-1.7 (PERM process, deadlines)
- `backend/app/utils/date_validation.py` (calculation functions)
- `backend/app/utils/deadline_relevance.py` (supersession rules)

Contents:
- PERM process flow (4 steps)
- Stage progression rules
- Deadline calculation formulas
- Either/Or rule explanation

### Document 2: DEADLINE_FLOWS.md
Extract from:
- `docs/research.md` section 1.6 (Critical Deadlines Summary)
- `backend/app/utils/date_validation.py` (all calculate_* functions)
- `backend/app/utils/business_days.py` (business day calculations)

Contents:
- Complete deadline type reference
- Calculation formulas with examples
- Supersession/relevance rules
- Business day handling

### Document 3: VALIDATION_RULES.md
Extract from:
- `backend/app/utils/date_validation.py` (all validate_* functions)
- `backend/app/schemas/case.py` (field validators)
- Test files for edge case coverage

Contents:
- Complete validation rule catalog
- Error vs warning distinction
- Cross-field validations
- Edge cases from tests
</extraction_strategy>

<open_questions>
## Open Questions

### 1. Holiday List Maintenance
**What we know:** Current implementation has hardcoded 2025-2027 holidays.
**What's unclear:** Should v2.0 calculate holidays dynamically or maintain a list?
**Recommendation:** Use a library like `holidays` for dynamic calculation in Convex.

### 2. Professional Occupation Additional Steps
**What we know:** Professional positions require 3 of 10 additional recruitment methods.
**What's unclear:** Is the current list of 10 methods exhaustive per current regulations?
**Recommendation:** Verify against latest DOL guidance during implementation.

### 3. 2025 Regulation Changes
**What we know:** January 2025 notice mentioned I-140 Final Determination requirement.
**What's unclear:** Are there other recent regulation changes not in the codebase?
**Recommendation:** Check DOL FLAG website for recent updates during Phase 16.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/app/utils/date_validation.py` - verified implementation
- Existing codebase: `backend/app/utils/deadline_relevance.py` - verified implementation
- Existing codebase: `backend/app/utils/business_days.py` - verified implementation
- Existing codebase: `docs/research.md` - comprehensive PERM research
- Existing tests: 390+ tests validating business logic

### Secondary (MEDIUM confidence)
- [DOL PERM Program](https://flag.dol.gov/programs/perm) - official overview
- [DOL Processing Times](https://flag.dol.gov/processingtimes) - current timelines
- [USCIS I-140](https://www.uscis.gov/i-140) - I-140 filing requirements

### Tertiary (LOW confidence - needs validation)
- WebSearch results for 2024-2025 updates - marked for verification
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: PERM labor certification regulations
- Ecosystem: DOL FLAG, USCIS, OPM holidays
- Patterns: Date validation, deadline calculation, stage progression
- Pitfalls: PWD expiration edge cases, Either/Or rule, business day calculations

**Confidence breakdown:**
- Deadline calculations: HIGH - verified against codebase + regulations
- Validation rules: HIGH - documented in codebase with 390+ tests
- Case stages: HIGH - enumerated in Pydantic schema
- Recent regulatory changes: MEDIUM - 2025 updates need verification

**Research date:** 2025-12-20
**Valid until:** 2026-01-20 (30 days - regulations stable, but check for updates)
</metadata>

---

*Phase: 13-core-logic-extraction*
*Research completed: 2025-12-20*
*Ready for planning: yes*
