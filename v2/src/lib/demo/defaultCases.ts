/**
 * Default Demo Cases
 *
 * 5 demo cases representing different stages of the PERM process.
 * Uses realistic dates and calculations from the PERM business logic.
 */

import type { DemoCase, AdditionalRecruitmentMethod } from "./types";
import {
  calculatePWDExpiration,
  calculateNoticeOfFilingEnd,
  calculateJobOrderEnd,
  ETA9089_EXPIRATION_DAYS,
} from "@/lib/perm";
import { format, subDays, addDays, parseISO } from "date-fns";

// ============================================================================
// Date Helpers
// ============================================================================

/**
 * Get a date relative to today.
 */
function daysFromToday(days: number): string {
  const date = days >= 0 ? addDays(new Date(), days) : subDays(new Date(), Math.abs(days));
  return format(date, "yyyy-MM-dd");
}

/**
 * Find the next Sunday from a given date.
 */
function nextSunday(dateStr: string): string {
  const date = parseISO(dateStr);
  const dayOfWeek = date.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  return format(addDays(date, daysUntilSunday), "yyyy-MM-dd");
}

/**
 * Find a Sunday after a given date with offset.
 */
function sundayAfter(dateStr: string, weeksAfter: number = 0): string {
  const firstSunday = nextSunday(dateStr);
  if (weeksAfter === 0) return firstSunday;
  return format(addDays(parseISO(firstSunday), weeksAfter * 7), "yyyy-MM-dd");
}

/**
 * Calculate ETA 9089 expiration from certification date.
 * Adds 180 days to the certification date.
 */
function calculateETA9089ExpirationString(certificationDateStr: string): string {
  const date = parseISO(certificationDateStr);
  return format(addDays(date, ETA9089_EXPIRATION_DAYS), "yyyy-MM-dd");
}

// ============================================================================
// Fixed Timestamp for Demo Cases
// ============================================================================

const DEMO_CREATED_AT = "2024-01-01T00:00:00.000Z";

// ============================================================================
// Case 1: PWD Stage - "Acme Corp / John Smith"
// ============================================================================

