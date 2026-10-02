/**
 * Chat Case Data Query Functions
 * ==============================
 *
 * Flexible case query functions for the AI chatbot to access case data.
 * These functions provide powerful filtering and field projection capabilities
 * while maintaining proper authentication and authorization.
 *
 * @module chatCaseData
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { getCurrentUserIdOrNull } from "./lib/auth";
import { readUserCases } from "./lib/userCases";
import { buildDeadlineInput, extractActiveDeadlines, type LooseDeadlineCaseData } from "./lib/perm/deadlines";

/**
 * Type for case document from database
 */
type CaseDoc = Doc<"cases">;

/**
 * Check if a case has any overdue deadlines.
 *
 * Delegates to centralized extractActiveDeadlines from perm/deadlines module
 * which handles supersession logic (e.g., PWD expiration inactive after ETA 9089 filed).
 *
 * @param caseData - The case document to check
 * @param todayISO - Today's date in ISO format (YYYY-MM-DD)
 * @returns True if any active deadline is past due (daysUntil < 0)
 */
function hasOverdueDeadline(caseData: CaseDoc, todayISO: string): boolean {
  const deadlines = extractActiveDeadlines(buildDeadlineInput(caseData as LooseDeadlineCaseData), todayISO);
  return deadlines.some((d) => d.daysUntil < 0);
}

/**
 * Check if a case has any deadline within N days.
 *
 * Delegates to centralized extractActiveDeadlines from perm/deadlines module
 * which handles supersession logic.
 *
 * @param caseData - The case document to check
 * @param days - Number of days to check ahead
 * @param todayISO - Today's date in ISO format (YYYY-MM-DD)
 * @returns True if any active deadline is within the specified days (0 <= daysUntil <= days)
 */
function hasDeadlineWithinDays(
  caseData: CaseDoc,
  days: number,
  todayISO: string
): boolean {
  const deadlines = extractActiveDeadlines(buildDeadlineInput(caseData as LooseDeadlineCaseData), todayISO);
  return deadlines.some((d) => d.daysUntil >= 0 && d.daysUntil <= days);
}

/**
 * Check if a case has any active (unresponded) RFI entries
 *
 * @param caseData - The case document to check
 * @returns True if case has at least one unresponded RFI
 */
function hasActiveRfi(caseData: CaseDoc): boolean {
  const rfiEntries = caseData.rfiEntries ?? [];
  return rfiEntries.some((entry) => !entry.responseSubmittedDate);
}

/**
 * Check if a case has any active (unresponded) RFE entries
 *
 * @param caseData - The case document to check
 * @returns True if case has at least one unresponded RFE
 */
function hasActiveRfe(caseData: CaseDoc): boolean {
  const rfeEntries = caseData.rfeEntries ?? [];
  return rfeEntries.some((entry) => !entry.responseSubmittedDate);
}

/**
 * Check if text matches search query (case-insensitive)
 *
 * @param text - Text to search in
 * @param query - Search query
 * @returns True if text contains query
 */
