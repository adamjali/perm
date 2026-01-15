/**
 * Recruitment Results Text Generator
 *
 * Generates DOL-compliant recruitment summary text for PERM applications.
 * Per 20 CFR 656.17(e) and standard attorney practice.
 */

import { format, parseISO, differenceInDays } from "date-fns";
import { countBusinessDays } from "../perm";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Recruitment method type configurations.
 * Maps method IDs to their display formats.
 */
export const RECRUITMENT_METHOD_TYPES: Record<
  string,
  {
    label: string;
    dateType: "single" | "range" | "multi";
    requiresOutlet: boolean;
    outletLabel?: string;
    sentenceFormat: string;
  }
> = {
  local_newspaper: {
    label: "Local/Ethnic Newspaper Ad",
    dateType: "single",
    requiresOutlet: true,
    outletLabel: "Newspaper Name",
    sentenceFormat: "{outlet} ad published on {date}",
  },
  radio_ad: {
    label: "Radio Advertisement",
    dateType: "multi",
    requiresOutlet: true,
    outletLabel: "Radio Station",
    sentenceFormat: "{outlet} broadcast on {dates}",
  },
  tv_ad: {
    label: "Television Advertisement",
    dateType: "multi",
    requiresOutlet: true,
    outletLabel: "TV Station",
    sentenceFormat: "{outlet} broadcast on {dates}",
  },
  job_fair: {
    label: "Job Fair",
    dateType: "range",
    requiresOutlet: true,
    outletLabel: "Job Fair Name",
    sentenceFormat: "{outlet} from {fromDate} to {toDate}",
  },
  campus_placement: {
    label: "Campus Placement Office",
    dateType: "range",
    requiresOutlet: true,
    outletLabel: "University Name",
    sentenceFormat: "{outlet} posting from {fromDate} to {toDate}",
  },
  trade_organization: {
    label: "Trade/Professional Organization",
    dateType: "range",
    requiresOutlet: true,
    outletLabel: "Organization Name",
    sentenceFormat: "{outlet} job posting from {fromDate} to {toDate}",
  },
  private_employment_firm: {
    label: "Private Employment Firm",
    dateType: "range",
    requiresOutlet: true,
    outletLabel: "Firm Name",
    sentenceFormat: "{outlet} listing from {fromDate} to {toDate}",
  },
  employee_referral: {
    label: "Employee Referral Program",
    dateType: "range",
    requiresOutlet: false,
    sentenceFormat: "Employee referral program from {fromDate} to {toDate}",
  },
  employer_website: {
    label: "Employer's Website",
    dateType: "range",
    requiresOutlet: false,
    sentenceFormat: "Employer's website posting from {fromDate} to {toDate}",
  },
  job_website_ad: {
    label: "Job Website Ad",
    dateType: "range",
    requiresOutlet: true,
    outletLabel: "Job Website Name",
    sentenceFormat: "{outlet} job posting from {fromDate} to {toDate}",
  },
  on_campus_recruitment: {
    label: "On-Campus Recruitment",
    dateType: "range",
    requiresOutlet: false,
    sentenceFormat: "On-campus recruiting from {fromDate} to {toDate}",
  },
};

/**
 * US State codes to full names mapping.
 */
const US_STATES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

/**
 * Case data needed for results generation.
 */
export interface RecruitmentResultsCaseData {
  // Employer info
  employerName: string;

  // Notice of Filing
  noticeOfFilingStartDate?: string;
  noticeOfFilingEndDate?: string;

  // Job Order
  jobOrderStartDate?: string;
  jobOrderEndDate?: string;
  jobOrderState?: string;

  // Sunday Ads
  sundayAdFirstDate?: string;
  sundayAdSecondDate?: string;
  sundayAdNewspaper?: string;

  // Additional recruitment methods
  additionalRecruitmentMethods?: Array<{
    method: string;
    date: string;
    description?: string;
  }>;

  // Additional recruitment date range (for methods with ranges)
  additionalRecruitmentStartDate?: string;
  additionalRecruitmentEndDate?: string;

  // Professional occupation flag
  isProfessionalOccupation: boolean;

  // Applicants count
  recruitmentApplicantsCount?: number;

