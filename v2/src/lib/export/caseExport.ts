/**
 * Case Export Utilities
 * Provides CSV and JSON export functionality for case data.
 *
 * Features:
 * - CSV export with proper escaping of special characters
 * - JSON export with versioned wrapper for forward compatibility
 * - Automatic date formatting (YYYY-MM-DD)
 * - Browser download trigger
 * - Filename includes current date
 * - Full case data export (all fields from schema)
 *
 * JSON Export Format (v2):
 * {
 *   "version": "v2",
 *   "exportDate": "2024-01-15T12:00:00.000Z",
 *   "totalCases": 5,
 *   "cases": [...]
 * }
 */

import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// EXPORT FORMAT VERSION
// ============================================================================

export const EXPORT_VERSION = "v2";

// ============================================================================
// JSON EXPORT TYPES - FULL CASE DATA
// ============================================================================

/**
 * Note entry for case notes array
 */
export interface ExportedNote {
  id: string;
  content: string;
  createdAt: number;
  status: "pending" | "done" | "deleted";
  priority?: "high" | "medium" | "low";
  category?: "follow-up" | "document" | "client" | "internal" | "deadline" | "other";
  dueDate?: string;
}

/**
 * RFI/RFE entry
 */
export interface ExportedRfiRfeEntry {
  id: string;
  title?: string;
  description?: string;
  notes?: string;
  receivedDate: string;
  responseDueDate: string;
  responseSubmittedDate?: string;
  createdAt: number;
}

/**
 * Additional recruitment method entry
 */
export interface ExportedRecruitmentMethod {
  method: string;
  date: string;
  description?: string;
}

/**
 * Document attachment entry
 */
export interface ExportedDocument {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: number;
}

/**
 * Full case data for export - includes ALL fields from schema
 */
export interface ExportedCase {
  // Core identity
  _id: string;
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

  // Status
  caseStatus: string;
  progressStatus: string;
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
  additionalRecruitmentMethods: ExportedRecruitmentMethod[];
  recruitmentNotes?: string;
  recruitmentApplicantsCount: number;
  recruitmentSummaryCustom?: string;

  // Derived recruitment dates
  recruitmentStartDate?: string;
  recruitmentEndDate?: string;
  filingWindowOpens?: string;
  filingWindowCloses?: string;
  recruitmentWindowCloses?: string;

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

  // RFI/RFE entries
  rfiEntries?: ExportedRfiRfeEntry[];
  rfeEntries?: ExportedRfiRfeEntry[];

  // I-140
  i140FilingDate?: string;
  i140ReceiptDate?: string;
  i140ReceiptNumber?: string;
  i140ApprovalDate?: string;
  i140DenialDate?: string;
  i140Category?: "EB-1" | "EB-2" | "EB-3";
  i140PremiumProcessing?: boolean;
  i140ServiceCenter?: string;

  // Organization & Metadata
  priorityLevel: string;
  isFavorite: boolean;
  isPinned?: boolean;
  notes?: ExportedNote[];
  tags: string[];

  // Calendar integration
  calendarSyncEnabled: boolean;
  showOnTimeline?: boolean;

  // Documents
  documents?: ExportedDocument[];

