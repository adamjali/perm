/**
 * Shared types for PERM Tracker.
 *
 * This file consolidates duplicate type definitions that were previously
 * scattered across multiple files. All RFI/RFE and recruitment-related
 * types are now defined here and imported elsewhere.
 *
 * Previously duplicated in:
 * - src/lib/timeline/types.ts
 * - src/lib/calendar/types.ts
 * - src/components/cases/detail/RFIRFESection.tsx
 * - src/components/forms/sections/RecruitmentSection.tsx
 * - src/components/forms/sections/ProfessionalSection.tsx
 */

// ============================================================================
// RFI Entry Types
// ============================================================================

/**
 * RFI (Request for Information) entry structure.
 *
 * RFIs are issued by DOL during ETA 9089 application review.
 * Response due date is auto-calculated: received date + 30 days.
 */
export interface RfiEntry {
  /** Unique identifier for the entry */
  id: string;
  /** Title/subject of the RFI */
  title?: string;
  /** Detailed description of what's being requested */
  description?: string;
  /** Internal notes about the RFI */
  notes?: string;
  /** Date RFI was received (ISO string YYYY-MM-DD) */
  receivedDate: string;
  /** Auto-calculated: receivedDate + 30 days (ISO string YYYY-MM-DD) */
  responseDueDate: string;
  /** Date response was submitted, if applicable (ISO string YYYY-MM-DD) */
  responseSubmittedDate?: string;
  /** Timestamp when entry was created */
  createdAt: number;
}

/**
 * Factory function to create an RfiEntry with the 30-day response rule.
 *
 * Enforces the invariant that `responseDueDate` is always 30 days after
 * `receivedDate`, as per DOL RFI response requirements.
 *
 * @param params - RFI entry parameters
 * @returns RfiEntry with computed responseDueDate
 * @throws Error if receivedDate is not a valid date format
 */
export function createRfiEntry(params: {
  id: string;
  receivedDate: string;
  title?: string;
  description?: string;
  notes?: string;
  responseSubmittedDate?: string;
}): RfiEntry {
  // Validate receivedDate format
  const receivedDateObj = new Date(params.receivedDate + "T00:00:00Z");
  if (isNaN(receivedDateObj.getTime())) {
    throw new Error("Invalid receivedDate format - expected YYYY-MM-DD");
  }

  // Calculate responseDueDate: receivedDate + 30 days
  const dueDate = new Date(receivedDateObj);
  dueDate.setUTCDate(dueDate.getUTCDate() + 30);
  const responseDueDate = dueDate.toISOString().split("T")[0]!;

  return {
    id: params.id,
    receivedDate: params.receivedDate,
    responseDueDate,
    createdAt: Date.now(),
    title: params.title,
    description: params.description,
    notes: params.notes,
    responseSubmittedDate: params.responseSubmittedDate,
  };
}

// ============================================================================
// RFE Entry Types
// ============================================================================

/**
 * RFE (Request for Evidence) entry structure.
 *
 * RFEs are issued by USCIS during I-140 petition review.
 * Response due date is user-editable (varies by case).
 */
export interface RfeEntry {
  /** Unique identifier for the entry */
  id: string;
  /** Title/subject of the RFE */
  title?: string;
  /** Detailed description of what's being requested */
  description?: string;
  /** Internal notes about the RFE */
  notes?: string;
  /** Date RFE was received (ISO string YYYY-MM-DD) */
  receivedDate: string;
  /** User-specified due date (ISO string YYYY-MM-DD) */
  responseDueDate: string;
  /** Date response was submitted, if applicable (ISO string YYYY-MM-DD) */
  responseSubmittedDate?: string;
  /** Timestamp when entry was created */
  createdAt: number;
}

/**
 * Alias for RfiEntry with PascalCase naming (UI component convention).
 * Use RfiEntry for data/backend contexts, RFIEntry for UI components.
 */
export type RFIEntry = RfiEntry;

/**
 * Alias for RfeEntry with PascalCase naming (UI component convention).
 * Use RfeEntry for data/backend contexts, RFEEntry for UI components.
 */
export type RFEEntry = RfeEntry;

// ============================================================================
// Recruitment Types
// ============================================================================

/**
 * Additional recruitment method for professional occupations.
 *
 * Professional occupation cases require 3+ additional recruitment steps
 * beyond the standard job order and Sunday ads.
 */
export interface AdditionalRecruitmentMethod {
  /** Type of recruitment method (e.g., "trade_journal", "campus_placement") */
  method: string;
  /** Date the recruitment activity occurred (ISO string YYYY-MM-DD) */
  date: string;
  /** Optional description or details about the activity */
  description?: string;
}