function matchesSearch(text: string | undefined | null, query: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Project case fields for response
 * Returns only the requested fields, or all fields if returnAllFields is true
 *
 * @param caseData - Full case document
 * @param fields - Array of field names to include
 * @param returnAllFields - If true, return all fields regardless of fields array
 * @returns Projected case data
 */
function projectFields(
  caseData: CaseDoc,
  fields: string[] | undefined,
  returnAllFields: boolean
): Record<string, unknown> {
  // Always include _id
  const result: Record<string, unknown> = {
    _id: caseData._id,
  };

  if (returnAllFields || !fields || fields.length === 0) {
    // Return all fields (excluding internal fields like userId)
    const { userId: _userId, ...rest } = caseData;
    return { ...result, ...rest };
  }

  // Return only requested fields
  for (const field of fields) {
    if (field in caseData && field !== "userId") {
      result[field] = (caseData as Record<string, unknown>)[field];
    }
  }

  return result;
}

/**
 * Flexible case query with all filter options
 *
 * This is the primary query function for the chatbot to retrieve case data.
 * It supports extensive filtering, field projection, and aggregation options.
 *
 * ## Filter Options
 * - `caseStatus`: Filter by case stage (pwd, recruitment, eta9089, i140, closed)
 * - `progressStatus`: Filter by progress status (working, waiting_intake, filed, approved, under_review, rfi_rfe)
 * - `hasRfi`: Filter for cases with active RFI requests
 * - `hasRfe`: Filter for cases with active RFE requests
 * - `hasOverdueDeadline`: Filter for cases with any overdue deadline
 * - `deadlineWithinDays`: Filter for cases with deadlines within N days
 * - `searchText`: Text search across employer name, position title, beneficiary identifier, and notes
 * - `isProfessionalOccupation`: Filter for cases marked as professional occupation (requires Bachelor's degree)
 *
 * ## Projection Options
 * - `fields`: Array of field names to return (default: all fields)
 * - `returnAllFields`: If true, return all fields regardless of fields array
 *
 * ## Aggregation Options
 * - `countOnly`: If true, return only the count of matching cases
 * - `limit`: Maximum number of cases to return (default: 100)
 *
 * @example
 * // Get all cases in recruitment stage
 * queryCases({ caseStatus: "recruitment" })
 *
 * @example
 * // Get cases with overdue deadlines, only return key fields
 * queryCases({
 *   hasOverdueDeadline: true,
 *   fields: ["employerName", "beneficiaryIdentifier", "pwdExpirationDate"]
 * })
 *
 * @example
 * // Count cases with deadlines in next 7 days
 * queryCases({ deadlineWithinDays: 7, countOnly: true })
 *
 * @example
 * // Search for cases by employer name
 * queryCases({ searchText: "Tech Corp" })
 */
export const queryCases = query({
  args: {
    // Status filters (lowercase values matching schema)
    caseStatus: v.optional(
      v.union(
        v.literal("pwd"),
        v.literal("recruitment"),
        v.literal("eta9089"),
        v.literal("i140"),
        v.literal("closed")
      )
    ),
    progressStatus: v.optional(
      v.union(
        v.literal("working"),
        v.literal("waiting_intake"),
        v.literal("filed"),
        v.literal("approved"),
        v.literal("under_review"),
        v.literal("rfi_rfe")
      )
    ),

    // RFI/RFE filters
    hasRfi: v.optional(v.boolean()),
    hasRfe: v.optional(v.boolean()),

    // Deadline filters
    hasOverdueDeadline: v.optional(v.boolean()),
    deadlineWithinDays: v.optional(v.number()),

    // Text search
    searchText: v.optional(v.string()),

    // Professional occupation filter
    isProfessionalOccupation: v.optional(v.boolean()),

    // Field projection
    fields: v.optional(v.array(v.string())),
    returnAllFields: v.optional(v.boolean()),

    // Aggregation
    countOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),

    // Bulk operation mode - returns minimal data for bulk operations
    // When true, returns only _id, employerName, beneficiaryIdentifier, calendarSyncEnabled
    idsOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user (null-safe for sign-out transitions)
    const userId = await getCurrentUserIdOrNull(ctx);

    // Return empty result if not authenticated
    if (userId === null) {
      if (args.countOnly) {
        return { count: 0 };
      }
      return { cases: [], count: 0 };
    }

    // Live cases, newest first (convex/lib/userCases.ts). `accountTruncated`
    // goes out with the answer so the assistant can say its answer covers the
    // newest cases only.
    const read = await readUserCases(ctx, userId);
    const accountTruncated = read.truncated;

    // Get today's date for deadline comparisons
    const todayISO = new Date().toISOString().split("T")[0] as string;

    // Apply filters
    let filteredCases = read.cases;

    // Apply caseStatus filter
    if (args.caseStatus !== undefined) {
      filteredCases = filteredCases.filter(
        (c) => c.caseStatus === args.caseStatus
      );
    }

    // Apply progressStatus filter
    if (args.progressStatus !== undefined) {
      filteredCases = filteredCases.filter(
        (c) => c.progressStatus === args.progressStatus
      );
    }

    // Apply hasRfi filter
    if (args.hasRfi !== undefined) {
      if (args.hasRfi) {
        filteredCases = filteredCases.filter((c) => hasActiveRfi(c));
      } else {
        filteredCases = filteredCases.filter((c) => !hasActiveRfi(c));
      }
    }

    // Apply hasRfe filter
    if (args.hasRfe !== undefined) {
      if (args.hasRfe) {
        filteredCases = filteredCases.filter((c) => hasActiveRfe(c));
      } else {
        filteredCases = filteredCases.filter((c) => !hasActiveRfe(c));
      }
    }

    // Apply hasOverdueDeadline filter
    if (args.hasOverdueDeadline !== undefined) {
      if (args.hasOverdueDeadline) {
        filteredCases = filteredCases.filter((c) =>
          hasOverdueDeadline(c, todayISO)
        );
      } else {
        filteredCases = filteredCases.filter(
          (c) => !hasOverdueDeadline(c, todayISO)
        );
      }
    }

    // Apply deadlineWithinDays filter
    if (args.deadlineWithinDays !== undefined && args.deadlineWithinDays >= 0) {
      filteredCases = filteredCases.filter((c) =>
        hasDeadlineWithinDays(c, args.deadlineWithinDays!, todayISO)
      );
    }

    // Apply text search filter
    if (args.searchText !== undefined && args.searchText.length > 0) {
      const searchQuery = args.searchText;
      filteredCases = filteredCases.filter((c) => {
        // Search across key text fields
        return (
          matchesSearch(c.employerName, searchQuery) ||
          matchesSearch(c.positionTitle, searchQuery) ||
          matchesSearch(c.beneficiaryIdentifier, searchQuery) ||
          // Search in notes array content
          (c.notes ?? []).some((note) => matchesSearch(note.content, searchQuery))
        );
      });
    }

    // Apply professional occupation filter
    if (args.isProfessionalOccupation !== undefined) {
      filteredCases = filteredCases.filter(
        (c) => c.isProfessionalOccupation === args.isProfessionalOccupation
      );
    }

    // Return count only if requested
    if (args.countOnly) {
      return { count: filteredCases.length, accountTruncated };
    }

    // Handle idsOnly mode for bulk operations (minimal data, NO limit)
    // This is used by bulk operations with all=true to get ALL case IDs
    if (args.idsOnly) {
      const minimalCases = filteredCases.map((c) => ({
        _id: c._id,
        employerName: c.employerName,
        beneficiaryIdentifier: c.beneficiaryIdentifier,
        calendarSyncEnabled: c.calendarSyncEnabled,
        caseStatus: c.caseStatus,
      }));
      return {
        totalCount: filteredCases.length,
        returnedCount: minimalCases.length,
        cases: minimalCases,
        accountTruncated,
      };
    }

    // Apply limit for regular queries (not idsOnly)
    const limit = args.limit ?? 100;
    const limitedCases = filteredCases.slice(0, limit);

    // Project fields
    // When no fields specified, use a sensible default to avoid huge payloads
    const returnAllFields = args.returnAllFields ?? false;
    let fieldsToProject = args.fields;
    if (!returnAllFields && (!fieldsToProject || fieldsToProject.length === 0)) {
      // Default to commonly needed fields instead of ALL fields
      // This prevents multi-KB payloads that crash LLM processing
      fieldsToProject = [
        "employerName",
        "beneficiaryIdentifier",
        "positionTitle",
        "caseStatus",
        "progressStatus",
        "priorityLevel",
        "isFavorite",
        "isPinned",
        "calendarSyncEnabled",
        "pwdFilingDate",
        "pwdDeterminationDate",
        "pwdExpirationDate",
        "eta9089FilingDate",
        "eta9089CertificationDate",
        "i140FilingDate",
        "createdAt",
        "updatedAt",
      ];
    }

    const projectedCases = limitedCases.map((c) =>
      projectFields(c, fieldsToProject, returnAllFields)
    );

    return {
      cases: projectedCases,
      count: filteredCases.length,
      accountTruncated,
    };
  },
});

