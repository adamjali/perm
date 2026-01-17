/**
 * Case Import Utilities
 * Comprehensive import system supporting multiple formats:
 * - V2 format (current Convex-based system)
 * - V1 format (FastAPI/Supabase snake_case)
 * - Legacy perm-tracker-new format (Firebase camelCase)
 * - Legacy Firebase object format (with Firebase IDs as keys)
 *
 * Features:
 * - Auto-detect format from file structure and field names
 * - Map all legacy field names to v2 schema
 * - Map case/progress statuses between systems
 * - Normalize date formats (ISO with time → YYYY-MM-DD)
 * - Handle missing beneficiaryIdentifier with placeholder
 * - Convert legacy RFE arrays to v2 format
 * - Track cases needing user attention
 */

import type { CaseCardData } from "../../../convex/lib/caseListTypes";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportWarning {
  row: number;
  field: string;
  message: string;
  employerName?: string;
  originalValue?: string;
}

export interface DuplicateCase {
  row: number;
  importedCase: Partial<CaseCardData>;
  existingCase: {
    _id: string;
    employerName: string;
    beneficiaryIdentifier: string;
  };
}

export type DetectedFormat =
  | "v2"                    // Current Convex format (array or wrapper)
  | "v1"                    // FastAPI snake_case format
  | "perm-tracker-new"      // Legacy Firebase camelCase format
  | "firebase-object"       // Legacy Firebase with ID keys
  | "unknown";

export interface ImportResult {
  valid: Partial<CaseCardData>[];
  duplicates: DuplicateCase[];
  errors: ImportError[];
  warnings: ImportWarning[];
  detectedFormat: DetectedFormat;
  isLegacyFormat: boolean;
  /** Count of cases that need beneficiary identifier to be filled in */
  casesNeedingBeneficiary: number;
}

// ============================================================================
// FORMAT DETECTION
// ============================================================================

/**
 * Detect the format of the parsed JSON data
 */
function detectFormat(parsed: unknown): { format: DetectedFormat; cases: unknown[] } {
  // Handle null/undefined
  if (parsed === null || parsed === undefined) {
    return { format: "unknown", cases: [] };
  }

  // Check for v2 wrapper format: { version: "v2", cases: [...] }
  if (typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;

    // V2 versioned format
    if (obj.version === "v2" && Array.isArray(obj.cases)) {
      return { format: "v2", cases: obj.cases };
    }

    // V1/legacy wrapper format: { cases: [...] } or { export_date: ..., cases: [...] }
    if (Array.isArray(obj.cases)) {
      // Check first case to determine v1 vs perm-tracker-new
      const firstCase = obj.cases[0];
      if (firstCase && typeof firstCase === "object") {
        const caseObj = firstCase as Record<string, unknown>;
        // V1 uses snake_case, perm-tracker-new uses camelCase
        if ("employer_name" in caseObj || "position_title" in caseObj) {
          return { format: "v1", cases: obj.cases };
        }
        if ("employerName" in caseObj || "positionTitle" in caseObj) {
          return { format: "perm-tracker-new", cases: obj.cases };
        }
      }
      // Default to v2 for { cases: [...] } without distinguishing fields
      return { format: "v2", cases: obj.cases };
    }

    // Firebase object format: { "-M1a2b3c": { case... }, "-M1a2b4d": { case... } }
    // Check if keys look like Firebase IDs (start with -)
    const keys = Object.keys(obj);
    if (keys.length > 0 && keys.some(k => k.startsWith("-") || /^[a-zA-Z0-9_-]{20,}$/.test(k))) {
      return { format: "firebase-object", cases: Object.values(obj) };
    }

    // Single case object (legacy)
    if ("employerName" in obj || "employer_name" in obj) {
      const format = "employer_name" in obj ? "v1" : "perm-tracker-new";
      return { format, cases: [obj] };
    }
  }

  // Plain array format
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return { format: "v2", cases: [] };
    }

    const firstCase = parsed[0];
    if (firstCase && typeof firstCase === "object") {
      const caseObj = firstCase as Record<string, unknown>;
      // V1 uses snake_case
      if ("employer_name" in caseObj || "position_title" in caseObj || "pwd_filing_date" in caseObj) {
        return { format: "v1", cases: parsed };
      }
      // perm-tracker-new uses camelCase with specific fields
      if ("sundayAdsFirstDate" in caseObj || "rfes" in caseObj || "lastUpdated" in caseObj) {
        return { format: "perm-tracker-new", cases: parsed };
      }
      // V2 format (camelCase with beneficiaryIdentifier)
      if ("beneficiaryIdentifier" in caseObj || "dates" in caseObj) {
        return { format: "v2", cases: parsed };
      }
      // Default to perm-tracker-new for other camelCase
      if ("employerName" in caseObj) {
        return { format: "perm-tracker-new", cases: parsed };
      }
    }
    return { format: "v2", cases: parsed };
  }

  return { format: "unknown", cases: [] };
}