  // Closure tracking
  closureReason?: string;
  closedAt?: number;

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

/**
 * Export wrapper with version and metadata
 */
export interface ExportWrapper {
  version: string;
  exportDate: string;
  totalCases: number;
  cases: ExportedCase[];
}

// ============================================================================
// FULL CASE TYPE (from Convex query result)
// ============================================================================

/**
 * Type for full case data returned by listByIds query
 */
export interface FullCaseData {
  _id: Id<"cases">;
  _creationTime: number;
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
  caseStatus: string;
  progressStatus: string;
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
  additionalRecruitmentMethods: Array<{
    method: string;
    date: string;
    description?: string;
  }>;
  recruitmentNotes?: string;
  recruitmentApplicantsCount: number;
  recruitmentSummaryCustom?: string;
  recruitmentStartDate?: string;
  recruitmentEndDate?: string;
  filingWindowOpens?: string;
  filingWindowCloses?: string;
  recruitmentWindowCloses?: string;
  isProfessionalOccupation: boolean;
  noticeOfFilingStartDate?: string;
  noticeOfFilingEndDate?: string;
  eta9089FilingDate?: string;
  eta9089AuditDate?: string;
  eta9089CertificationDate?: string;
  eta9089ExpirationDate?: string;
  eta9089CaseNumber?: string;
  rfiEntries?: Array<{
    id: string;
    title?: string;
    description?: string;
    notes?: string;
    receivedDate: string;
    responseDueDate: string;
    responseSubmittedDate?: string;
    createdAt: number;
  }>;
  rfeEntries?: Array<{
    id: string;
    title?: string;
    description?: string;
    notes?: string;
    receivedDate: string;
    responseDueDate: string;
    responseSubmittedDate?: string;
    createdAt: number;
  }>;
  i140FilingDate?: string;
  i140ReceiptDate?: string;
  i140ReceiptNumber?: string;
  i140ApprovalDate?: string;
  i140DenialDate?: string;
  i140Category?: "EB-1" | "EB-2" | "EB-3";
  i140PremiumProcessing?: boolean;
  i140ServiceCenter?: string;
  priorityLevel: string;
  isFavorite: boolean;
  isPinned?: boolean;
  notes?: Array<{
    id: string;
    content: string;
    createdAt: number;
    status: "pending" | "done" | "deleted";
    priority?: "high" | "medium" | "low";
    category?: "follow-up" | "document" | "client" | "internal" | "deadline" | "other";
    dueDate?: string;
  }>;
  tags: string[];
  calendarSyncEnabled: boolean;
  showOnTimeline?: boolean;
  documents: Array<{
    id: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
    uploadedAt: number;
  }>;
  closureReason?: string;
  closedAt?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

/**
 * Transform full case data to export format.
 */
function transformFullCaseForExport(caseData: FullCaseData): ExportedCase {
  return {
    // Core identity
    _id: caseData._id,
    caseNumber: caseData.caseNumber,
    internalCaseNumber: caseData.internalCaseNumber,

    // Employer info
    employerName: caseData.employerName,
    employerFein: caseData.employerFein,

    // Beneficiary info
    beneficiaryIdentifier: caseData.beneficiaryIdentifier,

    // Position info
    positionTitle: caseData.positionTitle,
    jobTitle: caseData.jobTitle,
    socCode: caseData.socCode,
    socTitle: caseData.socTitle,
    jobOrderState: caseData.jobOrderState,

    // Status
    caseStatus: caseData.caseStatus,
    progressStatus: caseData.progressStatus,
    progressStatusOverride: caseData.progressStatusOverride,

    // PWD phase
    pwdFilingDate: caseData.pwdFilingDate,
    pwdDeterminationDate: caseData.pwdDeterminationDate,
    pwdExpirationDate: caseData.pwdExpirationDate,
    pwdCaseNumber: caseData.pwdCaseNumber,
    pwdWageAmount: caseData.pwdWageAmount !== undefined ? Number(caseData.pwdWageAmount) : undefined,
    pwdWageLevel: caseData.pwdWageLevel,

    // Recruitment - Job Order
    jobOrderStartDate: caseData.jobOrderStartDate,
    jobOrderEndDate: caseData.jobOrderEndDate,

    // Recruitment - Sunday Ads
    sundayAdFirstDate: caseData.sundayAdFirstDate,
    sundayAdSecondDate: caseData.sundayAdSecondDate,
    sundayAdNewspaper: caseData.sundayAdNewspaper,

    // Recruitment - Additional Methods
    additionalRecruitmentStartDate: caseData.additionalRecruitmentStartDate,
    additionalRecruitmentEndDate: caseData.additionalRecruitmentEndDate,
    additionalRecruitmentMethods: caseData.additionalRecruitmentMethods || [],
    recruitmentNotes: caseData.recruitmentNotes,
    recruitmentApplicantsCount: Number(caseData.recruitmentApplicantsCount),
    recruitmentSummaryCustom: caseData.recruitmentSummaryCustom,

    // Derived recruitment dates
    recruitmentStartDate: caseData.recruitmentStartDate,
    recruitmentEndDate: caseData.recruitmentEndDate,
    filingWindowOpens: caseData.filingWindowOpens,
    filingWindowCloses: caseData.filingWindowCloses,
    recruitmentWindowCloses: caseData.recruitmentWindowCloses,

    // Professional occupation
    isProfessionalOccupation: caseData.isProfessionalOccupation,

    // Notice of Filing
    noticeOfFilingStartDate: caseData.noticeOfFilingStartDate,
    noticeOfFilingEndDate: caseData.noticeOfFilingEndDate,

    // ETA 9089
    eta9089FilingDate: caseData.eta9089FilingDate,
    eta9089AuditDate: caseData.eta9089AuditDate,
    eta9089CertificationDate: caseData.eta9089CertificationDate,
    eta9089ExpirationDate: caseData.eta9089ExpirationDate,
    eta9089CaseNumber: caseData.eta9089CaseNumber,

    // RFI/RFE entries
    rfiEntries: caseData.rfiEntries || [],
    rfeEntries: caseData.rfeEntries || [],

    // I-140
    i140FilingDate: caseData.i140FilingDate,
    i140ReceiptDate: caseData.i140ReceiptDate,
    i140ReceiptNumber: caseData.i140ReceiptNumber,
    i140ApprovalDate: caseData.i140ApprovalDate,
    i140DenialDate: caseData.i140DenialDate,
    i140Category: caseData.i140Category,
    i140PremiumProcessing: caseData.i140PremiumProcessing,
    i140ServiceCenter: caseData.i140ServiceCenter,

    // Organization & Metadata
    priorityLevel: caseData.priorityLevel,
    isFavorite: caseData.isFavorite,
    isPinned: caseData.isPinned,
    notes: caseData.notes,
    tags: caseData.tags || [],

    // Calendar integration
    calendarSyncEnabled: caseData.calendarSyncEnabled,
    showOnTimeline: caseData.showOnTimeline,

    // Documents
    documents: caseData.documents,

    // Closure tracking
    closureReason: caseData.closureReason,
    closedAt: caseData.closedAt,

    // Timestamps
    createdAt: caseData.createdAt,
    updatedAt: caseData.updatedAt,
  };
}

// ============================================================================
// CSV EXPORT HELPERS
// ============================================================================

/**
 * Escape a CSV field value.
 * - Wrap in quotes if contains comma, quote, or newline
 * - Escape quotes by doubling them
 */
function escapeCSVField(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) {
    return "";
  }

