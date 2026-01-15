/**
 * Dashboard Test Fixtures
 * Reusable test data for dashboard testing.
 *
 * Provides:
 * - TestCaseData type matching schema.ts cases table
 * - createTestCase() factory with sensible defaults
 * - Pre-built scenario fixtures for all stages
 * - Date helper functions
 */

// Note: No imports from Convex needed since fixtures don't include system fields

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Format Date as ISO string (YYYY-MM-DD) in UTC.
 *
 * Uses UTC date components to ensure consistent date strings regardless
 * of local timezone. This is important for tests that interact with
 * backend functions that use UTC-based date calculations.
 */
export function formatISO(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as ISO string (UTC)
 */
export function today(): string {
  return formatISO(new Date());
}

/**
 * Add days to a date (UTC-based)
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Get date N days from now as ISO string (UTC-based)
 *
 * Uses UTC to match the backend's date calculation which uses
 * `new Date().setUTCHours(0, 0, 0, 0)` for "today".
 */
export function daysFromNow(days: number): string {
  return formatISO(addDays(new Date(), days));
}

/**
 * Get date N days ago as ISO string (UTC-based)
 */
export function daysAgo(days: number): string {
  return formatISO(addDays(new Date(), -days));
}

/**
 * Get the last Sunday on or before N days ago.
 * Use for sundayAdFirstDate and sundayAdSecondDate.
 */
export function lastSundayBeforeDaysAgo(daysAgoApprox: number): string {
  const targetDate = addDays(new Date(), -daysAgoApprox);
  // Sunday = 0, so we subtract the day of week to get to the last Sunday
  const dayOfWeek = targetDate.getUTCDay();
  const sunday = addDays(targetDate, -dayOfWeek);
  return formatISO(sunday);
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Test case data matching schema.ts cases table.
 * Note: userId, createdAt, updatedAt, deletedAt are managed internally
 * by the create/update mutations and should not be passed as args.
 */
export interface TestCaseData {
  // Core identity (userId is set by mutation from auth context)
  caseNumber?: string;
  internalCaseNumber?: string;

  // Employer info
  employerName: string;
  employerFein?: string;

  // Beneficiary info
  beneficiaryIdentifier: string;

  // Position info
  positionTitle: string;
  jobTitle?: string;
  socCode?: string;
  socTitle?: string;
  jobOrderState?: string;

  // Case status (two-tier system)
  caseStatus: "pwd" | "recruitment" | "eta9089" | "i140" | "closed";
  progressStatus:
    | "working"
    | "waiting_intake"
    | "filed"
    | "approved"
    | "under_review"
    | "rfi_rfe";
  progressStatusOverride?: boolean;

  // PWD phase
  pwdFilingDate?: string;
  pwdDeterminationDate?: string;
  pwdExpirationDate?: string;
  pwdCaseNumber?: string;
  pwdWageAmount?: number;
  pwdWageLevel?: string;

  // Recruitment - Job Order
  jobOrderStartDate?: string;
  jobOrderEndDate?: string;

  // Recruitment - Sunday Ads
  sundayAdFirstDate?: string;
  sundayAdSecondDate?: string;
  sundayAdNewspaper?: string;

  // Recruitment - Additional Methods
  additionalRecruitmentStartDate?: string;
  additionalRecruitmentEndDate?: string;
  additionalRecruitmentMethods: Array<{
    method: string;
    date: string;
    description?: string;
  }>;
  recruitmentNotes?: string;
  recruitmentApplicantsCount: number;
  recruitmentSummaryCustom?: string;

  // Professional occupation
  isProfessionalOccupation: boolean;

  // Notice of Filing
  noticeOfFilingStartDate?: string;
  noticeOfFilingEndDate?: string;

  // ETA 9089
  eta9089FilingDate?: string;
  eta9089AuditDate?: string;
  eta9089CertificationDate?: string;
  eta9089ExpirationDate?: string;
  eta9089CaseNumber?: string;

  // RFI/RFE entries (arrays)
  rfiEntries: Array<{
    id: string;
    title?: string;
    description?: string;
    notes?: string;
    receivedDate: string;
    responseDueDate: string;
    responseSubmittedDate?: string;
    createdAt: number;
  }>;
  rfeEntries: Array<{
    id: string;
    title?: string;
    description?: string;
    notes?: string;
    receivedDate: string;
    responseDueDate: string;
    responseSubmittedDate?: string;
    createdAt: number;
  }>;

  // I-140
  i140FilingDate?: string;
  i140ReceiptDate?: string;
  i140ReceiptNumber?: string;
  i140ApprovalDate?: string;
  i140DenialDate?: string;

  // Organization & Metadata
  priorityLevel: "low" | "normal" | "high" | "urgent";
  isFavorite: boolean;
  notes?: Array<{
    id: string;
    content: string;
    createdAt: number;
    status: "pending" | "done" | "deleted";
  }>;
  tags: string[];

  // Calendar integration
  calendarEventIds?: Record<string, string>;
  calendarSyncEnabled: boolean;

  // Document attachments
  documents: Array<{
    id: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
    uploadedAt: number;
  }>;

  // Note: createdAt, updatedAt, deletedAt are managed by the mutation
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create test case with sensible defaults.
 * All overrides are optional - factory provides complete valid data.
 * Note: userId, createdAt, updatedAt, deletedAt are set by the mutation.
 */
export function createTestCase(
  overrides: Partial<TestCaseData> = {}
): TestCaseData {
  const baseCase: TestCaseData = {
    // Core identity
    caseNumber: undefined,
    internalCaseNumber: undefined,

    // Employer info
    employerName: "Test Company Inc.",
    employerFein: undefined,

    // Beneficiary info
    beneficiaryIdentifier: "TEST-001",

    // Position info
    positionTitle: "Software Engineer",
    jobTitle: undefined,
    socCode: undefined,
    socTitle: undefined,
    jobOrderState: undefined,

    // Case status
    caseStatus: "pwd",
    progressStatus: "working",
    // Will be set to true below if caseStatus is overridden to non-pwd
    progressStatusOverride: false,

    // PWD phase
    pwdFilingDate: undefined,
    pwdDeterminationDate: undefined,
    pwdExpirationDate: undefined,
    pwdCaseNumber: undefined,
    pwdWageAmount: undefined,
    pwdWageLevel: undefined,

    // Recruitment - Job Order
    jobOrderStartDate: undefined,
    jobOrderEndDate: undefined,

    // Recruitment - Sunday Ads
    sundayAdFirstDate: undefined,
    sundayAdSecondDate: undefined,
    sundayAdNewspaper: undefined,

    // Recruitment - Additional Methods
    additionalRecruitmentStartDate: undefined,
    additionalRecruitmentEndDate: undefined,
    additionalRecruitmentMethods: [],
    recruitmentNotes: undefined,
    recruitmentApplicantsCount: 0,
    recruitmentSummaryCustom: undefined,

    // Professional occupation
    isProfessionalOccupation: false,

    // Notice of Filing
    noticeOfFilingStartDate: undefined,
    noticeOfFilingEndDate: undefined,

    // ETA 9089
    eta9089FilingDate: undefined,
    eta9089AuditDate: undefined,
    eta9089CertificationDate: undefined,
    eta9089ExpirationDate: undefined,
    eta9089CaseNumber: undefined,

    // RFI/RFE entries (arrays)
    rfiEntries: [],
    rfeEntries: [],

    // I-140
    i140FilingDate: undefined,
    i140ReceiptDate: undefined,
    i140ReceiptNumber: undefined,
    i140ApprovalDate: undefined,
    i140DenialDate: undefined,

    // Organization & Metadata
    priorityLevel: "normal",
    isFavorite: false,
    notes: undefined,
    tags: [],

    // Calendar integration
    calendarEventIds: undefined,
    calendarSyncEnabled: false,

    // Document attachments
    documents: [],
  };

  const result = { ...baseCase, ...overrides };
  // Always enable progressStatusOverride for fixtures
  // This is required because the create mutation auto-calculates status
  // based on dates, which would override the intended test caseStatus
  result.progressStatusOverride = true;
  return result;
}

// ============================================================================
// PRE-BUILT SCENARIO FIXTURES
// ============================================================================

/**
 * PWD Stage Fixtures
 */
export const pwdFixtures = {
  /**
   * PWD stage - actively working (no dates yet)
   */
  pwdWorking: (): TestCaseData =>
    createTestCase({
      employerName: "TechCorp LLC",
      beneficiaryIdentifier: "PWD-WORKING-001",
      positionTitle: "Senior Software Engineer",
      caseStatus: "pwd",
      progressStatus: "working",
      priorityLevel: "normal",
    }),

  /**
   * PWD stage - filed and has expiration date
   */
  pwdWithExpiration: (): TestCaseData =>
    createTestCase({
      employerName: "DataSoft Inc.",
      beneficiaryIdentifier: "PWD-FILED-001",
      positionTitle: "Data Scientist",
      caseStatus: "pwd",
      progressStatus: "filed",
      pwdFilingDate: daysAgo(60),
      pwdDeterminationDate: daysAgo(30),
      pwdExpirationDate: daysFromNow(300), // ~10 months away
      pwdCaseNumber: "P-2024-TEST-001",
      pwdWageAmount: 12500000, // $125,000.00 in cents
      pwdWageLevel: "Level III",
      priorityLevel: "normal",
    }),

  /**
   * PWD stage - expiring soon (urgent)
   */
  pwdExpiringSoon: (): TestCaseData =>
    createTestCase({
      employerName: "FinTech Solutions",
      beneficiaryIdentifier: "PWD-EXPIRING-001",
      positionTitle: "Financial Analyst",
      caseStatus: "pwd",
      progressStatus: "filed",
      pwdFilingDate: daysAgo(330),
      pwdDeterminationDate: daysAgo(300),
      pwdExpirationDate: daysFromNow(15), // Expiring in 15 days!
      pwdCaseNumber: "P-2023-TEST-002",
      pwdWageAmount: 9500000, // $95,000.00
      pwdWageLevel: "Level II",
      priorityLevel: "urgent",
      isFavorite: true,
    }),
};

/**
 * Recruitment Stage Fixtures
 */
export const recruitmentFixtures = {
  /**
   * Recruitment stage - actively recruiting
   */
  recruitmentActive: (): TestCaseData =>
    createTestCase({
      employerName: "Healthcare Partners",
      beneficiaryIdentifier: "REC-ACTIVE-001",
      positionTitle: "Registered Nurse",
      caseStatus: "recruitment",
      progressStatus: "working",
      pwdFilingDate: daysAgo(150),
      pwdDeterminationDate: daysAgo(120),
      pwdExpirationDate: daysFromNow(210),
      jobOrderStartDate: daysAgo(35),
      jobOrderEndDate: daysAgo(5),
      sundayAdFirstDate: lastSundayBeforeDaysAgo(20),
      sundayAdSecondDate: lastSundayBeforeDaysAgo(13),
      sundayAdNewspaper: "The Daily Times",
      additionalRecruitmentMethods: [
        {
          method: "Company website",
          date: daysAgo(30),
          description: "Posted on careers page",
        },
        {
          method: "Professional journal",
          date: daysAgo(25),
          description: "Nursing Today Magazine",
        },
      ],
      recruitmentApplicantsCount: 12,
      isProfessionalOccupation: true,
      priorityLevel: "high",
    }),

  /**
   * Recruitment stage - recruitment complete, ready for ETA 9089
   */
  recruitmentComplete: (): TestCaseData =>
    createTestCase({
      employerName: "Engineering Firm LLC",
      beneficiaryIdentifier: "REC-COMPLETE-001",
      positionTitle: "Civil Engineer",
      caseStatus: "recruitment",
      progressStatus: "approved",
      pwdFilingDate: daysAgo(180),
      pwdDeterminationDate: daysAgo(150),
      pwdExpirationDate: daysFromNow(180),
      jobOrderStartDate: daysAgo(90),
      jobOrderEndDate: daysAgo(60),
      sundayAdFirstDate: lastSundayBeforeDaysAgo(75),
      sundayAdSecondDate: lastSundayBeforeDaysAgo(68),
      sundayAdNewspaper: "City Chronicle",
      additionalRecruitmentStartDate: daysAgo(85),
      additionalRecruitmentEndDate: daysAgo(55),
      additionalRecruitmentMethods: [
        {
          method: "Job fair",
          date: daysAgo(70),
        },
        {
          method: "Campus recruitment",
          date: daysAgo(65),
        },
        {
          method: "Employee referral program",
          date: daysAgo(60),
        },
      ],
      noticeOfFilingStartDate: daysAgo(90),
      noticeOfFilingEndDate: daysAgo(74), // 16 calendar days = 11+ business days (ensures at least 10)
      recruitmentApplicantsCount: 8,
      recruitmentSummaryCustom: "Completed all required recruitment steps",
      isProfessionalOccupation: true,
      priorityLevel: "high",
    }),
};

/**
 * ETA 9089 Stage Fixtures
 */
export const eta9089Fixtures = {
  /**
   * ETA 9089 - filed and pending
   */
  eta9089Pending: (): TestCaseData =>
    createTestCase({
      employerName: "BioTech Research Inc.",
      beneficiaryIdentifier: "ETA-PENDING-001",
      positionTitle: "Research Scientist",
      caseStatus: "eta9089",
      progressStatus: "filed",
      pwdFilingDate: daysAgo(250),
      pwdDeterminationDate: daysAgo(220),
      pwdExpirationDate: daysFromNow(110),
      jobOrderStartDate: daysAgo(150),
      jobOrderEndDate: daysAgo(120),
      eta9089FilingDate: daysAgo(90),
      eta9089CaseNumber: "A-2024-TEST-003",
      recruitmentApplicantsCount: 15,
      isProfessionalOccupation: true,
      priorityLevel: "normal",
    }),

  /**
   * ETA 9089 - received RFI (30-day strict deadline)
   */
  eta9089WithRFI: (): TestCaseData =>
    createTestCase({
      employerName: "Manufacturing Corp",
      beneficiaryIdentifier: "ETA-RFI-001",
      positionTitle: "Production Manager",
      caseStatus: "eta9089",
      progressStatus: "rfi_rfe",
      pwdFilingDate: daysAgo(280),
      pwdDeterminationDate: daysAgo(250),
      pwdExpirationDate: daysFromNow(80),
      eta9089FilingDate: daysAgo(120),
      eta9089CaseNumber: "A-2024-TEST-004",
      rfiEntries: [
        {
          id: "rfi-1",
          receivedDate: daysAgo(10),
          responseDueDate: daysFromNow(20), // 30 days from receipt
          createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
        },
      ],
      recruitmentApplicantsCount: 6,
      isProfessionalOccupation: false,
      priorityLevel: "urgent",
      isFavorite: true,
    }),

  /**
   * ETA 9089 - certified
   */
  eta9089Certified: (): TestCaseData =>
    createTestCase({
      employerName: "Consulting Group LLC",
      beneficiaryIdentifier: "ETA-CERT-001",
      positionTitle: "Management Consultant",
      caseStatus: "eta9089",
      progressStatus: "approved",
      pwdFilingDate: daysAgo(300),
      pwdDeterminationDate: daysAgo(270),
      pwdExpirationDate: daysFromNow(60),
      eta9089FilingDate: daysAgo(150),
      eta9089CertificationDate: daysAgo(30),
      eta9089ExpirationDate: daysFromNow(150), // 180 days from certification
      eta9089CaseNumber: "A-2024-TEST-005",
      recruitmentApplicantsCount: 9,
      isProfessionalOccupation: true,
      priorityLevel: "high",
    }),
};

/**
 * I-140 Stage Fixtures
 */
export const i140Fixtures = {
  /**
   * I-140 - filed and pending
   */
  i140Pending: (): TestCaseData =>
    createTestCase({
      employerName: "Tech Innovations Inc.",
      beneficiaryIdentifier: "I140-PENDING-001",
      positionTitle: "Systems Architect",
      caseStatus: "i140",
      progressStatus: "filed",
      pwdFilingDate: daysAgo(350),
      pwdDeterminationDate: daysAgo(320),
      pwdExpirationDate: daysAgo(20), // Already expired (not relevant for I-140)
      eta9089FilingDate: daysAgo(200),
      eta9089CertificationDate: daysAgo(80),
      eta9089ExpirationDate: daysFromNow(100),
      i140FilingDate: daysAgo(60),
      i140ReceiptDate: daysAgo(55),
      i140ReceiptNumber: "WAC2412345678",
      recruitmentApplicantsCount: 11,
      isProfessionalOccupation: true,
      priorityLevel: "normal",
    }),

  /**
   * I-140 - received RFE (editable due date)
   */
  i140WithRFE: (): TestCaseData =>
    createTestCase({
      employerName: "Digital Media Co.",
      beneficiaryIdentifier: "I140-RFE-001",
      positionTitle: "Creative Director",
      caseStatus: "i140",
      progressStatus: "rfi_rfe",
      pwdFilingDate: daysAgo(380),
      pwdDeterminationDate: daysAgo(350),
      pwdExpirationDate: daysAgo(50),
      eta9089FilingDate: daysAgo(230),
      eta9089CertificationDate: daysAgo(110),
      eta9089ExpirationDate: daysFromNow(70),
      i140FilingDate: daysAgo(90),
      i140ReceiptDate: daysAgo(85),
      i140ReceiptNumber: "LIN2498765432",
      rfeEntries: [
        {
          id: "rfe-1",
          receivedDate: daysAgo(15),
          responseDueDate: daysFromNow(72), // 87 days from receipt (user set)
          createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
        },
      ],
      recruitmentApplicantsCount: 7,
      isProfessionalOccupation: true,
      priorityLevel: "urgent",
      tags: ["needs_evidence", "urgent_rfe"],
    }),

  /**
   * I-140 - approved
   */
  i140Approved: (): TestCaseData =>
    createTestCase({
      employerName: "Global Services Ltd.",
      beneficiaryIdentifier: "I140-APPROVED-001",
      positionTitle: "Project Manager",
      caseStatus: "i140",
      progressStatus: "approved",
      pwdFilingDate: daysAgo(400),
      pwdDeterminationDate: daysAgo(370),
      pwdExpirationDate: daysAgo(70),
      eta9089FilingDate: daysAgo(250),
      eta9089CertificationDate: daysAgo(130),
      eta9089ExpirationDate: daysFromNow(50),
      i140FilingDate: daysAgo(110),
      i140ReceiptDate: daysAgo(105),
      i140ReceiptNumber: "SRC2487654321",
      i140ApprovalDate: daysAgo(10),
      recruitmentApplicantsCount: 5,
      isProfessionalOccupation: true,
      priorityLevel: "normal",
      isFavorite: true,
      tags: ["success", "priority_date_locked"],
    }),
};

/**
 * Special Cases Fixtures
 */
export const specialFixtures = {
  /**
   * Closed case
   */
  closedCase: (): TestCaseData =>
    createTestCase({
      employerName: "Archived Corp",
      beneficiaryIdentifier: "CLOSED-001",
      positionTitle: "Business Analyst",
      caseStatus: "closed",
      progressStatus: "approved",
      pwdFilingDate: daysAgo(500),
      pwdDeterminationDate: daysAgo(470),
      pwdExpirationDate: daysAgo(170),
      eta9089FilingDate: daysAgo(350),
      eta9089CertificationDate: daysAgo(230),
      i140FilingDate: daysAgo(200),
      i140ApprovalDate: daysAgo(100),
      recruitmentApplicantsCount: 4,
      isProfessionalOccupation: true,
      priorityLevel: "low",
      tags: ["archived", "completed"],
    }),

  /**
   * Case with overdue deadline (RFI about to expire)
   */
  overdueDeadline: (): TestCaseData =>
    createTestCase({
      employerName: "Urgent Matters Inc.",
      beneficiaryIdentifier: "OVERDUE-001",
      positionTitle: "Operations Manager",
      caseStatus: "eta9089",
      progressStatus: "rfi_rfe",
      pwdFilingDate: daysAgo(290),
      pwdDeterminationDate: daysAgo(260),
      pwdExpirationDate: daysFromNow(70),
      eta9089FilingDate: daysAgo(130),
      eta9089CaseNumber: "A-2024-OVERDUE-001",
      rfiEntries: [
        {
          id: "rfi-overdue",
          receivedDate: daysAgo(28),
          responseDueDate: daysFromNow(2), // Due in 2 days!
          createdAt: Date.now() - 28 * 24 * 60 * 60 * 1000,
        },
      ],
      recruitmentApplicantsCount: 10,
      isProfessionalOccupation: true,
      priorityLevel: "urgent",
      isFavorite: true,
      tags: ["urgent", "rfi_deadline"],
    }),
};

/**
 * All fixtures organized by category
 */
export const fixtures = {
  pwd: pwdFixtures,
  recruitment: recruitmentFixtures,
  eta9089: eta9089Fixtures,
  i140: i140Fixtures,
  special: specialFixtures,
};