function createCase1(): DemoCase {
  // PWD filed 2 weeks ago, determination received 1 week ago
  const pwdFilingDate = daysFromToday(-14);
  const pwdDeterminationDate = daysFromToday(-7);
  const pwdExpirationDate = calculatePWDExpiration(pwdDeterminationDate);

  return {
    id: "demo_case_001",
    beneficiaryName: "John Smith",
    employerName: "Acme Corp",
    status: "pwd",
    progressStatus: "working",
    pwdFilingDate,
    pwdDeterminationDate,
    pwdExpirationDate,
    isProfessionalOccupation: false,
    isFavorite: false,
    notes: "Standard non-professional case. Ready to begin recruitment.",
    createdAt: DEMO_CREATED_AT,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Case 2: Recruitment Stage - "Tech Solutions / Maria Garcia"
// ============================================================================

function createCase2(): DemoCase {
  // PWD determined 60 days ago, recruitment started 30 days ago
  const pwdFilingDate = daysFromToday(-75);
  const pwdDeterminationDate = daysFromToday(-60);
  const pwdExpirationDate = calculatePWDExpiration(pwdDeterminationDate);

  // Recruitment started 30 days ago
  const recruitmentStartDate = daysFromToday(-30);
  const noticeOfFilingStartDate = recruitmentStartDate;
  const noticeOfFilingEndDate = calculateNoticeOfFilingEnd(noticeOfFilingStartDate);
  const jobOrderStartDate = daysFromToday(-28);
  const jobOrderEndDate = calculateJobOrderEnd(jobOrderStartDate);

  // Sunday ads
  const sundayAdFirstDate = sundayAfter(recruitmentStartDate, 0);
  const sundayAdSecondDate = sundayAfter(sundayAdFirstDate, 1);

  // Additional recruitment for professional occupation
  const additionalRecruitmentMethods: AdditionalRecruitmentMethod[] = [
    {
      method: "Professional Organization",
      date: daysFromToday(-25),
      description: "Posted on IEEE Job Site",
    },
    {
      method: "Job Fair",
      date: daysFromToday(-20),
      description: "Local tech job fair",
    },
    {
      method: "Campus Recruitment",
      date: daysFromToday(-18),
      description: "MIT career services posting",
    },
  ];

  return {
    id: "demo_case_002",
    beneficiaryName: "Maria Garcia",
    employerName: "Tech Solutions",
    status: "recruitment",
    progressStatus: "working",
    pwdFilingDate,
    pwdDeterminationDate,
    pwdExpirationDate,
    recruitmentStartDate,
    noticeOfFilingStartDate,
    noticeOfFilingEndDate,
    jobOrderStartDate,
    jobOrderEndDate,
    sundayAdFirstDate,
    sundayAdSecondDate,
    isProfessionalOccupation: true,
    additionalRecruitmentMethods,
    isFavorite: true,
    notes: "Software Engineer position. Professional occupation with 3 additional recruitment methods completed.",
    createdAt: DEMO_CREATED_AT,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Case 3: ETA 9089 Stage - "Global Inc / Wei Chen"
// ============================================================================

function createCase3(): DemoCase {
  // PWD from 6 months ago
  const pwdFilingDate = daysFromToday(-200);
  const pwdDeterminationDate = daysFromToday(-185);
  const pwdExpirationDate = calculatePWDExpiration(pwdDeterminationDate);

  // Recruitment completed 2 months ago
  const recruitmentStartDate = daysFromToday(-150);
  const noticeOfFilingStartDate = recruitmentStartDate;
  const noticeOfFilingEndDate = calculateNoticeOfFilingEnd(noticeOfFilingStartDate);
  const jobOrderStartDate = daysFromToday(-148);
  const jobOrderEndDate = calculateJobOrderEnd(jobOrderStartDate);
  const sundayAdFirstDate = sundayAfter(recruitmentStartDate, 0);
  const sundayAdSecondDate = sundayAfter(sundayAdFirstDate, 1);
  const recruitmentEndDate = daysFromToday(-90);

  // ETA 9089 filed 45 days ago (within the 30-180 day window after recruitment end)
  const eta9089FilingDate = daysFromToday(-45);

  return {
    id: "demo_case_003",
    beneficiaryName: "Wei Chen",
    employerName: "Global Inc",
    status: "eta9089",
    progressStatus: "filed",
    pwdFilingDate,
    pwdDeterminationDate,
    pwdExpirationDate,
    recruitmentStartDate,
    recruitmentEndDate,
    noticeOfFilingStartDate,
    noticeOfFilingEndDate,
    jobOrderStartDate,
    jobOrderEndDate,
    sundayAdFirstDate,
    sundayAdSecondDate,
    isProfessionalOccupation: false,
    eta9089FilingDate,
    isFavorite: false,
    notes: "ETA 9089 filed, awaiting DOL certification. Standard processing time 6-12 months.",
    createdAt: DEMO_CREATED_AT,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Case 4: I-140 Stage - "Startup Labs / Raj Patel"
// ============================================================================

function createCase4(): DemoCase {
  // Full history - older case
  const pwdFilingDate = daysFromToday(-400);
  const pwdDeterminationDate = daysFromToday(-385);
  const pwdExpirationDate = calculatePWDExpiration(pwdDeterminationDate);

  // Recruitment
  const recruitmentStartDate = daysFromToday(-350);
  const noticeOfFilingStartDate = recruitmentStartDate;
  const noticeOfFilingEndDate = calculateNoticeOfFilingEnd(noticeOfFilingStartDate);
  const jobOrderStartDate = daysFromToday(-348);
  const jobOrderEndDate = calculateJobOrderEnd(jobOrderStartDate);
  const sundayAdFirstDate = sundayAfter(recruitmentStartDate, 0);
  const sundayAdSecondDate = sundayAfter(sundayAdFirstDate, 1);
  const recruitmentEndDate = daysFromToday(-280);

  // ETA 9089 filed and certified
  const eta9089FilingDate = daysFromToday(-240);
  const eta9089CertificationDate = daysFromToday(-120);
  const eta9089ExpirationDate = calculateETA9089ExpirationString(eta9089CertificationDate);

  // I-140 filed recently (within 180 days of certification)
  const i140FilingDate = daysFromToday(-30);

  // Additional recruitment for professional occupation
  const additionalRecruitmentMethods: AdditionalRecruitmentMethod[] = [
    {
      method: "Employee Referral",
      date: daysFromToday(-340),
      description: "Internal employee referral program",
    },
    {
      method: "LinkedIn",
      date: daysFromToday(-335),
      description: "LinkedIn job posting",
    },
    {
      method: "Company Website",
      date: daysFromToday(-345),
      description: "Posted on company careers page",
    },
  ];

  return {
    id: "demo_case_004",
    beneficiaryName: "Raj Patel",
    employerName: "Startup Labs",
    status: "i140",
    progressStatus: "filed",
    pwdFilingDate,
    pwdDeterminationDate,
    pwdExpirationDate,
    recruitmentStartDate,
    recruitmentEndDate,
    noticeOfFilingStartDate,
    noticeOfFilingEndDate,
    jobOrderStartDate,
    jobOrderEndDate,
    sundayAdFirstDate,
    sundayAdSecondDate,
    isProfessionalOccupation: true,
    additionalRecruitmentMethods,
    eta9089FilingDate,
    eta9089CertificationDate,
    eta9089ExpirationDate,
    i140FilingDate,
    isFavorite: true,
    notes: "I-140 filed with premium processing. Data Scientist position, EB-2 category.",
    createdAt: DEMO_CREATED_AT,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Case 5: Complete - "Enterprise Co / Anna Kowalski"
// ============================================================================

function createCase5(): DemoCase {
  // Completed case - all stages done
  const pwdFilingDate = daysFromToday(-500);
  const pwdDeterminationDate = daysFromToday(-485);
  const pwdExpirationDate = calculatePWDExpiration(pwdDeterminationDate);

  // Recruitment
  const recruitmentStartDate = daysFromToday(-450);
  const noticeOfFilingStartDate = recruitmentStartDate;
  const noticeOfFilingEndDate = calculateNoticeOfFilingEnd(noticeOfFilingStartDate);
  const jobOrderStartDate = daysFromToday(-448);
  const jobOrderEndDate = calculateJobOrderEnd(jobOrderStartDate);
  const sundayAdFirstDate = sundayAfter(recruitmentStartDate, 0);
  const sundayAdSecondDate = sundayAfter(sundayAdFirstDate, 1);
  const recruitmentEndDate = daysFromToday(-380);

  // ETA 9089
  const eta9089FilingDate = daysFromToday(-340);
  const eta9089CertificationDate = daysFromToday(-220);
  const eta9089ExpirationDate = calculateETA9089ExpirationString(eta9089CertificationDate);

  // I-140 filed and approved
  const i140FilingDate = daysFromToday(-180);
  const i140ApprovalDate = daysFromToday(-60);

  return {
    id: "demo_case_005",
    beneficiaryName: "Anna Kowalski",
    employerName: "Enterprise Co",
    status: "closed",
    progressStatus: "approved",
    pwdFilingDate,
    pwdDeterminationDate,
    pwdExpirationDate,
    recruitmentStartDate,
    recruitmentEndDate,
    noticeOfFilingStartDate,
    noticeOfFilingEndDate,
    jobOrderStartDate,
    jobOrderEndDate,
    sundayAdFirstDate,
    sundayAdSecondDate,
    isProfessionalOccupation: false,
    eta9089FilingDate,
    eta9089CertificationDate,
    eta9089ExpirationDate,
    i140FilingDate,
    i140ApprovalDate,
    isFavorite: false,
    notes: "PERM process complete! I-140 approved. Ready for I-485/Consular Processing.",
    createdAt: DEMO_CREATED_AT,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Export Default Cases
// ============================================================================

/**
 * Default demo cases representing all stages of the PERM process.
 *
 * Cases:
 * 1. "Acme Corp / John Smith" - PWD stage, working
 * 2. "Tech Solutions / Maria Garcia" - Recruitment stage, working (professional)
 * 3. "Global Inc / Wei Chen" - ETA 9089 stage, filed
 * 4. "Startup Labs / Raj Patel" - I-140 stage, filed (professional)
 * 5. "Enterprise Co / Anna Kowalski" - Complete (approved)
 */
export const DEFAULT_DEMO_CASES: DemoCase[] = [
  createCase1(),
  createCase2(),
  createCase3(),
  createCase4(),
  createCase5(),
];

/**
 * Get a fresh copy of default demo cases.
 * Useful when you need to ensure dates are recalculated relative to "today".
 */
export function getDefaultDemoCases(): DemoCase[] {
  return [
    createCase1(),
    createCase2(),
    createCase3(),
    createCase4(),
    createCase5(),
  ];
}