// ============================================================================
// STATUS MAPPING
// ============================================================================

/**
 * Map legacy case status values to v2 format
 * V2 statuses: "pwd" | "recruitment" | "eta9089" | "i140" | "closed"
 */
const CASE_STATUS_MAP: Record<string, string> = {
  // Legacy perm-tracker-new statuses
  "PWD": "pwd",
  "Recruitment": "recruitment",
  "ETA 9089": "eta9089",
  "I-140": "i140",
  "RFE": "eta9089",  // RFE typically happens during ETA 9089 or later
  "Complete": "i140", // Per perm_flow.md: "i-140 approved makes it complete"
  "Closed": "closed",
  // V1 granular statuses
  "PWD Approved": "pwd",
  "ETA 9089 Prep": "eta9089",
  "ETA 9089 Filed": "eta9089",
  "ETA 9089 Audit": "eta9089",
  "ETA 9089 Certified": "eta9089",
  "I-140 Prep": "i140",
  "I-140 Filed": "i140",
  "I-140 Approved": "i140",
  "Withdrawn": "closed",
  "Denied": "closed",
  // Already valid v2 statuses (pass through)
  "pwd": "pwd",
  "recruitment": "recruitment",
  "eta9089": "eta9089",
  "i140": "i140",
  "closed": "closed",
};

/**
 * Map legacy progress status values to v2 format
 * V2 statuses: "working" | "waiting_intake" | "filed" | "approved" | "under_review" | "rfi_rfe"
 */
const PROGRESS_STATUS_MAP: Record<string, string> = {
  // Legacy perm-tracker-new statuses
  "Working on it": "working",
  "Under review": "under_review",
  "Pending intake": "waiting_intake",
  "Pending documents": "waiting_intake",
  "Pending signatures": "waiting_intake",
  "Filed": "filed",
  "Waiting Period": "waiting_intake",
  // V1 style statuses
  "in_progress": "working",
  "pending": "waiting_intake",
  "on_hold": "waiting_intake",
  "complete": "approved",
  "completed": "approved",
  // Already valid v2 statuses (pass through)
  "working": "working",
  "waiting_intake": "waiting_intake",
  "filed": "filed",
  "approved": "approved",
  "under_review": "under_review",
  "rfi_rfe": "rfi_rfe",
};

// ============================================================================
// FIELD MAPPING
// ============================================================================

/**
 * Field name mappings from various formats to v2 schema
 * Maps: v1 snake_case, perm-tracker-new camelCase variations
 */
