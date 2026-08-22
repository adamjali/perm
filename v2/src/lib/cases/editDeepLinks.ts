/**
 * Edit Deep Links, maps case detail cards/timeline steps to edit form fields.
 * Single source of truth for click-to-edit navigation.
 */

import type { SectionName } from "@/hooks/useSectionState";

/** Maps timeline step field names to the edit form field to target (null = calculated, not editable) */
const TIMELINE_FIELD_MAP: Record<string, string | null> = {
  pwdFilingDate: "pwdFilingDate",
  pwdDeterminationDate: "pwdDeterminationDate",
  jobOrderStartDate: "jobOrderStartDate",
  sundayAds: "sundayAdFirstDate",
  noticeOfFilingStartDate: "noticeOfFilingStartDate",
  recruitmentEndDate: null, // calculated — not editable
  eta9089FilingDate: "eta9089FilingDate",
  eta9089CertificationDate: "eta9089CertificationDate",
  i140FilingDate: "i140FilingDate",
  i140ApprovalDate: "i140ApprovalDate",
};

export function getEditFieldForTimelineStep(
  stepField: string
): string | null {
  return TIMELINE_FIELD_MAP[stepField] ?? null;
}

export function buildEditUrl(caseId: string, field: string): string {
  return `/cases/${caseId}/edit?field=${field}`;
}

export function buildEditSectionUrl(
  caseId: string,
  section: SectionName
): string {
  return `/cases/${caseId}/edit?section=${section}`;
}