  const strValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes
  if (strValue.includes(",") || strValue.includes('"') || strValue.includes("\n")) {
    // Escape quotes by doubling them
    const escaped = strValue.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return strValue;
}

/**
 * Build CSV header row for full export.
 */
function buildFullCSVHeader(): string {
  const headers = [
    "_id",
    "employerName",
    "beneficiaryIdentifier",
    "positionTitle",
    "caseStatus",
    "progressStatus",
    // Case numbers
    "caseNumber",
    "internalCaseNumber",
    "pwdCaseNumber",
    "eta9089CaseNumber",
    "i140ReceiptNumber",
    // PWD dates
    "pwdFilingDate",
    "pwdDeterminationDate",
    "pwdExpirationDate",
    "pwdWageAmount",
    "pwdWageLevel",
    // Recruitment
    "jobOrderStartDate",
    "jobOrderEndDate",
    "sundayAdFirstDate",
    "sundayAdSecondDate",
    "sundayAdNewspaper",
    "jobOrderState",
    "noticeOfFilingStartDate",
    "noticeOfFilingEndDate",
    "additionalRecruitmentStartDate",
    "additionalRecruitmentEndDate",
    "recruitmentApplicantsCount",
    "isProfessionalOccupation",
    // ETA 9089
    "eta9089FilingDate",
    "eta9089AuditDate",
    "eta9089CertificationDate",
    "eta9089ExpirationDate",
    // I-140
    "i140FilingDate",
    "i140ReceiptDate",
    "i140ApprovalDate",
    "i140DenialDate",
    "i140Category",
    "i140PremiumProcessing",
    "i140ServiceCenter",
    // Flags
    "isFavorite",
    "isPinned",
    "calendarSyncEnabled",
    "showOnTimeline",
    // Metadata
    "priorityLevel",
    "closureReason",
    "closedAt",
    "createdAt",
    "updatedAt",
  ];

  return headers.join(",");
}

/**
 * Build CSV data row from full case data.
 */
function buildFullCSVRow(caseData: ExportedCase): string {
  const fields = [
    escapeCSVField(caseData._id),
    escapeCSVField(caseData.employerName),
    escapeCSVField(caseData.beneficiaryIdentifier),
    escapeCSVField(caseData.positionTitle),
    escapeCSVField(caseData.caseStatus),
    escapeCSVField(caseData.progressStatus),
    // Case numbers
    escapeCSVField(caseData.caseNumber),
    escapeCSVField(caseData.internalCaseNumber),
    escapeCSVField(caseData.pwdCaseNumber),
    escapeCSVField(caseData.eta9089CaseNumber),
    escapeCSVField(caseData.i140ReceiptNumber),
    // PWD dates
    escapeCSVField(caseData.pwdFilingDate),
    escapeCSVField(caseData.pwdDeterminationDate),
    escapeCSVField(caseData.pwdExpirationDate),
    escapeCSVField(caseData.pwdWageAmount),
    escapeCSVField(caseData.pwdWageLevel),
    // Recruitment
    escapeCSVField(caseData.jobOrderStartDate),
    escapeCSVField(caseData.jobOrderEndDate),
    escapeCSVField(caseData.sundayAdFirstDate),
    escapeCSVField(caseData.sundayAdSecondDate),
    escapeCSVField(caseData.sundayAdNewspaper),
    escapeCSVField(caseData.jobOrderState),
    escapeCSVField(caseData.noticeOfFilingStartDate),
    escapeCSVField(caseData.noticeOfFilingEndDate),
    escapeCSVField(caseData.additionalRecruitmentStartDate),
    escapeCSVField(caseData.additionalRecruitmentEndDate),
    escapeCSVField(caseData.recruitmentApplicantsCount),
    escapeCSVField(caseData.isProfessionalOccupation),
    // ETA 9089
    escapeCSVField(caseData.eta9089FilingDate),
    escapeCSVField(caseData.eta9089AuditDate),
    escapeCSVField(caseData.eta9089CertificationDate),
    escapeCSVField(caseData.eta9089ExpirationDate),
    // I-140
    escapeCSVField(caseData.i140FilingDate),
    escapeCSVField(caseData.i140ReceiptDate),
    escapeCSVField(caseData.i140ApprovalDate),
    escapeCSVField(caseData.i140DenialDate),
    escapeCSVField(caseData.i140Category),
    escapeCSVField(caseData.i140PremiumProcessing),
    escapeCSVField(caseData.i140ServiceCenter),
    // Flags
    escapeCSVField(caseData.isFavorite),
    escapeCSVField(caseData.isPinned),
    escapeCSVField(caseData.calendarSyncEnabled),
    escapeCSVField(caseData.showOnTimeline),
    // Metadata
    escapeCSVField(caseData.priorityLevel),
    escapeCSVField(caseData.closureReason),
    escapeCSVField(caseData.closedAt),
    escapeCSVField(caseData.createdAt),
    escapeCSVField(caseData.updatedAt),
  ];

  return fields.join(",");
}

// ============================================================================
// DOWNLOAD HELPER
// ============================================================================

/**
 * Trigger browser download for a Blob.
 * Creates temporary anchor element, clicks it, and cleans up.
 *
 * @throws {Error} If download fails due to browser restrictions or popup blockers
 */
function downloadBlob(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("[Export] Download failed:", error);
    throw new Error("Failed to initiate download. Please check your browser settings and try again.");
  }
}

// ============================================================================
// FULL CASE EXPORT FUNCTIONS
// ============================================================================

/**
 * Export full case data as JSON file.
 * Takes an array of full case data from Convex query.
 * Triggers browser download with filename: perm-cases-YYYY-MM-DD.json
 */
export function exportFullCasesJSON(cases: readonly FullCaseData[]): void {
  // Transform cases to export format
  const exportedCases = cases.map(transformFullCaseForExport);

  // Create versioned wrapper
  const exportWrapper: ExportWrapper = {
    version: EXPORT_VERSION,
    exportDate: new Date().toISOString(),
    totalCases: cases.length,
    cases: exportedCases,
  };

  // Serialize to pretty-printed JSON
  const jsonContent = JSON.stringify(exportWrapper, null, 2);

  // Create Blob
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });

  // Generate filename with current date
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];
  const filename = `perm-cases-${dateStr}.json`;

  // Trigger download
  downloadBlob(blob, filename);
}