const FIELD_NAME_MAP: Record<string, string> = {
  // V1 snake_case to v2 camelCase
  "employer_name": "employerName",
  "beneficiary_name": "beneficiaryIdentifier",
  "position_title": "positionTitle",
  "case_status": "caseStatus",
  "progress_status": "progressStatus",
  "is_professional": "isProfessionalOccupation",
  "is_professional_occupation": "isProfessionalOccupation",
  "is_favorite": "isFavorite",
  "calendar_sync": "calendarSyncEnabled",
  "calendar_sync_enabled": "calendarSyncEnabled",
  // V1 date fields
  "pwd_filing_date": "pwdFilingDate",
  "pwd_determination_date": "pwdDeterminationDate",
  "pwd_expiration_date": "pwdExpirationDate",
  "sunday_ad_first_date": "sundayAdFirstDate",
  "sunday_ad_second_date": "sundayAdSecondDate",
  "job_order_start_date": "jobOrderStartDate",
  "job_order_end_date": "jobOrderEndDate",
  "notice_of_filing_start_date": "noticeOfFilingStartDate",
  "notice_of_filing_end_date": "noticeOfFilingEndDate",
  "additional_recruitment_start_date": "additionalRecruitmentStartDate",
  "additional_recruitment_end_date": "additionalRecruitmentEndDate",
  "eta9089_filing_date": "eta9089FilingDate",
  "eta9089_certification_date": "eta9089CertificationDate",
  "eta9089_expiration_date": "eta9089ExpirationDate",
  "i140_filing_date": "i140FilingDate",
  "i140_receipt_date": "i140ReceiptDate",
  "i140_approval_date": "i140ApprovalDate",
  "i140_denial_date": "i140DenialDate",
  // perm-tracker-new variations (sundayAds plural → sundayAd singular)
  "sundayAdsFirstDate": "sundayAdFirstDate",
  "sundayAdsSecondDate": "sundayAdSecondDate",
  // Common aliases
  "position": "positionTitle",
  "beneficiary": "beneficiaryIdentifier",
  "employer": "employerName",
  // Timestamps
  "created_at": "createdAt",
  "updated_at": "updatedAt",
  "lastUpdated": "updatedAt",
  // RFI/RFE legacy single fields
  "rfi_received_date": "rfiReceivedDate",
  "rfi_response_due_date": "rfiResponseDueDate",
  "rfi_response_submitted_date": "rfiResponseSubmittedDate",
  "rfe_received_date": "rfeReceivedDate",
  "rfe_response_due_date": "rfeResponseDueDate",
  "rfe_response_submitted_date": "rfeResponseSubmittedDate",
  // Additional v1 fields (recruitment)
  "sunday_ad_newspaper": "sundayAdNewspaper",
  "job_order_state": "jobOrderState",
  "recruitment_applicants_count": "recruitmentApplicantsCount",
  "recruitment_summary_custom": "recruitmentSummaryCustom",
  // Additional v1 fields (case numbers)
  "case_number": "caseNumber",
  "internal_case_number": "internalCaseNumber",
  "pwd_case_number": "pwdCaseNumber",
  "eta9089_case_number": "eta9089CaseNumber",
  "i140_receipt_number": "i140ReceiptNumber",
  // Beneficiary (additional mapping)
  "beneficiary_identifier": "beneficiaryIdentifier",
  // RFI/RFE list arrays (will be processed separately)
  "rfi_list": "rfiList",
  "rfe_list": "rfeList",
  // Additional recruitment methods (may be JSON string)
  "additional_recruitment_methods": "additionalRecruitmentMethods",
};

// ============================================================================
// DATE NORMALIZATION
// ============================================================================

/**
 * Normalize a date value to YYYY-MM-DD format
 * Handles:
 * - ISO strings with time: "2024-01-15T12:00:00.000Z"
 * - ISO date only: "2024-01-15"
 * - Firestore timestamps: { seconds: number, nanoseconds: number }
 * - Date objects
 * - Millisecond timestamps
 */
function normalizeDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  // Already YYYY-MM-DD format
  if (typeof value === "string") {
    const trimmed = value.trim();

    // YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    // ISO string with time (e.g., "2024-01-15T12:00:00.000Z")
    if (trimmed.includes("T")) {
      try {
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[caseImport] Failed to parse ISO date: "${trimmed}"`, error);
        }
        return undefined;
      }
    }

    // Try parsing as date string
    try {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[caseImport] Failed to parse date string: "${trimmed}"`, error);
      }
      return undefined;
    }
  }

  // Firestore timestamp object
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if ("seconds" in obj && typeof obj.seconds === "number") {
      const date = new Date(obj.seconds * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    }
    // Date object
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value.toISOString().split("T")[0];
    }
  }

  // Millisecond timestamp
  if (typeof value === "number" && value > 0) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }

  return undefined;
}

/**
 * List of all date fields in v2 schema
 */
const V2_DATE_FIELDS = [
  "pwdFilingDate",
  "pwdDeterminationDate",
  "pwdExpirationDate",
  "jobOrderStartDate",
  "jobOrderEndDate",
  "sundayAdFirstDate",
  "sundayAdSecondDate",
  "additionalRecruitmentStartDate",
  "additionalRecruitmentEndDate",
  "noticeOfFilingStartDate",
  "noticeOfFilingEndDate",
  "eta9089FilingDate",
  "eta9089AuditDate",
  "eta9089CertificationDate",
  "eta9089ExpirationDate",
  "i140FilingDate",
  "i140ReceiptDate",
  "i140ApprovalDate",
  "i140DenialDate",
  "closedAt",
];

// ============================================================================
// RFE/RFI CONVERSION
// ============================================================================

interface LegacyRFE {
  [key: string]: unknown;
  rfeId?: string;
  requestedDate?: unknown;
  deadline?: unknown;
  completedDate?: unknown;
  reason?: string;
}