  // Optional notes
  recruitmentNotes?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format date for display (e.g., "March 16, 2025")
 */
function formatDate(isoDate: string | undefined): string {
  if (!isoDate) return "[DATE PENDING]";
  try {
    return format(parseISO(isoDate), "MMMM d, yyyy");
  } catch {
    return isoDate;
  }
}

/**
 * Get full state name from code.
 */
function getStateName(stateCode: string | undefined): string {
  if (!stateCode) return "[STATE]";
  const upperCode = stateCode.toUpperCase();
  return US_STATES[upperCode] ?? stateCode;
}

/**
 * Calculate duration in days between two ISO date strings (inclusive)
 */
function calculateDurationDays(startDate: string, endDate: string): number {
  return differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
}

/**
 * Ensure a sentence starts with a capital letter and ends with a period
 */
function normalizeSentence(text: string): string {
  const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
  return capitalized.endsWith(".") ? capitalized : `${capitalized}.`;
}

/**
 * Format method sentence using config template.
 */
function formatMethodSentence(method: {
  method: string;
  date: string;
  description?: string;
}): string {
  const config = RECRUITMENT_METHOD_TYPES[method.method];

  if (!config) {
    // Fallback for unknown method types
    return method.description
      ? `${method.description} on ${formatDate(method.date)}`
      : `${method.method.replace(/_/g, " ")} on ${formatDate(method.date)}`;
  }

  let sentence = config.sentenceFormat;

  // Replace outlet placeholder with description
  if (config.requiresOutlet) {
    const outlet = method.description || `[${config.outletLabel}]`;
    sentence = sentence.replace("{outlet}", outlet);
  }

  // Replace date placeholders
  if (config.dateType === "single") {
    sentence = sentence.replace("{date}", formatDate(method.date));
  } else if (config.dateType === "range") {
    // For range types, use the method date as end date
    // (start date would come from additionalRecruitmentStartDate)
    sentence = sentence.replace("{fromDate}", formatDate(method.date));
    sentence = sentence.replace("{toDate}", formatDate(method.date));
  } else if (config.dateType === "multi") {
    sentence = sentence.replace("{dates}", formatDate(method.date));
  }

  return sentence;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generate DOL-compliant recruitment results text.
 *
 * @param data - Case data with recruitment information
 * @returns Formatted recruitment summary text
 *
 * @example
 * ```ts
 * const text = generateRecruitmentResultsText({
 *   employerName: "Acme Corp",
 *   noticeOfFilingStartDate: "2024-01-15",
 *   noticeOfFilingEndDate: "2024-01-29",
 *   // ... other fields
 * });
 * ```
 */
export function generateRecruitmentResultsText(
  data: RecruitmentResultsCaseData
): string {
  const lines: string[] = [];
  let lineNumber = 1;

  // -------------------------------------------------------------------------
  // 1. Notice of Filing
  // -------------------------------------------------------------------------
  if (data.noticeOfFilingStartDate && data.noticeOfFilingEndDate) {
    const businessDays = countBusinessDays(
      data.noticeOfFilingStartDate,
      data.noticeOfFilingEndDate
    );
    lines.push(
      `${lineNumber}. Notice of Filing was posted at ${data.employerName}'s premises from ${formatDate(data.noticeOfFilingStartDate)} to ${formatDate(data.noticeOfFilingEndDate)} (${businessDays} business days).`
    );
    lineNumber++;
  }

  // -------------------------------------------------------------------------
  // 2. Job Order / SWA
  // -------------------------------------------------------------------------
  if (data.jobOrderStartDate && data.jobOrderEndDate) {
    const stateName = getStateName(data.jobOrderState);
    const durationDays = calculateDurationDays(
      data.jobOrderStartDate,
      data.jobOrderEndDate
    );

    lines.push(
      `${lineNumber}. A job order was placed with the ${stateName} State Workforce Agency (SWA) from ${formatDate(data.jobOrderStartDate)} to ${formatDate(data.jobOrderEndDate)} (${durationDays} days).`
    );
    lineNumber++;
  }

  // -------------------------------------------------------------------------
  // 3. Sunday Newspaper Ads
  // -------------------------------------------------------------------------
  if (data.sundayAdFirstDate && data.sundayAdSecondDate) {
    const newspaper = data.sundayAdNewspaper || "[NEWSPAPER NAME]";
    lines.push(
      `${lineNumber}. Two Sunday newspaper advertisements were published in ${newspaper} on ${formatDate(data.sundayAdFirstDate)} and ${formatDate(data.sundayAdSecondDate)}.`
    );
    lineNumber++;
  }

  // -------------------------------------------------------------------------
  // 4-6. Additional Recruitment Methods (Professional Occupations)
  // -------------------------------------------------------------------------
  if (
    data.isProfessionalOccupation &&
    data.additionalRecruitmentMethods &&
    data.additionalRecruitmentMethods.length > 0
  ) {
    data.additionalRecruitmentMethods.forEach((method) => {
      const sentence = formatMethodSentence(method);
      const normalizedSentence = normalizeSentence(sentence);
      lines.push(`${lineNumber}. ${normalizedSentence}`);
      lineNumber++;
    });
  }

  // -------------------------------------------------------------------------
  // Applicants count
  // -------------------------------------------------------------------------
  const applicantCount = data.recruitmentApplicantsCount ?? 0;
  lines.push("");
  lines.push(
    `${applicantCount} applicant${applicantCount !== 1 ? "s" : ""} responded to the recruitment efforts.`
  );

  // -------------------------------------------------------------------------
  // Optional notes
  // -------------------------------------------------------------------------
  if (data.recruitmentNotes) {
    lines.push("");
    lines.push(data.recruitmentNotes);
  }

  return lines.join("\n");
}

/**
 * Get method type label for display.
 */
export function getMethodLabel(methodId: string): string {
  return (
    RECRUITMENT_METHOD_TYPES[methodId]?.label ??
    methodId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

