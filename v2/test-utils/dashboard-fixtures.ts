/** Format Date as ISO string (YYYY-MM-DD) in UTC */
export function formatISO(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function today(): string { return formatISO(new Date()); }

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function daysFromNow(days: number): string { return formatISO(addDays(new Date(), days)); }
export function daysAgo(days: number): string { return formatISO(addDays(new Date(), -days)); }

export function lastSundayBeforeDaysAgo(daysAgoApprox: number): string {
  const targetDate = addDays(new Date(), -daysAgoApprox);
  const sunday = addDays(targetDate, -targetDate.getUTCDay());
  return formatISO(sunday);
}

/** Test case data matching schema.ts cases table (userId/timestamps managed by mutations) */
export interface TestCaseData {
  caseNumber?: string;
  internalCaseNumber?: string;
  employerName: string;
  employerFein?: string;
  beneficiaryIdentifier: string;
  positionTitle: string;
  jobTitle?: string;
  socCode?: string;
  socTitle?: string;
  jobOrderState?: string;
  caseStatus: "pwd" | "recruitment" | "eta9089" | "i140" | "closed";
  progressStatus: "working" | "waiting_intake" | "filed" | "approved" | "under_review" | "rfi_rfe";
  progressStatusOverride?: boolean;
  pwdFilingDate?: string;
  pwdDeterminationDate?: string;
  pwdExpirationDate?: string;
  pwdCaseNumber?: string;
  pwdWageAmount?: number;
  pwdWageLevel?: string;
  jobOrderStartDate?: string;
  jobOrderEndDate?: string;
  sundayAdFirstDate?: string;
  sundayAdSecondDate?: string;
  sundayAdNewspaper?: string;
  additionalRecruitmentStartDate?: string;
  additionalRecruitmentEndDate?: string;
  additionalRecruitmentMethods: Array<{ method: string; date: string; description?: string }>;
  recruitmentNotes?: string;
  recruitmentApplicantsCount: number;
  recruitmentSummaryCustom?: string;
  isProfessionalOccupation: boolean;
  noticeOfFilingStartDate?: string;
  noticeOfFilingEndDate?: string;
  eta9089FilingDate?: string;
  eta9089AuditDate?: string;
  eta9089CertificationDate?: string;
  eta9089ExpirationDate?: string;
  eta9089CaseNumber?: string;
  rfiEntries: Array<{ id: string; title?: string; description?: string; notes?: string; receivedDate: string; responseDueDate: string; responseSubmittedDate?: string; createdAt: number }>;
  rfeEntries: Array<{ id: string; title?: string; description?: string; notes?: string; receivedDate: string; responseDueDate: string; responseSubmittedDate?: string; createdAt: number }>;
  i140FilingDate?: string;
  i140ReceiptDate?: string;
  i140ReceiptNumber?: string;
  i140ApprovalDate?: string;
  i140DenialDate?: string;
  priorityLevel: "low" | "normal" | "high" | "urgent";
  isFavorite: boolean;
  notes?: Array<{ id: string; content: string; createdAt: number; status: "pending" | "done" | "deleted" }>;
  tags: string[];
  calendarEventIds?: Record<string, string>;
  calendarSyncEnabled: boolean;
  documents: Array<{ id: string; name: string; url: string; mimeType: string; size: number; uploadedAt: number }>;
}

/** Create test case with sensible defaults. progressStatusOverride always true for fixtures. */
export function createTestCase(overrides: Partial<TestCaseData> = {}): TestCaseData {
  return {
    employerName: "Test Company Inc.",
    beneficiaryIdentifier: "TEST-001",
    positionTitle: "Software Engineer",
    caseStatus: "pwd",
    progressStatus: "working",
    additionalRecruitmentMethods: [],
    recruitmentApplicantsCount: 0,
    isProfessionalOccupation: false,
    rfiEntries: [],
    rfeEntries: [],
    priorityLevel: "normal",
    isFavorite: false,
    tags: [],
    calendarSyncEnabled: false,
    documents: [],
    ...overrides,
    progressStatusOverride: true,
  };
}

export const pwdFixtures = {
  pwdWorking: (): TestCaseData =>
    createTestCase({
      employerName: "TechCorp LLC", beneficiaryIdentifier: "PWD-WORKING-001",
      positionTitle: "Senior Software Engineer", caseStatus: "pwd", progressStatus: "working",
    }),

  pwdWithExpiration: (): TestCaseData =>
    createTestCase({
      employerName: "DataSoft Inc.", beneficiaryIdentifier: "PWD-FILED-001",
      positionTitle: "Data Scientist", caseStatus: "pwd", progressStatus: "filed",
      pwdFilingDate: daysAgo(60), pwdDeterminationDate: daysAgo(30),
      pwdExpirationDate: daysFromNow(300), pwdCaseNumber: "P-2024-TEST-001",
      pwdWageAmount: 12500000, pwdWageLevel: "Level III",
    }),

  pwdExpiringSoon: (): TestCaseData =>
    createTestCase({
      employerName: "FinTech Solutions", beneficiaryIdentifier: "PWD-EXPIRING-001",
      positionTitle: "Financial Analyst", caseStatus: "pwd", progressStatus: "filed",
      pwdFilingDate: daysAgo(330), pwdDeterminationDate: daysAgo(300),
      pwdExpirationDate: daysFromNow(15), pwdCaseNumber: "P-2023-TEST-002",
      pwdWageAmount: 9500000, pwdWageLevel: "Level II",
      priorityLevel: "urgent", isFavorite: true,
    }),
};

export const recruitmentFixtures = {
  recruitmentActive: (): TestCaseData =>
    createTestCase({
      employerName: "Healthcare Partners", beneficiaryIdentifier: "REC-ACTIVE-001",
      positionTitle: "Registered Nurse", caseStatus: "recruitment", progressStatus: "working",
      pwdFilingDate: daysAgo(150), pwdDeterminationDate: daysAgo(120), pwdExpirationDate: daysFromNow(210),
      jobOrderStartDate: daysAgo(35), jobOrderEndDate: daysAgo(5),
      sundayAdFirstDate: lastSundayBeforeDaysAgo(20), sundayAdSecondDate: lastSundayBeforeDaysAgo(13),
      sundayAdNewspaper: "The Daily Times",
      additionalRecruitmentMethods: [
        { method: "Company website", date: daysAgo(30), description: "Posted on careers page" },
        { method: "Professional journal", date: daysAgo(25), description: "Nursing Today Magazine" },
      ],
      recruitmentApplicantsCount: 12, isProfessionalOccupation: true, priorityLevel: "high",
    }),

  recruitmentComplete: (): TestCaseData =>
    createTestCase({
      employerName: "Engineering Firm LLC", beneficiaryIdentifier: "REC-COMPLETE-001",
      positionTitle: "Civil Engineer", caseStatus: "recruitment", progressStatus: "approved",
      pwdFilingDate: daysAgo(180), pwdDeterminationDate: daysAgo(150), pwdExpirationDate: daysFromNow(180),
      jobOrderStartDate: daysAgo(90), jobOrderEndDate: daysAgo(60),
      sundayAdFirstDate: lastSundayBeforeDaysAgo(75), sundayAdSecondDate: lastSundayBeforeDaysAgo(68),
      sundayAdNewspaper: "City Chronicle",
      additionalRecruitmentStartDate: daysAgo(85), additionalRecruitmentEndDate: daysAgo(55),
      additionalRecruitmentMethods: [
        { method: "Job fair", date: daysAgo(70) },
        { method: "Campus recruitment", date: daysAgo(65) },
        { method: "Employee referral program", date: daysAgo(60) },
      ],
      noticeOfFilingStartDate: daysAgo(90), noticeOfFilingEndDate: daysAgo(74),
      recruitmentApplicantsCount: 8, recruitmentSummaryCustom: "Completed all required recruitment steps",
      isProfessionalOccupation: true, priorityLevel: "high",
    }),
};

export const eta9089Fixtures = {
  eta9089Pending: (): TestCaseData =>
    createTestCase({
      employerName: "BioTech Research Inc.", beneficiaryIdentifier: "ETA-PENDING-001",
      positionTitle: "Research Scientist", caseStatus: "eta9089", progressStatus: "filed",
      pwdFilingDate: daysAgo(250), pwdDeterminationDate: daysAgo(220), pwdExpirationDate: daysFromNow(110),
      jobOrderStartDate: daysAgo(150), jobOrderEndDate: daysAgo(120),
      eta9089FilingDate: daysAgo(90), eta9089CaseNumber: "A-2024-TEST-003",
      recruitmentApplicantsCount: 15, isProfessionalOccupation: true,
    }),

  eta9089WithRFI: (): TestCaseData =>
    createTestCase({
      employerName: "Manufacturing Corp", beneficiaryIdentifier: "ETA-RFI-001",
      positionTitle: "Production Manager", caseStatus: "eta9089", progressStatus: "rfi_rfe",
      pwdFilingDate: daysAgo(280), pwdDeterminationDate: daysAgo(250), pwdExpirationDate: daysFromNow(80),
      eta9089FilingDate: daysAgo(120), eta9089CaseNumber: "A-2024-TEST-004",
      rfiEntries: [{
        id: "rfi-1", receivedDate: daysAgo(10), responseDueDate: daysFromNow(20),
        createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      }],
      recruitmentApplicantsCount: 6, priorityLevel: "urgent", isFavorite: true,
    }),

  eta9089Certified: (): TestCaseData =>
    createTestCase({
      employerName: "Consulting Group LLC", beneficiaryIdentifier: "ETA-CERT-001",
      positionTitle: "Management Consultant", caseStatus: "eta9089", progressStatus: "approved",
      pwdFilingDate: daysAgo(300), pwdDeterminationDate: daysAgo(270), pwdExpirationDate: daysFromNow(60),
      eta9089FilingDate: daysAgo(150), eta9089CertificationDate: daysAgo(30),
      eta9089ExpirationDate: daysFromNow(150), eta9089CaseNumber: "A-2024-TEST-005",
      recruitmentApplicantsCount: 9, isProfessionalOccupation: true, priorityLevel: "high",
    }),
};

export const i140Fixtures = {
  i140Pending: (): TestCaseData =>
    createTestCase({
      employerName: "Tech Innovations Inc.", beneficiaryIdentifier: "I140-PENDING-001",
      positionTitle: "Systems Architect", caseStatus: "i140", progressStatus: "filed",
      pwdFilingDate: daysAgo(350), pwdDeterminationDate: daysAgo(320), pwdExpirationDate: daysAgo(20),
      eta9089FilingDate: daysAgo(200), eta9089CertificationDate: daysAgo(80), eta9089ExpirationDate: daysFromNow(100),
      i140FilingDate: daysAgo(60), i140ReceiptDate: daysAgo(55), i140ReceiptNumber: "WAC2412345678",
      recruitmentApplicantsCount: 11, isProfessionalOccupation: true,
    }),

  i140WithRFE: (): TestCaseData =>
    createTestCase({
      employerName: "Digital Media Co.", beneficiaryIdentifier: "I140-RFE-001",
      positionTitle: "Creative Director", caseStatus: "i140", progressStatus: "rfi_rfe",
      pwdFilingDate: daysAgo(380), pwdDeterminationDate: daysAgo(350), pwdExpirationDate: daysAgo(50),
      eta9089FilingDate: daysAgo(230), eta9089CertificationDate: daysAgo(110), eta9089ExpirationDate: daysFromNow(70),
      i140FilingDate: daysAgo(90), i140ReceiptDate: daysAgo(85), i140ReceiptNumber: "LIN2498765432",
      rfeEntries: [{
        id: "rfe-1", receivedDate: daysAgo(15), responseDueDate: daysFromNow(72),
        createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
      }],
      recruitmentApplicantsCount: 7, isProfessionalOccupation: true,
      priorityLevel: "urgent", tags: ["needs_evidence", "urgent_rfe"],
    }),

  i140Approved: (): TestCaseData =>
    createTestCase({
      employerName: "Global Services Ltd.", beneficiaryIdentifier: "I140-APPROVED-001",
      positionTitle: "Project Manager", caseStatus: "i140", progressStatus: "approved",
      pwdFilingDate: daysAgo(400), pwdDeterminationDate: daysAgo(370), pwdExpirationDate: daysAgo(70),
      eta9089FilingDate: daysAgo(250), eta9089CertificationDate: daysAgo(130), eta9089ExpirationDate: daysFromNow(50),
      i140FilingDate: daysAgo(110), i140ReceiptDate: daysAgo(105), i140ReceiptNumber: "SRC2487654321",
      i140ApprovalDate: daysAgo(10), recruitmentApplicantsCount: 5,
      isProfessionalOccupation: true, isFavorite: true, tags: ["success", "priority_date_locked"],
    }),
};

export const specialFixtures = {
  closedCase: (): TestCaseData =>
    createTestCase({
      employerName: "Archived Corp", beneficiaryIdentifier: "CLOSED-001",
      positionTitle: "Business Analyst", caseStatus: "closed", progressStatus: "approved",
      pwdFilingDate: daysAgo(500), pwdDeterminationDate: daysAgo(470), pwdExpirationDate: daysAgo(170),
      eta9089FilingDate: daysAgo(350), eta9089CertificationDate: daysAgo(230),
      i140FilingDate: daysAgo(200), i140ApprovalDate: daysAgo(100),
      recruitmentApplicantsCount: 4, isProfessionalOccupation: true,
      priorityLevel: "low", tags: ["archived", "completed"],
    }),

  overdueDeadline: (): TestCaseData =>
    createTestCase({
      employerName: "Urgent Matters Inc.", beneficiaryIdentifier: "OVERDUE-001",
      positionTitle: "Operations Manager", caseStatus: "eta9089", progressStatus: "rfi_rfe",
      pwdFilingDate: daysAgo(290), pwdDeterminationDate: daysAgo(260), pwdExpirationDate: daysFromNow(70),
      eta9089FilingDate: daysAgo(130), eta9089CaseNumber: "A-2024-OVERDUE-001",
      rfiEntries: [{
        id: "rfi-overdue", receivedDate: daysAgo(28), responseDueDate: daysFromNow(2),
        createdAt: Date.now() - 28 * 24 * 60 * 60 * 1000,
      }],
      recruitmentApplicantsCount: 10, isProfessionalOccupation: true,
      priorityLevel: "urgent", isFavorite: true, tags: ["urgent", "rfi_deadline"],
    }),
};

export const fixtures = {
  pwd: pwdFixtures,
  recruitment: recruitmentFixtures,
  eta9089: eta9089Fixtures,
  i140: i140Fixtures,
  special: specialFixtures,
};