interface V2RFEEntry {
  id: string;
  title?: string;
  description?: string;
  notes?: string;
  receivedDate: string;
  responseDueDate: string;
  responseSubmittedDate?: string;
  reason?: string; // Legacy compatibility
  createdAt: number;
}

/**
 * Generic converter for RFI/RFE entries
 */
function convertEntries<T extends Record<string, unknown>>(
  entries: unknown,
  idPrefix: string,
  fieldMapping: {
    receivedDate: string;
    responseDueDate: string;
    responseSubmittedDate?: string;
  },
  extraMapper?: (entry: T) => Partial<V2RFEEntry>
): V2RFEEntry[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  const result: V2RFEEntry[] = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const typedEntry = entry as T;
    const receivedDate = normalizeDate(typedEntry[fieldMapping.receivedDate]);
    const responseDueDate = normalizeDate(typedEntry[fieldMapping.responseDueDate]);
    const responseSubmittedDate = fieldMapping.responseSubmittedDate
      ? normalizeDate(typedEntry[fieldMapping.responseSubmittedDate])
      : undefined;

    if (!receivedDate && !responseDueDate) {
      continue;
    }

    const v2Entry: V2RFEEntry = {
      id: (typedEntry.id as string) || (typedEntry.rfeId as string) || `imported-${idPrefix}-${Date.now()}-${index}`,
      receivedDate: receivedDate || "",
      responseDueDate: responseDueDate || "",
      createdAt: Date.now(),
    };

    if (responseSubmittedDate) {
      v2Entry.responseSubmittedDate = responseSubmittedDate;
    }

    if (extraMapper) {
      Object.assign(v2Entry, extraMapper(typedEntry));
    }

    result.push(v2Entry);
  }

  return result;
}

/**
 * Convert legacy RFE array format to v2 rfeEntries format
 * Legacy: { rfeId, requestedDate, deadline, completedDate, reason }
 * V2: { id, receivedDate, responseDueDate, responseSubmittedDate, createdAt }
 */
function convertLegacyRFEs(rfes: unknown): V2RFEEntry[] {
  return convertEntries<LegacyRFE>(
    rfes,
    'rfe',
    {
      receivedDate: 'requestedDate',
      responseDueDate: 'deadline',
      responseSubmittedDate: 'completedDate',
    },
    (entry) => (entry.reason ? { reason: entry.reason } : {})
  );
}

/**
 * V1 RFI/RFE list entry format (from v1 exports)
 */
interface V1RFIListEntry {
  [key: string]: unknown;
  notes?: string;
  title?: string;
  description?: string;
  received_date?: string;
  response_due_date?: string;
  response_submitted_date?: string;
}

/**
 * Convert v1 rfi_list array format to v2 rfiEntries format
 * V1: { notes, title, description, received_date, response_due_date, response_submitted_date }
 * V2: { id, receivedDate, responseDueDate, responseSubmittedDate, notes, createdAt }
 */
function convertV1RFIList(rfiList: unknown): V2RFEEntry[] {
  return convertEntries<V1RFIListEntry>(
    rfiList,
    'rfi',
    {
      receivedDate: 'received_date',
      responseDueDate: 'response_due_date',
      responseSubmittedDate: 'response_submitted_date',
    },
    (entry) => {
      const extras: Partial<V2RFEEntry> = {};
      if (entry.title) extras.title = entry.title;
      if (entry.description) extras.description = entry.description;
      if (entry.notes) extras.notes = entry.notes;
      return extras;
    }
  );
}

/**
 * Convert v1 rfe_list array format to v2 rfeEntries format
 * Same structure as RFI list
 */
function convertV1RFEList(rfeList: unknown): V2RFEEntry[] {
  return convertEntries<V1RFIListEntry>(
    rfeList,
    'rfe',
    {
      receivedDate: 'received_date',
      responseDueDate: 'response_due_date',
      responseSubmittedDate: 'response_submitted_date',
    },
    (entry) => {
      const extras: Partial<V2RFEEntry> = {};
      if (entry.title) extras.title = entry.title;
      if (entry.description) extras.description = entry.description;
      if (entry.notes) extras.notes = entry.notes;
      return extras;
    }
  );
}

// ============================================================================
// PLACEHOLDER FOR MISSING BENEFICIARY
// ============================================================================

export const BENEFICIARY_PLACEHOLDER = "[NEEDS ENTRY]";

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

const VALID_CASE_STATUSES = ["pwd", "recruitment", "eta9089", "i140", "closed"] as const;
const VALID_PROGRESS_STATUSES = [
  "working",
  "waiting_intake",
  "filed",
  "approved",
  "under_review",
  "rfi_rfe",
] as const;