/**
 * Export full case data as CSV file.
 * Takes an array of full case data from Convex query.
 * Triggers browser download with filename: perm-cases-YYYY-MM-DD.csv
 */
export function exportFullCasesCSV(cases: readonly FullCaseData[]): void {
  // Transform cases to export format
  const exportedCases = cases.map(transformFullCaseForExport);

  // Build CSV content
  const header = buildFullCSVHeader();
  const rows = exportedCases.map(buildFullCSVRow);
  const csvContent = [header, ...rows].join("\n");

  // Create Blob
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });

  // Generate filename with current date
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];
  const filename = `perm-cases-${dateStr}.csv`;

  // Trigger download
  downloadBlob(blob, filename);
}

// ============================================================================
// LEGACY EXPORTS (for backward compatibility with CaseCardData)
// ============================================================================

import type { CaseCardData } from "../../../convex/lib/caseListTypes";

/**
 * Legacy: Transform CaseCardData to exportable format.
 * NOTE: CaseCardData is a minimal projection and many fields will be undefined.
 * Use exportFullCasesJSON with full case data for complete exports.
 * @deprecated Use exportFullCasesJSON with listByIds query instead
 */
function transformCaseCardForExport(caseData: CaseCardData): Partial<ExportedCase> {
  return {
    _id: caseData._id,
    employerName: caseData.employerName,
    beneficiaryIdentifier: caseData.beneficiaryIdentifier,
    positionTitle: undefined, // Not in CaseCardData
    caseStatus: caseData.caseStatus,
    progressStatus: caseData.progressStatus,
    pwdFilingDate: caseData.dates.pwdFiled,
    pwdDeterminationDate: caseData.dates.pwdDetermined,
    pwdExpirationDate: caseData.dates.pwdExpires,
    eta9089FilingDate: caseData.dates.etaFiled,
    eta9089CertificationDate: caseData.dates.etaCertified,
    eta9089ExpirationDate: caseData.dates.etaExpires,
    i140FilingDate: caseData.dates.i140Filed,
    i140ApprovalDate: caseData.dates.i140Approved,
    isProfessionalOccupation: caseData.isProfessionalOccupation ?? false,
    isFavorite: caseData.isFavorite,
    isPinned: caseData.isPinned,
    calendarSyncEnabled: caseData.calendarSyncEnabled ?? false,
    showOnTimeline: caseData.showOnTimeline,
    closureReason: caseData.closedReason,
    closedAt: caseData.closedAt ? new Date(caseData.closedAt).getTime() : undefined,
    createdAt: caseData.dates.created,
    updatedAt: caseData.dates.updated,
  };
}