// ============================================================================
// FILE READING HELPERS
// ============================================================================

function readFileAsText(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// ============================================================================
// MAIN IMPORT FUNCTION
// ============================================================================

export async function parseCaseImportFile(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    valid: [],
    duplicates: [],
    errors: [],
    warnings: [],
    detectedFormat: "unknown",
    isLegacyFormat: false,
    casesNeedingBeneficiary: 0,
  };

  try {
    // 1. Read file as text
    let text: string;
    if (typeof file.text === "function") {
      text = await file.text();
    } else {
      text = await readFileAsText(file);
    }

    // 2. Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      const errorDetail =
        parseError instanceof SyntaxError
          ? parseError.message
          : "Unknown parsing error";
      result.errors.push({
        row: 0,
        field: "file",
        message: `Invalid JSON format: ${errorDetail}`,
      });
      return result;
    }

    // 3. Detect format and extract cases array
    const { format, cases } = detectFormat(parsed);
    result.detectedFormat = format;
    result.isLegacyFormat = format !== "v2" && format !== "unknown";

    if (format === "unknown" || cases.length === 0) {
      if (cases.length === 0 && format !== "unknown") {
        result.errors.push({
          row: 0,
          field: "file",
          message: "No cases found in the file",
        });
      } else {
        result.errors.push({
          row: 0,
          field: "file",
          message: "Could not detect file format. Expected JSON array or object with cases.",
        });
      }
      return result;
    }

    // 4. Process each case
    cases.forEach((caseData, index) => {
      const { normalized, errors, warnings, needsBeneficiary } = normalizeAndValidateCase(
        caseData,
        index,
        format
      );

      if (errors.length > 0) {
        result.errors.push(...errors);
      } else {
        result.valid.push(normalized);
        if (needsBeneficiary) {
          result.casesNeedingBeneficiary++;
        }
      }

      result.warnings.push(...warnings);
    });

  } catch (error) {
    result.errors.push({
      row: 0,
      field: "file",
      message: `Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }

  return result;
}

// ============================================================================
// CASE NORMALIZATION AND VALIDATION
// ============================================================================

interface NormalizeResult {
  normalized: Partial<CaseCardData>;
  errors: ImportError[];
  warnings: ImportWarning[];
  needsBeneficiary: boolean;
}

function normalizeAndValidateCase(
  caseData: unknown,
  rowIndex: number,
  _format: DetectedFormat // Preserved for potential future format-specific handling
): NormalizeResult {
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  let needsBeneficiary = false;

  // Must be an object
  if (typeof caseData !== "object" || caseData === null) {
    errors.push({
      row: rowIndex,
      field: "case",
      message: "Case must be an object",
    });
    return { normalized: {}, errors, warnings, needsBeneficiary };
  }

  const data = caseData as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};

  // Step 1: Map all field names to v2 schema
  for (const [key, value] of Object.entries(data)) {
    // Skip internal/system fields
    if (["id", "_id", "userId", "user_id", "order", "_migration_info"].includes(key)) {
      continue;
    }

    // Map field name
    const mappedKey = FIELD_NAME_MAP[key] || key;

    // Don't overwrite if we already have this field
    if (mappedKey in normalized && normalized[mappedKey] !== undefined) {
      continue;
    }

    normalized[mappedKey] = value;
  }

  // Step 2: Extract and validate required fields
  let employerName = normalized.employerName;
  let beneficiaryIdentifier = normalized.beneficiaryIdentifier;
  const positionTitle = normalized.positionTitle;

  // Validate employerName (required)
  if (!employerName || typeof employerName !== "string" || !employerName.trim()) {
    errors.push({
      row: rowIndex,
      field: "employerName",
      message: "employerName is required and must be a non-empty string",
    });
  } else {
    employerName = (employerName as string).trim();
    normalized.employerName = employerName;
  }

  // Handle missing beneficiaryIdentifier (optional field - use placeholder for imports)
  if (!beneficiaryIdentifier || typeof beneficiaryIdentifier !== "string" || !beneficiaryIdentifier.trim()) {
    // Use placeholder for all imports (beneficiaryIdentifier is optional in schema)
    beneficiaryIdentifier = BENEFICIARY_PLACEHOLDER;
    needsBeneficiary = true;
    warnings.push({
      row: rowIndex,
      field: "beneficiaryIdentifier",
      message: `Missing beneficiary name - placeholder "${BENEFICIARY_PLACEHOLDER}" used. Please update after import.`,
      employerName: typeof employerName === "string" ? employerName : undefined,
      originalValue: typeof positionTitle === "string" ? positionTitle : undefined,
    });
  } else {
    beneficiaryIdentifier = (beneficiaryIdentifier as string).trim();
  }
  normalized.beneficiaryIdentifier = beneficiaryIdentifier;

  /**
   * Map status with case-insensitive fallback
   */
  function mapStatus(
    value: unknown,
    field: string,
    statusMap: Record<string, string>,
    validStatuses: readonly string[],
    defaultValue: string
  ): { mapped: string; original: string; isComplete: boolean } {
    if (value === undefined || value === null) {
      return { mapped: defaultValue, original: "", isComplete: false };
    }

    const originalStatus = String(value);
    const isComplete = originalStatus.toLowerCase() === "complete";

    // Direct lookup
    let mappedStatus = statusMap[originalStatus];

    // Case-insensitive fallback
    if (!mappedStatus) {
      const lowerStatus = originalStatus.toLowerCase();
      for (const [key, mapValue] of Object.entries(statusMap)) {
        if (key.toLowerCase() === lowerStatus) {
          mappedStatus = mapValue;
          break;
        }
      }
    }

    // Validate result
    if (mappedStatus) {
      if (mappedStatus !== originalStatus.toLowerCase().replace(/ /g, "_")) {
        warnings.push({
          row: rowIndex,
          field,
          message: `Mapped ${field} "${originalStatus}" → "${mappedStatus}"`,
          employerName: typeof employerName === "string" ? employerName : undefined,
          originalValue: originalStatus,
        });
      }
      return { mapped: mappedStatus, original: originalStatus, isComplete };
    }

    // Unknown status - use default
    if (!validStatuses.includes(originalStatus as typeof validStatuses[number])) {
      warnings.push({
        row: rowIndex,
        field,
        message: `Unknown ${field} "${originalStatus}" - defaulting to "${defaultValue}"`,
        employerName: typeof employerName === "string" ? employerName : undefined,
        originalValue: originalStatus,
      });
      return { mapped: defaultValue, original: originalStatus, isComplete };
    }

    return { mapped: originalStatus, original: originalStatus, isComplete };
  }

  // Step 3: Map and validate case status
  const caseStatusResult = mapStatus(
    normalized.caseStatus,
    "caseStatus",
    CASE_STATUS_MAP,
    VALID_CASE_STATUSES,
    "pwd"
  );
  normalized.caseStatus = caseStatusResult.mapped;
  const originalCaseStatusWasComplete = caseStatusResult.isComplete;

  // Step 4: Map and validate progress status
  const progressStatusResult = mapStatus(
    normalized.progressStatus,
    "progressStatus",
    PROGRESS_STATUS_MAP,
    VALID_PROGRESS_STATUSES,
    "working"
  );
  normalized.progressStatus = progressStatusResult.mapped;

  // Per perm_flow.md: "i-140 approved makes it complete"
  // If original case_status was "Complete", force progressStatus to "approved"
  if (originalCaseStatusWasComplete) {
    normalized.progressStatus = "approved";
    warnings.push({
      row: rowIndex,
      field: "progressStatus",
      message: `Case with "Complete" status automatically set to progressStatus "approved"`,
      employerName: typeof employerName === "string" ? employerName : undefined,
    });
  }

  // Step 5: Normalize all date fields
  for (const dateField of V2_DATE_FIELDS) {
    const value = normalized[dateField];
    if (value !== undefined && value !== null && value !== "") {
      const normalizedDate = normalizeDate(value);
      if (normalizedDate) {
        normalized[dateField] = normalizedDate;
      } else {
        warnings.push({
          row: rowIndex,
          field: dateField,
          message: `Could not parse date value "${value}" - field will be empty`,
          employerName: typeof employerName === "string" ? employerName : undefined,
          originalValue: String(value),
        });
        delete normalized[dateField];
      }
    }
  }

  // Step 6: Handle legacy RFE arrays (perm-tracker-new format)
  if (normalized.rfes && Array.isArray(normalized.rfes)) {
    const convertedRFEs = convertLegacyRFEs(normalized.rfes);
    if (convertedRFEs.length > 0) {
      normalized.rfeEntries = convertedRFEs;
      warnings.push({
        row: rowIndex,
        field: "rfes",
        message: `Converted ${convertedRFEs.length} legacy RFE entries to v2 format`,
        employerName: typeof employerName === "string" ? employerName : undefined,
      });
    }
    delete normalized.rfes;
  }

  // Step 6b: Handle v1 rfi_list array format (mapped to rfiList)
  if (normalized.rfiList && Array.isArray(normalized.rfiList)) {
    const convertedRFIs = convertV1RFIList(normalized.rfiList);
    if (convertedRFIs.length > 0) {
      normalized.rfiEntries = convertedRFIs;
      warnings.push({
        row: rowIndex,
        field: "rfi_list",
        message: `Converted ${convertedRFIs.length} RFI entries from v1 rfi_list format`,
        employerName: typeof employerName === "string" ? employerName : undefined,
      });
    }
    delete normalized.rfiList;
  }

  // Step 6c: Handle v1 rfe_list array format (mapped to rfeList)
  if (normalized.rfeList && Array.isArray(normalized.rfeList) && !normalized.rfeEntries) {
    const convertedRFEs = convertV1RFEList(normalized.rfeList);
    if (convertedRFEs.length > 0) {
      normalized.rfeEntries = convertedRFEs;
      warnings.push({
        row: rowIndex,
        field: "rfe_list",
        message: `Converted ${convertedRFEs.length} RFE entries from v1 rfe_list format`,
        employerName: typeof employerName === "string" ? employerName : undefined,
      });
    }
    delete normalized.rfeList;
  }

  // Step 7: Handle legacy single RFI/RFE fields (v1 format)
  const legacyRfiFields = ["rfiReceivedDate", "rfiResponseDueDate", "rfiResponseSubmittedDate"];
  const legacyRfeFields = ["rfeReceivedDate", "rfeResponseDueDate", "rfeResponseSubmittedDate"];

  const hasLegacyRfi = legacyRfiFields.some(f => normalized[f]);
  const hasLegacyRfe = legacyRfeFields.some(f => normalized[f]);

  if (hasLegacyRfi) {
    const rfiEntry = {
      id: `imported-rfi-${Date.now()}-${rowIndex}`,
      receivedDate: normalizeDate(normalized.rfiReceivedDate) || "",
      responseDueDate: normalizeDate(normalized.rfiResponseDueDate) || "",
      responseSubmittedDate: normalizeDate(normalized.rfiResponseSubmittedDate) || undefined,
      createdAt: Date.now(),
    };
    normalized.rfiEntries = [rfiEntry];
    legacyRfiFields.forEach(f => delete normalized[f]);
    warnings.push({
      row: rowIndex,
      field: "rfi",
      message: "Converted legacy RFI fields to rfiEntries array",
      employerName: typeof employerName === "string" ? employerName : undefined,
    });
  }

  if (hasLegacyRfe && !normalized.rfeEntries) {
    const rfeEntry = {
      id: `imported-rfe-${Date.now()}-${rowIndex}`,
      receivedDate: normalizeDate(normalized.rfeReceivedDate) || "",
      responseDueDate: normalizeDate(normalized.rfeResponseDueDate) || "",
      responseSubmittedDate: normalizeDate(normalized.rfeResponseSubmittedDate) || undefined,
      createdAt: Date.now(),
    };
    normalized.rfeEntries = [rfeEntry];
    legacyRfeFields.forEach(f => delete normalized[f]);
    warnings.push({
      row: rowIndex,
      field: "rfe",
      message: "Converted legacy RFE fields to rfeEntries array",
      employerName: typeof employerName === "string" ? employerName : undefined,
    });
  }

  // Step 8: Parse additionalRecruitmentMethods if it's a JSON string
  if (typeof normalized.additionalRecruitmentMethods === "string") {
    const jsonStr = normalized.additionalRecruitmentMethods;
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        // Map v1 format to v2 format:
        // V1: { type, date|dates, outlet|description }
        // V2: { method, date, description }
        // Note: V1 uses "dates" array for some methods (e.g., radio_ad with broadcast dates)
        normalized.additionalRecruitmentMethods = parsed.map((m: Record<string, unknown>) => {
          // Get date - prefer "date" string, fallback to first element of "dates" array
          let methodDate: string = "";
          if (m.date) {
            methodDate = normalizeDate(m.date) || "";
          } else if (Array.isArray(m.dates) && m.dates.length > 0) {
            // V1 uses "dates" array for broadcast/radio ads
            methodDate = normalizeDate(m.dates[0]) || "";
          }
          return {
            method: (m.type as string) || (m.method as string) || "",
            date: methodDate,
            description: (m.description as string) || (m.outlet as string) || "",
          };
        });
        warnings.push({
          row: rowIndex,
          field: "additionalRecruitmentMethods",
          message: `Parsed ${parsed.length} recruitment methods from JSON string`,
          employerName: typeof employerName === "string" ? employerName : undefined,
        });
      } else {
        normalized.additionalRecruitmentMethods = [];
      }
    } catch {
      warnings.push({
        row: rowIndex,
        field: "additionalRecruitmentMethods",
        message: `Could not parse additionalRecruitmentMethods JSON string: "${jsonStr.substring(0, 50)}..."`,
        employerName: typeof employerName === "string" ? employerName : undefined,
      });
      normalized.additionalRecruitmentMethods = [];
    }
  }

  // Step 8b: Convert simple notes string to array format
  // v1/export format may have notes as a simple string like "case note"
  // v2 schema expects notes as array of objects with id, content, createdAt, status
  if (typeof normalized.notes === "string" && normalized.notes.trim()) {
    const noteContent = normalized.notes.trim();
    normalized.notes = [{
      id: `imported-note-${Date.now()}-${rowIndex}`,
      content: noteContent,
      createdAt: Date.now(),
      status: "pending" as const,
    }];
    warnings.push({
      row: rowIndex,
      field: "notes",
      message: `Converted notes string to array format: "${noteContent.substring(0, 30)}${noteContent.length > 30 ? "..." : ""}"`,
      employerName: typeof employerName === "string" ? employerName : undefined,
    });
  } else if (normalized.notes !== undefined && !Array.isArray(normalized.notes)) {
    // Non-string, non-array notes field - clear it
    delete normalized.notes;
  }

  // Step 9: Ensure arrays default to empty
  if (!normalized.rfiEntries) normalized.rfiEntries = [];
  if (!normalized.rfeEntries) normalized.rfeEntries = [];
  if (!normalized.additionalRecruitmentMethods) normalized.additionalRecruitmentMethods = [];
  if (!normalized.tags) normalized.tags = [];
  if (!normalized.documents) normalized.documents = [];
  if (!normalized.notes) normalized.notes = [];

  // Step 10: Clean up any remaining fields that shouldn't be imported
  const fieldsToRemove = [
    "createdAt", "updatedAt", "lastUpdated", "created_at", "updated_at",
    "recruitmentStartDate", "recruitmentEndDate", // These are calculated
    "filingWindowOpens", "filingWindowCloses", "recruitmentWindowCloses", // Calculated
  ];
  fieldsToRemove.forEach(f => delete normalized[f]);

  // Step 11: Remove all null/undefined values - Convex doesn't accept null for optional fields
  for (const key of Object.keys(normalized)) {
    if (normalized[key] === null || normalized[key] === undefined) {
      delete normalized[key];
    }
  }

  return { normalized: normalized as Partial<CaseCardData>, errors, warnings, needsBeneficiary };
}

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

export function detectDuplicates(
  importedCases: Partial<CaseCardData>[],
  existingCases: Array<{ _id: string; employerName: string; beneficiaryIdentifier: string }>
): DuplicateCase[] {
  const duplicates: DuplicateCase[] = [];

  importedCases.forEach((importedCase, index) => {
    if (!importedCase.employerName || !importedCase.beneficiaryIdentifier) {
      return;
    }

    // Skip placeholder beneficiaries for duplicate detection
    if (importedCase.beneficiaryIdentifier === BENEFICIARY_PLACEHOLDER) {
      return;
    }

    const normalizedEmployer = importedCase.employerName.toLowerCase().trim();
    const normalizedBeneficiary = importedCase.beneficiaryIdentifier.toLowerCase().trim();

    const existingMatch = existingCases.find((existing) => {
      const existingEmployer = existing.employerName.toLowerCase().trim();
      const existingBeneficiary = existing.beneficiaryIdentifier.toLowerCase().trim();

      return (
        existingEmployer === normalizedEmployer &&
        existingBeneficiary === normalizedBeneficiary
      );
    });

    if (existingMatch) {
      duplicates.push({
        row: index,
        importedCase,
        existingCase: existingMatch,
      });
    }
  });

  return duplicates;
}

export function filterOutDuplicates(
  validCases: Partial<CaseCardData>[],
  duplicates: DuplicateCase[]
): Partial<CaseCardData>[] {
  const duplicateRows = new Set(duplicates.map((d) => d.row));
  return validCases.filter((_, index) => !duplicateRows.has(index));
}