/**
 * Legacy: Export CaseCardData as CSV file.
 * NOTE: Many fields will be empty because CaseCardData is a minimal projection.
 * @deprecated Use exportFullCasesCSV with listByIds query instead
 */
export function exportCasesCSV(cases: readonly CaseCardData[]): void {
  console.warn("[Export] exportCasesCSV is deprecated. Use exportFullCasesCSV with listByIds query for complete data.");

  const header = buildFullCSVHeader();
  const rows = cases.map((c) => {
    const partial = transformCaseCardForExport(c);
    // Build row with undefined values for missing fields
    return buildFullCSVRow(partial as ExportedCase);
  });
  const csvContent = [header, ...rows].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });

  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];
  const filename = `perm-cases-${dateStr}.csv`;

  downloadBlob(blob, filename);
}

/**
 * Legacy: Export CaseCardData as JSON file.
 * NOTE: Many fields will be missing because CaseCardData is a minimal projection.
 * @deprecated Use exportFullCasesJSON with listByIds query instead
 */
export function exportCasesJSON(cases: readonly CaseCardData[]): void {
  console.warn("[Export] exportCasesJSON is deprecated. Use exportFullCasesJSON with listByIds query for complete data.");

  const exportedCases = cases.map(transformCaseCardForExport);

  const exportWrapper = {
    version: EXPORT_VERSION,
    exportDate: new Date().toISOString(),
    totalCases: cases.length,
    cases: exportedCases,
    _warning: "This export was created using CaseCardData which is missing many fields. Re-export using the updated export feature for complete data.",
  };

  const jsonContent = JSON.stringify(exportWrapper, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });

  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];
  const filename = `perm-cases-${dateStr}.json`;

  downloadBlob(blob, filename);
}
