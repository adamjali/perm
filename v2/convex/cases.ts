import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getCurrentUserId, getCurrentUserIdOrNull, verifyOwnership } from "./lib/auth";
import { logCreate, logUpdate, logDelete } from "./lib/audit";
import {
  createCaseListPagination,
  type CaseListResponse,
  isCaseListSortField,
  isSortOrder,
} from "./lib/caseListTypes";
import { filterBySearch, projectCaseForCard, sortCases, determineReopenStatus } from "./lib/caseListHelpers";
import { calculateDerivedDates } from "./lib/derivedCalculations";
import { validateCase, mapToValidatorFormat, calculateAutoStatus } from "./lib/perm";
import { shouldSendEmail, formatCaseStatus, buildUserNotificationPrefs } from "./lib/notificationHelpers";
import { scheduleCalendarSync, scheduleCalendarSyncBulk } from "./lib/calendarSyncHelpers";
import { loggers } from "./lib/logging";

const log = loggers.cases;

/**
 * Fields that affect calendar event deadlines
 * When any of these change in an update, we need to re-sync calendar events
 */
const DEADLINE_RELEVANT_FIELDS = [
  "pwdExpirationDate",
  "eta9089FilingDate",
  "eta9089ExpirationDate",
  "eta9089CertificationDate",
  "filingWindowOpens",
  "filingWindowCloses",
  "recruitmentWindowCloses",
  "rfiEntries",
  "rfeEntries",
  "calendarSyncEnabled",
  "caseStatus",
  "progressStatus",
] as const;

/**
 * List cases for the current user
 * Supports filtering by status and favorites
 *
 * NOTE: This is a simple list query. For paginated lists with sorting,
 * use listFiltered instead.
 */
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pwd"),
        v.literal("recruitment"),
        v.literal("eta9089"),
        v.literal("i140"),
        v.literal("closed")
      )
    ),
    favoritesOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Use null-safe auth check for graceful sign-out/timeout handling
    const userId = await getCurrentUserIdOrNull(ctx);

    // Return empty array if not authenticated (handles sign-out transitions gracefully)
    if (userId === null) {
      return [];
    }

    // Query cases for user using the by_user_id index with reasonable limit
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .take(1000);

    // Filter out deleted cases
    let filteredCases = cases.filter((c) => c.deletedAt === undefined);

    // Apply status filter if provided
    if (args.status !== undefined) {
      filteredCases = filteredCases.filter((c) => c.caseStatus === args.status);
    }

    // Apply favorites filter if provided
    if (args.favoritesOnly === true) {
      filteredCases = filteredCases.filter((c) => c.isFavorite === true);
    }

    return filteredCases;
  },
});

/**
 * Get a single case by ID
 * Verifies ownership and that case is not deleted.
 *
 * Returns null for security reasons (to avoid leaking info about other users' cases)
 * when: case not found, case is deleted, user doesn't own the case, or user is not authenticated.
 * In development, distinct reasons are logged for debugging.
 */
export const get = query({
  args: {
    id: v.id("cases"),
  },
  handler: async (ctx, args) => {
    // Use null-safe auth check for graceful sign-out/timeout handling
    const userId = await getCurrentUserIdOrNull(ctx);

    // Return null if not authenticated (handles sign-out transitions gracefully)
    if (userId === null) {
      if (process.env.NODE_ENV === "development") {
        log.debug('User not authenticated for get');
      }
      return null;
    }

    const caseDoc = await ctx.db.get(args.id);

    if (!caseDoc) {
      // Case not found in database
      if (process.env.NODE_ENV === "development") {
        log.debug('Case not found', { resourceId: args.id });
      }
      return null;
    }

    // Verify not deleted
    if (caseDoc.deletedAt !== undefined) {
      // Case was soft-deleted
      if (process.env.NODE_ENV === "development") {
        log.debug('Case is deleted', { resourceId: args.id });
      }
      return null;
    }

    // Verify ownership
    if (caseDoc.userId !== userId) {
      // User doesn't own this case (security: don't reveal case exists)
      if (process.env.NODE_ENV === "development") {
        log.debug('Case access denied', { resourceId: args.id, userId });
      }
      return null;
    }

    return caseDoc;
  },
});

/**
 * Create a new case
 * Sets defaults for all optional fields
 */
export const create = mutation({
  args: {
    // Required fields
    employerName: v.string(),
    beneficiaryIdentifier: v.optional(v.string()),
    positionTitle: v.string(),

    // Optional fields with explicit defaults
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
    priorityLevel: v.optional(
      v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent"))
    ),
    isFavorite: v.optional(v.boolean()),
    isPinned: v.optional(v.boolean()),
    isProfessionalOccupation: v.optional(v.boolean()),
    recruitmentApplicantsCount: v.optional(v.number()),
    additionalRecruitmentMethods: v.optional(
      v.array(
        v.object({
          method: v.string(),
          date: v.string(),
          description: v.optional(v.string()),
        })
      )
    ),
    tags: v.optional(v.array(v.string())),
    documents: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          url: v.string(),
          mimeType: v.string(),
          size: v.number(),
          uploadedAt: v.number(),
        })
      )
    ),
    calendarSyncEnabled: v.optional(v.boolean()),
    showOnTimeline: v.optional(v.boolean()),

    // Optional dates (ISO strings)
    pwdFilingDate: v.optional(v.string()),
    pwdDeterminationDate: v.optional(v.string()),
    pwdExpirationDate: v.optional(v.string()),
    pwdCaseNumber: v.optional(v.string()),
    pwdWageAmount: v.optional(v.number()),
    pwdWageLevel: v.optional(v.string()),
    jobOrderStartDate: v.optional(v.string()),
    jobOrderEndDate: v.optional(v.string()),
    sundayAdFirstDate: v.optional(v.string()),
    sundayAdSecondDate: v.optional(v.string()),
    sundayAdNewspaper: v.optional(v.string()),
    additionalRecruitmentStartDate: v.optional(v.string()),
    additionalRecruitmentEndDate: v.optional(v.string()),
    recruitmentNotes: v.optional(v.string()),
    recruitmentSummaryCustom: v.optional(v.string()),
    noticeOfFilingStartDate: v.optional(v.string()),
    noticeOfFilingEndDate: v.optional(v.string()),
    eta9089FilingDate: v.optional(v.string()),
    eta9089AuditDate: v.optional(v.string()),
    eta9089CertificationDate: v.optional(v.string()),
    eta9089ExpirationDate: v.optional(v.string()),
    eta9089CaseNumber: v.optional(v.string()),
    // RFI entries array (replaces single-field RFI)
    rfiEntries: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.optional(v.string()),
          description: v.optional(v.string()),
          notes: v.optional(v.string()),
          receivedDate: v.string(),
          responseDueDate: v.string(),
          responseSubmittedDate: v.optional(v.string()),
          createdAt: v.number(),
        })
      )
    ),
    // RFE entries array (replaces single-field RFE)
    rfeEntries: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.optional(v.string()),
          description: v.optional(v.string()),
          notes: v.optional(v.string()),
          receivedDate: v.string(),
          responseDueDate: v.string(),
          responseSubmittedDate: v.optional(v.string()),
          createdAt: v.number(),
        })
      )
    ),
    i140FilingDate: v.optional(v.string()),
    i140ReceiptDate: v.optional(v.string()),
    i140ReceiptNumber: v.optional(v.string()),
    i140ApprovalDate: v.optional(v.string()),
    i140DenialDate: v.optional(v.string()),
    i140Category: v.optional(v.union(v.literal("EB-1"), v.literal("EB-2"), v.literal("EB-3"))),
    i140PremiumProcessing: v.optional(v.boolean()),
    i140ServiceCenter: v.optional(v.string()),

    // Optional text fields
    caseNumber: v.optional(v.string()),
    internalCaseNumber: v.optional(v.string()),
    employerFein: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    socCode: v.optional(v.string()),
    socTitle: v.optional(v.string()),
    jobOrderState: v.optional(v.string()),
    progressStatusOverride: v.optional(v.boolean()),
    notes: v.optional(
      v.array(
        v.object({
          id: v.string(),
          content: v.string(),
          createdAt: v.number(),
          status: v.union(
            v.literal("pending"),
            v.literal("done"),
            v.literal("deleted")
          ),
          // Extended fields for full journal functionality (optional for backward compatibility)
          priority: v.optional(
            v.union(v.literal("high"), v.literal("medium"), v.literal("low"))
          ),
          category: v.optional(
            v.union(
              v.literal("follow-up"),
              v.literal("document"),
              v.literal("client"),
              v.literal("internal"),
              v.literal("deadline"),
              v.literal("other")
            )
          ),
          dueDate: v.optional(v.string()),
        })
      )
    ),
    calendarEventIds: v.optional(
      v.object({
        pwd_expiration: v.optional(v.string()),
        eta9089_filing_window: v.optional(v.string()),
        eta9089_expiration: v.optional(v.string()),
        i140_filing_deadline: v.optional(v.string()),
        rfi_due: v.optional(v.string()),
        rfe_due: v.optional(v.string()),
        recruitment_end: v.optional(v.string()),
      })
    ),

    // Duplicate tracking: set when user creates a case knowing it's a duplicate
    duplicateOf: v.optional(v.id("cases")),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    const now = Date.now();

    // Calculate derived dates for queryability
    const isProfessionalOccupation = args.isProfessionalOccupation ?? false;
    const derivedDates = calculateDerivedDates({
      sundayAdFirstDate: args.sundayAdFirstDate,
      sundayAdSecondDate: args.sundayAdSecondDate,
      jobOrderStartDate: args.jobOrderStartDate,
      jobOrderEndDate: args.jobOrderEndDate,
      noticeOfFilingStartDate: args.noticeOfFilingStartDate,
      noticeOfFilingEndDate: args.noticeOfFilingEndDate,
      additionalRecruitmentEndDate: args.additionalRecruitmentEndDate,
      additionalRecruitmentMethods: args.additionalRecruitmentMethods,
      pwdExpirationDate: args.pwdExpirationDate,
      isProfessionalOccupation,
    });

    // Validate case data before inserting
    const validationInput = mapToValidatorFormat({
      ...args,
      recruitmentStartDate: derivedDates.recruitmentStartDate,
      recruitmentEndDate: derivedDates.recruitmentEndDate,
    });
    const validationResult = validateCase(validationInput);
    if (!validationResult.valid) {
      const errorMessages = validationResult.errors
        .map((e) => `[${e.ruleId}] ${e.field}: ${e.message}`)
        .join('; ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }

    // Auto-calculate status from dates unless explicitly overridden
    // This ensures status is always consistent with the case data
    const autoStatus = calculateAutoStatus({
      // RFI/RFE entries
      rfiEntries: args.rfiEntries,
      rfeEntries: args.rfeEntries,
      // I-140 dates
      i140ApprovalDate: args.i140ApprovalDate,
      i140DenialDate: args.i140DenialDate,
      i140FilingDate: args.i140FilingDate,
      // ETA 9089 dates
      eta9089CertificationDate: args.eta9089CertificationDate,
      eta9089FilingDate: args.eta9089FilingDate,
      // PWD dates
      pwdDeterminationDate: args.pwdDeterminationDate,
      pwdFilingDate: args.pwdFilingDate,
      // Recruitment dates
      jobOrderStartDate: args.jobOrderStartDate,
      jobOrderEndDate: args.jobOrderEndDate,
      sundayAdFirstDate: args.sundayAdFirstDate,
      sundayAdSecondDate: args.sundayAdSecondDate,
      noticeOfFilingStartDate: args.noticeOfFilingStartDate,
      noticeOfFilingEndDate: args.noticeOfFilingEndDate,
      // Professional occupation
      isProfessionalOccupation,
      additionalRecruitmentMethods: args.additionalRecruitmentMethods,
      additionalRecruitmentEndDate: args.additionalRecruitmentEndDate,
    });

    // Use auto-calculated status unless progressStatusOverride is explicitly true
    // When override is true, use the passed values (or defaults if not passed)
    const effectiveCaseStatus = args.progressStatusOverride
      ? (args.caseStatus ?? "pwd")
      : autoStatus.caseStatus;
    const effectiveProgressStatus = args.progressStatusOverride
      ? (args.progressStatus ?? "working")
      : autoStatus.progressStatus;

    const caseId = await ctx.db.insert("cases", {
      userId: userId as Id<"users">,
      employerName: args.employerName,
      beneficiaryIdentifier: args.beneficiaryIdentifier ?? "",
      positionTitle: args.positionTitle,

      // Apply auto-calculated or overridden status
      caseStatus: effectiveCaseStatus,
      progressStatus: effectiveProgressStatus,
      priorityLevel: args.priorityLevel ?? "normal",
      isFavorite: args.isFavorite ?? false,
      isPinned: args.isPinned ?? false,
      isProfessionalOccupation,
      recruitmentApplicantsCount: args.recruitmentApplicantsCount ?? 0,
      additionalRecruitmentMethods: args.additionalRecruitmentMethods ?? [],
      tags: args.tags ?? [],
      documents: args.documents ?? [],
      calendarSyncEnabled: args.calendarSyncEnabled ?? true,
      showOnTimeline: args.showOnTimeline ?? true,

      // Optional dates
      pwdFilingDate: args.pwdFilingDate,
      pwdDeterminationDate: args.pwdDeterminationDate,
      pwdExpirationDate: args.pwdExpirationDate,
      pwdCaseNumber: args.pwdCaseNumber,
      pwdWageAmount: args.pwdWageAmount,
      pwdWageLevel: args.pwdWageLevel,
      jobOrderStartDate: args.jobOrderStartDate,
      jobOrderEndDate: args.jobOrderEndDate,
      sundayAdFirstDate: args.sundayAdFirstDate,
      sundayAdSecondDate: args.sundayAdSecondDate,
      sundayAdNewspaper: args.sundayAdNewspaper,
      additionalRecruitmentStartDate: args.additionalRecruitmentStartDate,
      additionalRecruitmentEndDate: args.additionalRecruitmentEndDate,
      recruitmentNotes: args.recruitmentNotes,
      recruitmentSummaryCustom: args.recruitmentSummaryCustom,
      noticeOfFilingStartDate: args.noticeOfFilingStartDate,
      noticeOfFilingEndDate: args.noticeOfFilingEndDate,
      // Derived dates (auto-calculated for queryability)
      recruitmentStartDate: derivedDates.recruitmentStartDate ?? undefined,
      recruitmentEndDate: derivedDates.recruitmentEndDate ?? undefined,
      filingWindowOpens: derivedDates.filingWindowOpens ?? undefined,
      filingWindowCloses: derivedDates.filingWindowCloses ?? undefined,
      recruitmentWindowCloses: derivedDates.recruitmentWindowCloses ?? undefined,
      eta9089FilingDate: args.eta9089FilingDate,
      eta9089AuditDate: args.eta9089AuditDate,
      eta9089CertificationDate: args.eta9089CertificationDate,
      eta9089ExpirationDate: args.eta9089ExpirationDate,
      eta9089CaseNumber: args.eta9089CaseNumber,
      // RFI/RFE entries arrays (default to empty)
      rfiEntries: args.rfiEntries ?? [],
      rfeEntries: args.rfeEntries ?? [],
      i140FilingDate: args.i140FilingDate,
      i140ReceiptDate: args.i140ReceiptDate,
      i140ReceiptNumber: args.i140ReceiptNumber,
      i140ApprovalDate: args.i140ApprovalDate,
      i140DenialDate: args.i140DenialDate,
      i140Category: args.i140Category,
      i140PremiumProcessing: args.i140PremiumProcessing,
      i140ServiceCenter: args.i140ServiceCenter,

      // Optional text fields
      caseNumber: args.caseNumber,
      internalCaseNumber: args.internalCaseNumber,
      employerFein: args.employerFein,
      jobTitle: args.jobTitle,
      socCode: args.socCode,
      socTitle: args.socTitle,
      jobOrderState: args.jobOrderState,
      progressStatusOverride: args.progressStatusOverride,
      notes: args.notes,
      calendarEventIds: args.calendarEventIds,

      // Duplicate tracking
      duplicateOf: args.duplicateOf,
      markedAsDuplicateAt: args.duplicateOf ? now : undefined,

      // Timestamps
      createdAt: now,
      updatedAt: now,
    });

    // Audit log: record the case creation
    try {
      const newCase = await ctx.db.get(caseId);
      await logCreate(ctx, "cases", caseId, newCase as Record<string, unknown>);
    } catch (auditError) {
      // Log audit failure but don't fail the operation - case was created successfully
      log.error('Failed to log case creation', { resourceId: caseId, error: auditError instanceof Error ? auditError.message : String(auditError) });
    }

    // Create notification for case creation (v1 parity)
    // Check if user has emailStatusUpdates enabled before creating notification
    try {
      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
        .first();

      // Default to creating notification if profile doesn't exist or emailStatusUpdates is true
      if (!userProfile || userProfile.emailStatusUpdates) {
        const notificationId = await ctx.runMutation(internal.notifications.createNotification, {
          userId: userId as Id<"users">,
          caseId: caseId,
          type: "status_change",
          title: "New Case Created",
          message: `Case for ${args.beneficiaryIdentifier || "beneficiary"} at ${args.employerName} has been created.`,
          priority: "normal",
        });

        // Schedule email if preferences allow
        if (shouldSendEmail("status_change", "normal", buildUserNotificationPrefs(userProfile))) {
          // Get user email from users table
          const user = await ctx.db.get(userId as Id<"users">);
          if (user?.email) {
            await ctx.scheduler.runAfter(0, internal.notificationActions.sendStatusChangeEmail, {
              notificationId,
              to: user.email,
              beneficiaryName: args.beneficiaryIdentifier || "Beneficiary",
              companyName: args.employerName,
              previousStatus: "N/A",
              newStatus: "Created",
              changeType: "stage",
              changedAt: new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              caseId: caseId.toString(),
              caseNumber: args.internalCaseNumber,
            });
          }
        }
      }
    } catch (notificationError) {
      // Log notification failure but don't fail the operation - case was created successfully
      log.error('Failed to create case creation notification', { resourceId: caseId, error: notificationError instanceof Error ? notificationError.message : String(notificationError) });
    }

    // Schedule Google Calendar sync for the new case (best-effort, non-blocking)
    // Only sync if case-level calendarSyncEnabled is not explicitly false
    if (args.calendarSyncEnabled !== false) {
      try {
        const syncResult = await scheduleCalendarSync(ctx, userId as Id<"users">, caseId);
        if (syncResult.scheduled) {
          log.info('Scheduled sync for new case', { resourceId: caseId });
        }
      } catch (calendarError) {
        // Log calendar sync failure but don't fail the operation - case was created successfully
        log.error('Failed to schedule sync for new case', { resourceId: caseId, error: calendarError instanceof Error ? calendarError.message : String(calendarError) });
      }
    }

    return caseId;
  },
});

/**
 * Update an existing case
 * Verifies ownership before allowing updates
 */
export const update = mutation({
  args: {
    id: v.id("cases"),

    // All case fields are optional for updates
    employerName: v.optional(v.string()),
    beneficiaryIdentifier: v.optional(v.string()),
    positionTitle: v.optional(v.string()),
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
    priorityLevel: v.optional(
      v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent"))
    ),
    isFavorite: v.optional(v.boolean()),
    isPinned: v.optional(v.boolean()),
    isProfessionalOccupation: v.optional(v.boolean()),
    recruitmentApplicantsCount: v.optional(v.number()),
    additionalRecruitmentMethods: v.optional(
      v.array(
        v.object({
          method: v.string(),
          date: v.string(),
          description: v.optional(v.string()),
        })
      )
    ),
    tags: v.optional(v.array(v.string())),
    documents: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          url: v.string(),
          mimeType: v.string(),
          size: v.number(),
          uploadedAt: v.number(),
        })
      )
    ),
    calendarSyncEnabled: v.optional(v.boolean()),
    showOnTimeline: v.optional(v.boolean()),
    pwdFilingDate: v.optional(v.string()),
    pwdDeterminationDate: v.optional(v.string()),
    pwdExpirationDate: v.optional(v.string()),
    pwdCaseNumber: v.optional(v.string()),
    pwdWageAmount: v.optional(v.number()),
    pwdWageLevel: v.optional(v.string()),
    jobOrderStartDate: v.optional(v.string()),
    jobOrderEndDate: v.optional(v.string()),
    sundayAdFirstDate: v.optional(v.string()),
    sundayAdSecondDate: v.optional(v.string()),
    sundayAdNewspaper: v.optional(v.string()),
    additionalRecruitmentStartDate: v.optional(v.string()),
    additionalRecruitmentEndDate: v.optional(v.string()),
    recruitmentNotes: v.optional(v.string()),
    recruitmentSummaryCustom: v.optional(v.string()),
    noticeOfFilingStartDate: v.optional(v.string()),
    noticeOfFilingEndDate: v.optional(v.string()),
    eta9089FilingDate: v.optional(v.string()),
    eta9089AuditDate: v.optional(v.string()),
    eta9089CertificationDate: v.optional(v.string()),
    eta9089ExpirationDate: v.optional(v.string()),
    eta9089CaseNumber: v.optional(v.string()),
    // RFI entries array (replaces single-field RFI)
    rfiEntries: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.optional(v.string()),
          description: v.optional(v.string()),
          notes: v.optional(v.string()),
          receivedDate: v.string(),
          responseDueDate: v.string(),
          responseSubmittedDate: v.optional(v.string()),
          createdAt: v.number(),
        })
      )
    ),
    // RFE entries array (replaces single-field RFE)
    rfeEntries: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.optional(v.string()),
          description: v.optional(v.string()),
          notes: v.optional(v.string()),
          receivedDate: v.string(),
          responseDueDate: v.string(),
          responseSubmittedDate: v.optional(v.string()),
          createdAt: v.number(),
        })
      )
    ),
    i140FilingDate: v.optional(v.string()),
    i140ReceiptDate: v.optional(v.string()),
    i140ReceiptNumber: v.optional(v.string()),
    i140ApprovalDate: v.optional(v.string()),
    i140DenialDate: v.optional(v.string()),
    i140Category: v.optional(v.union(v.literal("EB-1"), v.literal("EB-2"), v.literal("EB-3"))),
    i140PremiumProcessing: v.optional(v.boolean()),
    i140ServiceCenter: v.optional(v.string()),
    caseNumber: v.optional(v.string()),
    internalCaseNumber: v.optional(v.string()),
    employerFein: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    socCode: v.optional(v.string()),
    socTitle: v.optional(v.string()),
    jobOrderState: v.optional(v.string()),
    progressStatusOverride: v.optional(v.boolean()),
    notes: v.optional(
      v.array(
        v.object({
          id: v.string(),
          content: v.string(),
          createdAt: v.number(),
          status: v.union(
            v.literal("pending"),
            v.literal("done"),
            v.literal("deleted")
          ),
          // Extended fields for full journal functionality (optional for backward compatibility)
          priority: v.optional(
            v.union(v.literal("high"), v.literal("medium"), v.literal("low"))
          ),
          category: v.optional(
            v.union(
              v.literal("follow-up"),
              v.literal("document"),
              v.literal("client"),
              v.literal("internal"),
              v.literal("deadline"),
              v.literal("other")
            )
          ),
          dueDate: v.optional(v.string()),
        })
      )
    ),
    calendarEventIds: v.optional(
      v.object({
        pwd_expiration: v.optional(v.string()),
        eta9089_filing_window: v.optional(v.string()),
        eta9089_expiration: v.optional(v.string()),
        i140_filing_deadline: v.optional(v.string()),
        rfi_due: v.optional(v.string()),
        rfe_due: v.optional(v.string()),
        recruitment_end: v.optional(v.string()),
      })
    ),

    // Duplicate tracking
    duplicateOf: v.optional(v.id("cases")),
    markedAsDuplicateAt: v.optional(v.number()),

    // Job description fields
    jobDescription: v.optional(v.string()),
    jobDescriptionPositionTitle: v.optional(v.string()),
    jobDescriptionTemplateId: v.optional(v.id("jobDescriptionTemplates")),
  },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db.get(args.id);

    // Verify ownership (throws if not found or not owned by user)
    await verifyOwnership(ctx, caseDoc, "case");

    // Check not deleted
    if (caseDoc!.deletedAt !== undefined) {
      throw new Error("Cannot update deleted case");
    }

    // Capture old state for audit logging
    const oldDoc = caseDoc;

    // Extract ID field, then build the updates object
    const { id: _id, ...updates } = args;

    // Merge existing case data with updates to calculate derived dates
    // Use updated values if provided, otherwise fall back to existing values
    const mergedData = {
      sundayAdFirstDate: args.sundayAdFirstDate ?? caseDoc!.sundayAdFirstDate,
      sundayAdSecondDate: args.sundayAdSecondDate ?? caseDoc!.sundayAdSecondDate,
      jobOrderStartDate: args.jobOrderStartDate ?? caseDoc!.jobOrderStartDate,
      jobOrderEndDate: args.jobOrderEndDate ?? caseDoc!.jobOrderEndDate,
      noticeOfFilingStartDate: args.noticeOfFilingStartDate ?? caseDoc!.noticeOfFilingStartDate,
      noticeOfFilingEndDate: args.noticeOfFilingEndDate ?? caseDoc!.noticeOfFilingEndDate,
      additionalRecruitmentEndDate: args.additionalRecruitmentEndDate ?? caseDoc!.additionalRecruitmentEndDate,
      additionalRecruitmentMethods: args.additionalRecruitmentMethods ?? caseDoc!.additionalRecruitmentMethods,
      pwdExpirationDate: args.pwdExpirationDate ?? caseDoc!.pwdExpirationDate,
      isProfessionalOccupation: args.isProfessionalOccupation ?? caseDoc!.isProfessionalOccupation,
    };

    // Recalculate derived dates based on merged data
    const derivedDates = calculateDerivedDates(mergedData);

    // Validate merged case data before updating
    const fullCaseData = {
      // PWD dates
      pwdFilingDate: args.pwdFilingDate ?? caseDoc!.pwdFilingDate,
      pwdDeterminationDate: args.pwdDeterminationDate ?? caseDoc!.pwdDeterminationDate,
      pwdExpirationDate: args.pwdExpirationDate ?? caseDoc!.pwdExpirationDate,
      // Recruitment dates
      sundayAdFirstDate: mergedData.sundayAdFirstDate,
      sundayAdSecondDate: mergedData.sundayAdSecondDate,
      jobOrderStartDate: mergedData.jobOrderStartDate,
      jobOrderEndDate: mergedData.jobOrderEndDate,
      noticeOfFilingStartDate: mergedData.noticeOfFilingStartDate,
      noticeOfFilingEndDate: mergedData.noticeOfFilingEndDate,
      additionalRecruitmentMethods: mergedData.additionalRecruitmentMethods,
      additionalRecruitmentEndDate: mergedData.additionalRecruitmentEndDate,
      isProfessionalOccupation: mergedData.isProfessionalOccupation,
      recruitmentStartDate: derivedDates.recruitmentStartDate,
      recruitmentEndDate: derivedDates.recruitmentEndDate,
      // ETA 9089 dates
      eta9089FilingDate: args.eta9089FilingDate ?? caseDoc!.eta9089FilingDate,
      eta9089CertificationDate: args.eta9089CertificationDate ?? caseDoc!.eta9089CertificationDate,
      eta9089ExpirationDate: args.eta9089ExpirationDate ?? caseDoc!.eta9089ExpirationDate,
      // I-140 dates
      i140FilingDate: args.i140FilingDate ?? caseDoc!.i140FilingDate,
      i140ApprovalDate: args.i140ApprovalDate ?? caseDoc!.i140ApprovalDate,
      // RFI/RFE entries
      rfiEntries: args.rfiEntries ?? caseDoc!.rfiEntries,
      rfeEntries: args.rfeEntries ?? caseDoc!.rfeEntries,
      // Status
      caseStatus: args.caseStatus ?? caseDoc!.caseStatus,
      progressStatus: args.progressStatus ?? caseDoc!.progressStatus,
    };
    const validationInput = mapToValidatorFormat(fullCaseData);
    const validationResult = validateCase(validationInput);
    if (!validationResult.valid) {
      const errorMessages = validationResult.errors
        .map((e) => `[${e.ruleId}] ${e.field}: ${e.message}`)
        .join('; ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }

    // Auto-calculate status from merged dates unless explicitly overridden
    // Check both passed override flag and existing override flag
    const isOverridden = args.progressStatusOverride ?? caseDoc!.progressStatusOverride ?? false;
    const autoStatus = calculateAutoStatus({
      // RFI/RFE entries (merged)
      rfiEntries: fullCaseData.rfiEntries,
      rfeEntries: fullCaseData.rfeEntries,
      // I-140 dates (merged)
      i140ApprovalDate: fullCaseData.i140ApprovalDate,
      i140DenialDate: args.i140DenialDate ?? caseDoc!.i140DenialDate,
      i140FilingDate: fullCaseData.i140FilingDate,
      // ETA 9089 dates (merged)
      eta9089CertificationDate: fullCaseData.eta9089CertificationDate,
      eta9089FilingDate: fullCaseData.eta9089FilingDate,
      // PWD dates (merged)
      pwdDeterminationDate: fullCaseData.pwdDeterminationDate,
      pwdFilingDate: fullCaseData.pwdFilingDate,
      // Recruitment dates (merged)
      jobOrderStartDate: fullCaseData.jobOrderStartDate,
      jobOrderEndDate: fullCaseData.jobOrderEndDate,
      sundayAdFirstDate: fullCaseData.sundayAdFirstDate,
      sundayAdSecondDate: fullCaseData.sundayAdSecondDate,
      noticeOfFilingStartDate: fullCaseData.noticeOfFilingStartDate,
      noticeOfFilingEndDate: fullCaseData.noticeOfFilingEndDate,
      // Professional occupation (merged)
      isProfessionalOccupation: fullCaseData.isProfessionalOccupation ?? false,
      additionalRecruitmentMethods: fullCaseData.additionalRecruitmentMethods,
      additionalRecruitmentEndDate: fullCaseData.additionalRecruitmentEndDate,
    });

    // Build updates with auto-calculated status if not overridden
    const statusUpdates = isOverridden
      ? {} // Don't override user's manual status selection
      : {
          caseStatus: autoStatus.caseStatus,
          progressStatus: autoStatus.progressStatus,
        };

    await ctx.db.patch(args.id, {
      ...updates,
      ...statusUpdates,
      // Always recalculate derived dates on update
      recruitmentStartDate: derivedDates.recruitmentStartDate ?? undefined,
      recruitmentEndDate: derivedDates.recruitmentEndDate ?? undefined,
      filingWindowOpens: derivedDates.filingWindowOpens ?? undefined,
      filingWindowCloses: derivedDates.filingWindowCloses ?? undefined,
      recruitmentWindowCloses: derivedDates.recruitmentWindowCloses ?? undefined,
      updatedAt: Date.now(),
    });

    // Audit log: record the case update
    try {
      const newCase = await ctx.db.get(args.id);
      await logUpdate(
        ctx,
        "cases",
        args.id,
        oldDoc as Record<string, unknown>,
        newCase as Record<string, unknown>
      );
    } catch (auditError) {
      // Log audit failure but don't fail the operation - case was updated successfully
      log.error('Failed to log case update', { resourceId: args.id, error: auditError instanceof Error ? auditError.message : String(auditError) });
    }

    // =========================================================================
    // NOTIFICATIONS: Create notifications for actual changes
    // =========================================================================
    // Determine the ACTUAL applied status (auto-calculated vs explicit)
    const actualNewCaseStatus = isOverridden
      ? (args.caseStatus ?? caseDoc!.caseStatus)
      : autoStatus.caseStatus;
    const actualNewProgressStatus = isOverridden
      ? (args.progressStatus ?? caseDoc!.progressStatus)
      : autoStatus.progressStatus;

    // Build case label: "Employer - Position" format (fallback to just employer)
    const caseLabel = oldDoc!.positionTitle
      ? `${oldDoc!.employerName} - ${oldDoc!.positionTitle}`
      : oldDoc!.employerName;

    // Detect what actually changed
    const caseStatusChanged = actualNewCaseStatus !== oldDoc!.caseStatus;
    const progressStatusChanged = actualNewProgressStatus !== oldDoc!.progressStatus;
    const jobDescriptionChanged =
      args.jobDescription !== undefined &&
      args.jobDescription !== (oldDoc!.jobDescription ?? "");

    try {
      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", oldDoc!.userId))
        .first();

      // 1. Case status change notification
      if (caseStatusChanged) {
        if (!userProfile || userProfile.emailStatusUpdates) {
          const notificationId = await ctx.runMutation(internal.notifications.createNotification, {
            userId: oldDoc!.userId,
            caseId: args.id,
            type: "status_change",
            title: "Case Status Updated",
            message: `Case for ${caseLabel} status changed from ${formatCaseStatus(oldDoc!.caseStatus)} to ${formatCaseStatus(actualNewCaseStatus)}.`,
            priority: "normal",
          });

          // Schedule email if preferences allow
          if (shouldSendEmail("status_change", "normal", buildUserNotificationPrefs(userProfile))) {
            const user = await ctx.db.get(oldDoc!.userId);
            if (user?.email) {
              await ctx.scheduler.runAfter(0, internal.notificationActions.sendStatusChangeEmail, {
                notificationId,
                to: user.email,
                beneficiaryName: oldDoc!.positionTitle || oldDoc!.beneficiaryIdentifier || "Beneficiary",
                companyName: oldDoc!.employerName,
                previousStatus: formatCaseStatus(oldDoc!.caseStatus),
                newStatus: formatCaseStatus(actualNewCaseStatus),
                changeType: "stage",
                changedAt: new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                caseId: args.id.toString(),
                caseNumber: oldDoc!.internalCaseNumber,
              });
            }
          }
        }
      }

      // 2. Progress status change notification (only if caseStatus didn't also change)
      if (progressStatusChanged && !caseStatusChanged) {
        if (!userProfile || userProfile.emailStatusUpdates) {
          await ctx.runMutation(internal.notifications.createNotification, {
            userId: oldDoc!.userId,
            caseId: args.id,
            type: "status_change",
            title: "Case Progress Updated",
            message: `Case for ${caseLabel} progress changed from ${oldDoc!.progressStatus} to ${actualNewProgressStatus}.`,
            priority: "low",
          });
          // Note: Not sending email for progress-only changes to reduce noise
        }
      }

      // 3. Job description change notification
      if (jobDescriptionChanged) {
        await ctx.runMutation(internal.notifications.createNotification, {
          userId: oldDoc!.userId,
          caseId: args.id,
          type: "system",
          title: "Job Description Updated",
          message: `Job description for ${caseLabel} has been updated.`,
          priority: "low",
        });
        // Note: Not sending email for job description changes to reduce noise
      }
    } catch (notificationError) {
      // Log notification failure but don't fail the operation - case was updated successfully
      log.error('Failed to create notification', { resourceId: args.id, error: notificationError instanceof Error ? notificationError.message : String(notificationError) });
    }

    // Schedule Google Calendar sync if deadline-relevant fields changed (best-effort, non-blocking)
    // Check if any of the deadline-relevant fields were provided in the update
    const deadlineFieldsChanged = DEADLINE_RELEVANT_FIELDS.some((field) => {
      return args[field as keyof typeof args] !== undefined;
    });

    // Get the updated case to check calendarSyncEnabled
    const updatedCase = await ctx.db.get(args.id);

    // Only sync if:
    // 1. Deadline-relevant fields changed
    // 2. Case-level calendarSyncEnabled is not explicitly false
    if (deadlineFieldsChanged && updatedCase?.calendarSyncEnabled !== false) {
      try {
        const syncResult = await scheduleCalendarSync(ctx, oldDoc!.userId, args.id);
        if (syncResult.scheduled) {
          log.info('Scheduled sync for updated case', { resourceId: args.id });
        }
      } catch (calendarError) {
        // Log calendar sync failure but don't fail the operation - case was updated successfully
        log.error('Failed to schedule sync for updated case', { resourceId: args.id, error: calendarError instanceof Error ? calendarError.message : String(calendarError) });
      }
    }

    return args.id;
  },
});

/**
 * Hard delete a case with full cascade cleanup
 * Permanently removes the case and cleans up all related data
 */
export const remove = mutation({
  args: {
    id: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db.get(args.id);

    // Verify ownership (throws if not found or not owned by user)
    await verifyOwnership(ctx, caseDoc, "case");

    const userId = caseDoc!.userId;

    // ===== AUDIT LOG FIRST (before deletion) =====
    try {
      await logDelete(ctx, "cases", args.id, caseDoc as Record<string, unknown>);
    } catch (auditError) {
      log.error('Failed to log case deletion', { resourceId: args.id, error: auditError instanceof Error ? auditError.message : String(auditError) });
    }

    // ===== CASCADE CLEANUP =====

    // 1. Cleanup all notifications for this case
    try {
      let hasMore = true;
      while (hasMore) {
        const result = await ctx.runMutation(internal.notifications.cleanupCaseNotifications, {
          caseId: args.id,
        });
        hasMore = result.hasMore;
      }
    } catch (cleanupError) {
      log.error('Failed to cleanup case notifications', { resourceId: args.id, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
    }

    // 2. Schedule calendar event deletion (async/background)
    try {
      await ctx.scheduler.runAfter(
        0,
        internal.googleCalendarActions.deleteCaseCalendarEvents,
        { userId, caseId: args.id }
      );
      log.info('Scheduled event deletion for removed case', { resourceId: args.id });
    } catch (calendarError) {
      log.error('Failed to schedule event deletion for removed case', { resourceId: args.id, error: calendarError instanceof Error ? calendarError.message : String(calendarError) });
    }

    // 3. Remove case ID from userCaseOrder.caseIds array
    try {
      const userCaseOrder = await ctx.db
        .query("userCaseOrder")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .first();

      if (userCaseOrder && userCaseOrder.caseIds.includes(args.id)) {
        await ctx.db.patch(userCaseOrder._id, {
          caseIds: userCaseOrder.caseIds.filter((id) => id !== args.id),
          updatedAt: Date.now(),
        });
      }
    } catch (cleanupError) {
      log.error('Failed to cleanup userCaseOrder', { resourceId: args.id, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
    }

    // 4. Remove case ID from timelinePreferences.selectedCaseIds array
    try {
      const timelinePrefs = await ctx.db
        .query("timelinePreferences")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .first();

      if (timelinePrefs && timelinePrefs.selectedCaseIds?.includes(args.id)) {
        await ctx.db.patch(timelinePrefs._id, {
          selectedCaseIds: timelinePrefs.selectedCaseIds.filter((id) => id !== args.id),
          updatedAt: Date.now(),
        });
      }
    } catch (cleanupError) {
      log.error('Failed to cleanup timelinePreferences', { resourceId: args.id, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
    }

    // 5. Remove case ID from userProfiles.dismissedDeadlines array entries
    try {
      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .first();

      if (userProfile && userProfile.dismissedDeadlines.some((d) => d.caseId === args.id)) {
        await ctx.db.patch(userProfile._id, {
          dismissedDeadlines: userProfile.dismissedDeadlines.filter((d) => d.caseId !== args.id),
          updatedAt: Date.now(),
        });
      }
    } catch (cleanupError) {
      log.error('Failed to cleanup userProfiles.dismissedDeadlines', { resourceId: args.id, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
    }

    // 6. Clear conversations.metadata.relatedCaseId where it matches
    try {
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();

      for (const conv of conversations) {
        if (conv.metadata?.relatedCaseId === args.id) {
          await ctx.db.patch(conv._id, {
            metadata: {
              ...conv.metadata,
              relatedCaseId: undefined,
            },
            updatedAt: Date.now(),
          });
        }
      }
    } catch (cleanupError) {
      log.error('Failed to cleanup conversations.relatedCaseId', { resourceId: args.id, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
    }

    // 7. Clear citation references in conversationMessages where caseId matches
    try {
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();

      for (const conv of conversations) {
        const messages = await ctx.db
          .query("conversationMessages")
          .withIndex("by_conversation_id", (q) => q.eq("conversationId", conv._id))
          .collect();

        for (const msg of messages) {
          if (msg.metadata?.citations?.some((c) => c.caseId === args.id)) {
            await ctx.db.patch(msg._id, {
              metadata: {
                ...msg.metadata,
                citations: msg.metadata.citations.filter((c) => c.caseId !== args.id),
              },
            });
          }
        }
      }
    } catch (cleanupError) {
      log.error('Failed to cleanup conversationMessages citations', { resourceId: args.id, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
    }

    // ===== HARD DELETE THE CASE =====
    await ctx.db.delete(args.id);

    return args.id;
  },
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Bulk hard delete multiple cases with cascade cleanup
 * Permanently removes cases and cleans up all related data
 *
 * @returns Object with counts of successful and failed deletions
 */
export const bulkRemove = mutation({
  args: {
    ids: v.array(v.id("cases")),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const deletedCaseIds: Id<"cases">[] = [];

    for (const id of args.ids) {
      try {
        const caseDoc = await ctx.db.get(id);

        // Skip if case doesn't exist
        if (!caseDoc) {
          failedCount++;
          errors.push(`Case ${id} not found`);
          continue;
        }

        // Skip if not owned by user
        if (caseDoc.userId !== userId) {
          failedCount++;
          errors.push(`Case ${id} not owned by user`);
          continue;
        }

        // ===== AUDIT LOG FIRST (before deletion) =====
        try {
          await logDelete(ctx, "cases", id, caseDoc as Record<string, unknown>);
        } catch (auditError) {
          log.error('Failed to log bulk case deletion', { resourceId: id, error: auditError instanceof Error ? auditError.message : String(auditError) });
        }

        // ===== CASCADE CLEANUP =====

        // 1. Cleanup all notifications for this case
        try {
          let hasMore = true;
          while (hasMore) {
            const result = await ctx.runMutation(internal.notifications.cleanupCaseNotifications, {
              caseId: id,
            });
            hasMore = result.hasMore;
          }
        } catch (cleanupError) {
          log.error('Failed to cleanup case notifications in bulk', { resourceId: id, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
        }

        // 2. Schedule calendar event deletion (async/background)
        try {
          await ctx.scheduler.runAfter(
            0,
            internal.googleCalendarActions.deleteCaseCalendarEvents,
            { userId: userId as Id<"users">, caseId: id }
          );
        } catch (calendarError) {
          log.error('Failed to schedule event deletion in bulk', { resourceId: id, error: calendarError instanceof Error ? calendarError.message : String(calendarError) });
        }

        // ===== HARD DELETE THE CASE =====
        await ctx.db.delete(id);

        deletedCaseIds.push(id);
        successCount++;
      } catch (error) {
        failedCount++;
        errors.push(`Case ${id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // ===== BATCH CLEANUP FOR SHARED RESOURCES (once, after all cases deleted) =====
    if (deletedCaseIds.length > 0) {
      const deletedIdSet = new Set(deletedCaseIds);

      // 3. Remove case IDs from userCaseOrder.caseIds array
      try {
        const userCaseOrder = await ctx.db
          .query("userCaseOrder")
          .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
          .first();

        if (userCaseOrder) {
          const filteredCaseIds = userCaseOrder.caseIds.filter((id) => !deletedIdSet.has(id));
          if (filteredCaseIds.length !== userCaseOrder.caseIds.length) {
            await ctx.db.patch(userCaseOrder._id, {
              caseIds: filteredCaseIds,
              updatedAt: Date.now(),
            });
          }
        }
      } catch (cleanupError) {
        log.error('Failed to cleanup userCaseOrder in bulk', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
      }

      // 4. Remove case IDs from timelinePreferences.selectedCaseIds array
      try {
        const timelinePrefs = await ctx.db
          .query("timelinePreferences")
          .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
          .first();

        if (timelinePrefs?.selectedCaseIds) {
          const filteredCaseIds = timelinePrefs.selectedCaseIds.filter((id) => !deletedIdSet.has(id));
          if (filteredCaseIds.length !== timelinePrefs.selectedCaseIds.length) {
            await ctx.db.patch(timelinePrefs._id, {
              selectedCaseIds: filteredCaseIds,
              updatedAt: Date.now(),
            });
          }
        }
      } catch (cleanupError) {
        log.error('Failed to cleanup timelinePreferences in bulk', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
      }

      // 5. Remove case IDs from userProfiles.dismissedDeadlines array entries
      try {
        const userProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
          .first();

        if (userProfile) {
          const filteredDeadlines = userProfile.dismissedDeadlines.filter((d) => !deletedIdSet.has(d.caseId));
          if (filteredDeadlines.length !== userProfile.dismissedDeadlines.length) {
            await ctx.db.patch(userProfile._id, {
              dismissedDeadlines: filteredDeadlines,
              updatedAt: Date.now(),
            });
          }
        }
      } catch (cleanupError) {
        log.error('Failed to cleanup userProfiles.dismissedDeadlines in bulk', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
      }

      // 6. Clear conversations.metadata.relatedCaseId where it matches
      try {
        const conversations = await ctx.db
          .query("conversations")
          .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
          .collect();

        for (const conv of conversations) {
          if (conv.metadata?.relatedCaseId && deletedIdSet.has(conv.metadata.relatedCaseId)) {
            await ctx.db.patch(conv._id, {
              metadata: {
                ...conv.metadata,
                relatedCaseId: undefined,
              },
              updatedAt: Date.now(),
            });
          }
        }
      } catch (cleanupError) {
        log.error('Failed to cleanup conversations.relatedCaseId in bulk', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
      }

      // 7. Clear citation references in conversationMessages where caseId matches
      try {
        const conversations = await ctx.db
          .query("conversations")
          .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
          .collect();

        for (const conv of conversations) {
          const messages = await ctx.db
            .query("conversationMessages")
            .withIndex("by_conversation_id", (q) => q.eq("conversationId", conv._id))
            .collect();

          for (const msg of messages) {
            if (msg.metadata?.citations?.some((c) => c.caseId && deletedIdSet.has(c.caseId))) {
              await ctx.db.patch(msg._id, {
                metadata: {
                  ...msg.metadata,
                  citations: msg.metadata.citations.filter((c) => !c.caseId || !deletedIdSet.has(c.caseId)),
                },
              });
            }
          }
        }
      } catch (cleanupError) {
        log.error('Failed to cleanup conversationMessages citations in bulk', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
      }
    }

    return {
      successCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
});

/**
 * Bulk update case status (close/archive or re-open)
 *
 * @param ids - Array of case IDs to update
 * @param status - New status to set
 * @returns Object with counts of successful and failed updates
 */
export const bulkUpdateStatus = mutation({
  args: {
    ids: v.array(v.id("cases")),
    status: v.union(
      v.literal("pwd"),
      v.literal("recruitment"),
      v.literal("eta9089"),
      v.literal("i140"),
      v.literal("closed")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const successfulCaseIds: Id<"cases">[] = [];

    for (const id of args.ids) {
      try {
        const caseDoc = await ctx.db.get(id);

        // Skip if case doesn't exist
        if (!caseDoc) {
          failedCount++;
          errors.push(`Case ${id} not found`);
          continue;
        }

        // Skip if not owned by user
        if (caseDoc.userId !== userId) {
          failedCount++;
          errors.push(`Case ${id} not owned by user`);
          continue;
        }

        // Skip if soft-deleted
        if (caseDoc.deletedAt !== undefined) {
          failedCount++;
          errors.push(`Case ${id} is deleted`);
          continue;
        }

        // Skip if already at target status
        if (caseDoc.caseStatus === args.status) {
          failedCount++;
          errors.push(`Case ${id} already has status ${args.status}`);
          continue;
        }

        const oldDoc = caseDoc;

        await ctx.db.patch(id, {
          caseStatus: args.status,
          updatedAt: now,
        });

        // Audit log
        try {
          const newCase = await ctx.db.get(id);
          await logUpdate(
            ctx,
            "cases",
            id,
            oldDoc as Record<string, unknown>,
            newCase as Record<string, unknown>
          );
        } catch (auditError) {
          log.error('Failed to log bulk status update', { resourceId: id, error: auditError instanceof Error ? auditError.message : String(auditError) });
        }

        // Create notification for status change (v1 parity)
        try {
          const userProfile = await ctx.db
            .query("userProfiles")
            .withIndex("by_user_id", (q) => q.eq("userId", oldDoc.userId))
            .first();

          // Default to creating notification if profile doesn't exist or emailStatusUpdates is true
          if (!userProfile || userProfile.emailStatusUpdates) {
            const notificationId = await ctx.runMutation(internal.notifications.createNotification, {
              userId: oldDoc.userId,
              caseId: id,
              type: "status_change",
              title: "Case Status Updated",
              message: `Case for ${oldDoc.beneficiaryIdentifier || "beneficiary"} status changed from ${oldDoc.caseStatus} to ${args.status}.`,
              priority: "normal",
            });

            // Schedule email if preferences allow - limit bulk emails to first 10 cases
            // to prevent overwhelming the user with too many emails at once
            if (successCount < 10 && shouldSendEmail("status_change", "normal", buildUserNotificationPrefs(userProfile))) {
              // Get user email from users table
              const user = await ctx.db.get(oldDoc.userId);
              if (user?.email) {
                await ctx.scheduler.runAfter(0, internal.notificationActions.sendStatusChangeEmail, {
                  notificationId,
                  to: user.email,
                  beneficiaryName: oldDoc.beneficiaryIdentifier || "Beneficiary",
                  companyName: oldDoc.employerName,
                  previousStatus: formatCaseStatus(oldDoc.caseStatus),
                  newStatus: formatCaseStatus(args.status),
                  changeType: "stage",
                  changedAt: new Date().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  caseId: id.toString(),
                  caseNumber: oldDoc.internalCaseNumber,
                });
              }
            }
          }
        } catch (notificationError) {
          log.error('Failed to create bulk status change notification', { resourceId: id, error: notificationError instanceof Error ? notificationError.message : String(notificationError) });
        }

        successCount++;
        successfulCaseIds.push(id);
      } catch (error) {
        failedCount++;
        errors.push(`Case ${id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Schedule calendar sync for successfully updated cases (best-effort, non-blocking)
    // Status changes affect calendar display (e.g., case stage progression)
    if (successfulCaseIds.length > 0) {
      try {
        const syncResult = await scheduleCalendarSyncBulk(ctx, userId as Id<"users">, successfulCaseIds);
        if (syncResult.scheduledCount > 0) {
          log.info('Scheduled bulk sync for status-updated cases', { count: syncResult.scheduledCount });
        }
      } catch (calendarError) {
        // Log calendar sync failure but don't fail the operation - status updates were successful
        log.error('Failed to schedule bulk sync for status updates', { error: calendarError instanceof Error ? calendarError.message : String(calendarError) });
      }
    }

    return {
      successCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
});

/**
 * Bulk update calendar sync state for multiple cases
 *
 * @param ids - Array of case IDs to update
 * @param calendarSyncEnabled - Whether to enable or disable calendar sync
 * @returns Object with counts of successful and failed updates
 */
export const bulkUpdateCalendarSync = mutation({
  args: {
    ids: v.array(v.id("cases")),
    calendarSyncEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();

    let successCount = 0;
    let failedCount = 0;
    const successfulCaseIds: Id<"cases">[] = [];

    for (const id of args.ids) {
      const caseDoc = await ctx.db.get(id);

      // Skip if case doesn't exist
      if (!caseDoc) {
        failedCount++;
        continue;
      }

      // Skip if not owned by user
      if (caseDoc.userId !== userId) {
        failedCount++;
        continue;
      }

      // Skip if soft-deleted
      if (caseDoc.deletedAt !== undefined) {
        failedCount++;
        continue;
      }

      // Skip if already at target state
      if (caseDoc.calendarSyncEnabled === args.calendarSyncEnabled) {
        // Still count as success - it's in the desired state
        successCount++;
        continue;
      }

      await ctx.db.patch(id, {
        calendarSyncEnabled: args.calendarSyncEnabled,
        updatedAt: now,
      });

      successfulCaseIds.push(id);
      successCount++;
    }

    // Schedule calendar operations for changed cases (best-effort, non-blocking)
    if (successfulCaseIds.length > 0) {
      try {
        if (args.calendarSyncEnabled) {
          // Enabling - sync to calendar
          const syncResult = await scheduleCalendarSyncBulk(ctx, userId as Id<"users">, successfulCaseIds);
          if (syncResult.scheduledCount > 0) {
            log.info('Scheduled bulk sync for cases', { count: syncResult.scheduledCount });
          }
        } else {
          // Disabling - delete from calendar
          for (const caseId of successfulCaseIds) {
            await ctx.scheduler.runAfter(
              0,
              internal.googleCalendarActions.deleteCaseCalendarEvents,
              { userId: userId as Id<"users">, caseId }
            );
          }
          log.info('Scheduled bulk delete for cases', { count: successfulCaseIds.length });
        }
      } catch (calendarError) {
        // Log but don't fail - the DB updates were successful
        log.error('Error scheduling bulk calendar operations', { error: calendarError instanceof Error ? calendarError.message : String(calendarError) });
      }
    }

    return {
      successCount,
      failedCount,
    };
  },
});

/**
 * Toggle favorite status for a case
 * Returns the new favorite state
 */
export const toggleFavorite = mutation({
  args: {
    id: v.id("cases"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const caseDoc = await ctx.db.get(args.id);

    // Verify ownership
    await verifyOwnership(ctx, caseDoc, "case");

    // Toggle favorite state
    const newFavoriteState = !caseDoc!.isFavorite;

    await ctx.db.patch(args.id, {
      isFavorite: newFavoriteState,
      updatedAt: Date.now(),
    });

    return newFavoriteState;
  },
});

/**
 * Toggle pinned status for a case
 * Returns the new pinned state
 */
export const togglePinned = mutation({
  args: {
    id: v.id("cases"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const caseDoc = await ctx.db.get(args.id);

    // Verify ownership
    await verifyOwnership(ctx, caseDoc, "case");

    // Toggle pinned state (handle undefined as false for existing documents)
    const newPinnedState = !(caseDoc!.isPinned ?? false);

    await ctx.db.patch(args.id, {
      isPinned: newPinnedState,
      updatedAt: Date.now(),
    });

    return newPinnedState;
  },
});

/**
 * Toggle calendar sync status for a case
 * Returns the new calendar sync enabled state
 *
 * When turning ON: schedules sync to create calendar events
 * When turning OFF: schedules deletion of existing calendar events
 */
export const toggleCalendarSync = mutation({
  args: {
    id: v.id("cases"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const caseDoc = await ctx.db.get(args.id);

    // Verify ownership
    await verifyOwnership(ctx, caseDoc, "case");

    // Check not deleted
    if (caseDoc!.deletedAt !== undefined) {
      throw new Error("Cannot update deleted case");
    }

    // Toggle calendar sync state
    const newCalendarSyncState = !caseDoc!.calendarSyncEnabled;

    await ctx.db.patch(args.id, {
      calendarSyncEnabled: newCalendarSyncState,
      updatedAt: Date.now(),
    });

    // Schedule calendar sync/unsync based on new state (best-effort, non-blocking)
    try {
      if (newCalendarSyncState) {
        // Turning ON - create calendar events
        const syncResult = await scheduleCalendarSync(ctx, caseDoc!.userId, args.id);
        if (syncResult.scheduled) {
          log.info('Scheduled sync after enabling', { resourceId: args.id });
        }
      } else {
        // Turning OFF - delete calendar events
        await ctx.scheduler.runAfter(
          0,
          internal.googleCalendarActions.deleteCaseCalendarEvents,
          { userId: caseDoc!.userId, caseId: args.id }
        );
        log.info('Scheduled event deletion after disabling', { resourceId: args.id });
      }
    } catch (calendarError) {
      // Log calendar failure but don't fail the operation - toggle was successful
      log.error('Failed to schedule calendar sync after toggle', { resourceId: args.id, error: calendarError instanceof Error ? calendarError.message : String(calendarError) });
    }

    return newCalendarSyncState;
  },
});

/**
 * Enable calendar sync for a case (explicit ON).
 * Idempotent - safe to call multiple times. Returns true.
 *
 * When enabling: schedules sync to create calendar events
 */
export const enableCalendarSync = mutation({
  args: {
    id: v.id("cases"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const caseDoc = await ctx.db.get(args.id);

    // Verify ownership
    await verifyOwnership(ctx, caseDoc, "case");

    // Check not deleted
    if (caseDoc!.deletedAt !== undefined) {
      throw new Error("Cannot update deleted case");
    }

    // Only proceed if not already enabled (idempotent)
    if (!caseDoc!.calendarSyncEnabled) {
      await ctx.db.patch(args.id, {
        calendarSyncEnabled: true,
        updatedAt: Date.now(),
      });

      // Schedule calendar sync (best-effort, non-blocking)
      try {
        const syncResult = await scheduleCalendarSync(ctx, caseDoc!.userId, args.id);
        if (syncResult.scheduled) {
          log.info('Scheduled sync after enabling', { resourceId: args.id });
        }
      } catch (calendarError) {
        log.error('Failed to schedule calendar sync after enable', {
          resourceId: args.id,
          error: calendarError instanceof Error ? calendarError.message : String(calendarError),
        });
      }
    }

    return true; // Always returns true (enabled)
  },
});

/**
 * Disable calendar sync for a case (explicit OFF).
 * Idempotent - safe to call multiple times. Returns false.
 *
 * When disabling: schedules deletion of existing calendar events
 */
export const disableCalendarSync = mutation({
  args: {
    id: v.id("cases"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const caseDoc = await ctx.db.get(args.id);

    // Verify ownership
    await verifyOwnership(ctx, caseDoc, "case");

    // Check not deleted
    if (caseDoc!.deletedAt !== undefined) {
      throw new Error("Cannot update deleted case");
    }

    // Only proceed if currently enabled (idempotent)
    if (caseDoc!.calendarSyncEnabled) {
      await ctx.db.patch(args.id, {
        calendarSyncEnabled: false,
        updatedAt: Date.now(),
      });

      // Schedule calendar event deletion (best-effort, non-blocking)
      try {
        await ctx.scheduler.runAfter(
          0,
          internal.googleCalendarActions.deleteCaseCalendarEvents,
          { userId: caseDoc!.userId, caseId: args.id }
        );
        log.info('Scheduled event deletion after disabling', { resourceId: args.id });
      } catch (calendarError) {
        log.error('Failed to schedule calendar unsync after disable', {
          resourceId: args.id,
          error: calendarError instanceof Error ? calendarError.message : String(calendarError),
        });
      }
    }

    return false; // Always returns false (disabled)
  },
});

/**
 * Clear job description from a case.
 * Removes the job description, position title, and template reference.
 */
export const clearJobDescription = mutation({
  args: { id: v.id("cases") },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db.get(args.id);
    if (!caseDoc) {
      throw new Error("Case not found");
    }
    await verifyOwnership(ctx, caseDoc, "case");

    if (caseDoc.deletedAt !== undefined) {
      throw new Error("Cannot update deleted case");
    }

    // Capture old state for audit logging
    const oldDoc = { ...caseDoc };

    // Clear all job description fields
    await ctx.db.patch(args.id, {
      jobDescription: undefined,
      jobDescriptionPositionTitle: undefined,
      jobDescriptionTemplateId: undefined,
      updatedAt: Date.now(),
    });

    // Audit log the change
    const newDoc = await ctx.db.get(args.id);
    if (newDoc) {
      await logUpdate(ctx, "cases", args.id, oldDoc, newDoc);
    }

    return { success: true };
  },
});

/**
 * Check for duplicates before importing or creating/editing a case.
 * Returns list of cases that would be duplicates.
 *
 * For edit mode: pass excludeCaseId to exclude the case being edited from duplicate check.
 * This prevents a case from being flagged as its own duplicate.
 */
export const checkDuplicates = query({
  args: {
    cases: v.array(
      v.object({
        employerName: v.string(),
        beneficiaryIdentifier: v.optional(v.string()),
      })
    ),
    // Optional: exclude this case ID from duplicate check (used when editing)
    excludeCaseId: v.optional(v.id("cases")),
  },
  handler: async (ctx, args): Promise<{
    duplicates: Array<{
      index: number;
      employerName: string;
      beneficiaryIdentifier: string;
      existingCaseId: string;
      existingPositionTitle?: string;
      existingCaseStatus?: string;
    }>;
  }> => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) {
      return { duplicates: [] };
    }

    // Fetch all existing cases for this user
    const existingCases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Create a Map of existing employer+beneficiary combinations
    // Exclude the case being edited (if provided)
    const existingKeyMap = new Map<string, { id: Id<"cases">; positionTitle: string; caseStatus: string }>();
    for (const c of existingCases) {
      // Skip the case being edited
      if (args.excludeCaseId && c._id === args.excludeCaseId) {
        continue;
      }
      const key = `${c.employerName.toLowerCase().trim()}|${(c.beneficiaryIdentifier ?? "").toLowerCase().trim()}`;
      existingKeyMap.set(key, {
        id: c._id,
        positionTitle: c.positionTitle,
        caseStatus: c.caseStatus,
      });
    }

    // Find duplicates
    const duplicates: Array<{
      index: number;
      employerName: string;
      beneficiaryIdentifier: string;
      existingCaseId: string;
      existingPositionTitle?: string;
      existingCaseStatus?: string;
    }> = [];

    for (let i = 0; i < args.cases.length; i++) {
      const caseData = args.cases[i]!;
      const beneficiaryId = caseData.beneficiaryIdentifier ?? "";
      const key = `${caseData.employerName.toLowerCase().trim()}|${beneficiaryId.toLowerCase().trim()}`;
      const existing = existingKeyMap.get(key);
      if (existing) {
        duplicates.push({
          index: i,
          employerName: caseData.employerName,
          beneficiaryIdentifier: beneficiaryId,
          existingCaseId: existing.id,
          existingPositionTitle: existing.positionTitle,
          existingCaseStatus: existing.caseStatus,
        });
      }
    }

    return { duplicates };
  },
});

/**
 * Import multiple cases at once
 * Accepts an array of partial case data (only required fields needed)
 * Now supports duplicate resolution with skip/replace options
 */
export const importCases = mutation({
  args: {
    cases: v.array(
      v.object({
        employerName: v.string(),
        beneficiaryIdentifier: v.string(),
        positionTitle: v.optional(v.string()),
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
        priorityLevel: v.optional(
          v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent"))
        ),
        isFavorite: v.optional(v.boolean()),
        isPinned: v.optional(v.boolean()),
        isProfessionalOccupation: v.optional(v.boolean()),
        calendarSyncEnabled: v.optional(v.boolean()),
        showOnTimeline: v.optional(v.boolean()),
        // Date fields
        pwdFilingDate: v.optional(v.string()),
        pwdDeterminationDate: v.optional(v.string()),
        pwdExpirationDate: v.optional(v.string()),
        pwdCaseNumber: v.optional(v.string()),
        pwdWageAmount: v.optional(v.number()),
        pwdWageLevel: v.optional(v.string()),
        jobOrderStartDate: v.optional(v.string()),
        jobOrderEndDate: v.optional(v.string()),
        sundayAdFirstDate: v.optional(v.string()),
        sundayAdSecondDate: v.optional(v.string()),
        sundayAdNewspaper: v.optional(v.string()),
        additionalRecruitmentStartDate: v.optional(v.string()),
        additionalRecruitmentEndDate: v.optional(v.string()),
        eta9089FilingDate: v.optional(v.string()),
        eta9089CertificationDate: v.optional(v.string()),
        eta9089ExpirationDate: v.optional(v.string()),
        eta9089CaseNumber: v.optional(v.string()),
        i140FilingDate: v.optional(v.string()),
        i140ReceiptDate: v.optional(v.string()),
        i140ReceiptNumber: v.optional(v.string()),
        i140ApprovalDate: v.optional(v.string()),
        i140DenialDate: v.optional(v.string()),
        // Text fields
        caseNumber: v.optional(v.string()),
        internalCaseNumber: v.optional(v.string()),
        employerFein: v.optional(v.string()),
        jobTitle: v.optional(v.string()),
        socCode: v.optional(v.string()),
        socTitle: v.optional(v.string()),
        jobOrderState: v.optional(v.string()),
        // Notice of Filing
        noticeOfFilingStartDate: v.optional(v.string()),
        noticeOfFilingEndDate: v.optional(v.string()),
        // Additional Recruitment Methods (array of objects)
        additionalRecruitmentMethods: v.optional(
          v.array(
            v.object({
              method: v.string(),
              date: v.optional(v.string()),
              description: v.optional(v.string()),
            })
          )
        ),
        recruitmentApplicantsCount: v.optional(v.number()),
        recruitmentSummaryCustom: v.optional(v.string()),
        // RFI/RFE arrays
        rfiEntries: v.optional(
          v.array(
            v.object({
              id: v.string(),
              title: v.optional(v.string()),
              description: v.optional(v.string()),
              notes: v.optional(v.string()),
              reason: v.optional(v.string()), // Alias for notes from v1 format
              receivedDate: v.string(),
              responseDueDate: v.string(),
              responseSubmittedDate: v.optional(v.string()),
              createdAt: v.optional(v.number()),
            })
          )
        ),
        rfeEntries: v.optional(
          v.array(
            v.object({
              id: v.string(),
              title: v.optional(v.string()),
              description: v.optional(v.string()),
              notes: v.optional(v.string()),
              reason: v.optional(v.string()), // Alias for notes from v1 format
              receivedDate: v.string(),
              responseDueDate: v.string(),
              responseSubmittedDate: v.optional(v.string()),
              createdAt: v.optional(v.number()),
            })
          )
        ),
        // Notes array
        notes: v.optional(
          v.array(
            v.object({
              id: v.string(),
              content: v.string(),
              createdAt: v.number(),
              status: v.optional(v.union(v.literal("pending"), v.literal("done"))),
            })
          )
        ),
      })
    ),
    // Resolution choices for duplicates: key is the case index, value is "skip" or "replace"
    resolutions: v.optional(v.record(v.string(), v.union(v.literal("skip"), v.literal("replace")))),
  },
  handler: async (ctx, args): Promise<{
    importedCount: number;
    skippedCount: number;
    replacedCount: number;
    validationWarnings: Array<{
      caseIndex: number;
      employerName: string;
      beneficiaryIdentifier: string;
      errors: Array<{ ruleId: string; message: string }>;
    }>;
  }> => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();

    // Fetch all existing cases for this user to check for duplicates
    const existingCases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Create a Map of existing employer+beneficiary combinations with their case IDs
    const existingKeyMap = new Map<string, Id<"cases">>();
    for (const c of existingCases) {
      const key = `${c.employerName.toLowerCase().trim()}|${(c.beneficiaryIdentifier ?? "").toLowerCase().trim()}`;
      existingKeyMap.set(key, c._id);
    }

    // Track which keys we've seen in this import batch
    const seenInBatch = new Set<string>();

    let importedCount = 0;
    let skippedCount = 0;
    let replacedCount = 0;
    const validationWarnings: Array<{
      caseIndex: number;
      employerName: string;
      beneficiaryIdentifier: string;
      errors: Array<{ ruleId: string; message: string }>;
    }> = [];

    for (let i = 0; i < args.cases.length; i++) {
      const caseData = args.cases[i]!;
      // Check for duplicate (same employer + beneficiary)
      const key = `${caseData.employerName.toLowerCase().trim()}|${caseData.beneficiaryIdentifier.toLowerCase().trim()}`;
      const existingCaseId = existingKeyMap.get(key);

      if (existingCaseId) {
        // This is a duplicate - check resolution
        const resolution = args.resolutions?.[String(i)] ?? "skip";

        if (resolution === "skip") {
          skippedCount++;
          continue;
        } else if (resolution === "replace") {
          // Get the case before deleting for audit log
          const existingCase = await ctx.db.get(existingCaseId);
          if (!existingCase) {
            // Case was already deleted, skip
            existingKeyMap.delete(key);
            continue;
          }

          // Log the deletion in audit log BEFORE deleting
          try {
            await logDelete(ctx, "cases", existingCaseId, existingCase as Record<string, unknown>);
          } catch (auditError) {
            log.error('Failed to log case deletion during import replace', { resourceId: existingCaseId, error: auditError instanceof Error ? auditError.message : String(auditError) });
          }

          // Cleanup notifications for this case
          try {
            let hasMore = true;
            while (hasMore) {
              const result = await ctx.runMutation(internal.notifications.cleanupCaseNotifications, {
                caseId: existingCaseId,
              });
              hasMore = result.hasMore;
            }
          } catch (cleanupError) {
            log.error('Failed to cleanup notifications during import replace', { resourceId: existingCaseId, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
          }

          // Schedule calendar event deletion
          try {
            await ctx.scheduler.runAfter(
              0,
              internal.googleCalendarActions.deleteCaseCalendarEvents,
              { userId: userId as Id<"users">, caseId: existingCaseId }
            );
          } catch (calendarError) {
            log.error('Failed to schedule event deletion during import replace', { resourceId: existingCaseId, error: calendarError instanceof Error ? calendarError.message : String(calendarError) });
          }

          // Clean up userCaseOrder
          try {
            const userCaseOrder = await ctx.db
              .query("userCaseOrder")
              .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
              .first();
            if (userCaseOrder && userCaseOrder.caseIds.includes(existingCaseId)) {
              await ctx.db.patch(userCaseOrder._id, {
                caseIds: userCaseOrder.caseIds.filter((id) => id !== existingCaseId),
                updatedAt: now,
              });
            }
          } catch (cleanupError) {
            log.error('Failed to cleanup userCaseOrder during import replace', { resourceId: existingCaseId, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
          }

          // Clean up timelinePreferences
          try {
            const timelinePrefs = await ctx.db
              .query("timelinePreferences")
              .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
              .first();
            if (timelinePrefs?.selectedCaseIds?.includes(existingCaseId)) {
              await ctx.db.patch(timelinePrefs._id, {
                selectedCaseIds: timelinePrefs.selectedCaseIds.filter((id) => id !== existingCaseId),
                updatedAt: now,
              });
            }
          } catch (cleanupError) {
            log.error('Failed to cleanup timelinePreferences during import replace', { resourceId: existingCaseId, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
          }

          // Clean up dismissedDeadlines
          try {
            const userProfile = await ctx.db
              .query("userProfiles")
              .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
              .first();
            if (userProfile?.dismissedDeadlines.some((d) => d.caseId === existingCaseId)) {
              await ctx.db.patch(userProfile._id, {
                dismissedDeadlines: userProfile.dismissedDeadlines.filter((d) => d.caseId !== existingCaseId),
                updatedAt: now,
              });
            }
          } catch (cleanupError) {
            log.error('Failed to cleanup dismissedDeadlines during import replace', { resourceId: existingCaseId, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
          }

          // Clean up conversation references
          try {
            const conversations = await ctx.db
              .query("conversations")
              .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
              .collect();
            for (const conv of conversations) {
              if (conv.metadata?.relatedCaseId === existingCaseId) {
                await ctx.db.patch(conv._id, {
                  metadata: { ...conv.metadata, relatedCaseId: undefined },
                  updatedAt: now,
                });
              }
            }
          } catch (cleanupError) {
            log.error('Failed to cleanup conversations during import replace', { resourceId: existingCaseId, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
          }

          // Hard delete the existing case
          await ctx.db.delete(existingCaseId);

          existingKeyMap.delete(key);
          replacedCount++;
          // Continue to insert the new case below
        }
      } else if (seenInBatch.has(key)) {
        // Duplicate within the import batch - skip
        skippedCount++;
        continue;
      }

      // Add to seen batch to prevent duplicates within the import
      seenInBatch.add(key);

      // Calculate derived dates for queryability
      const isProfessionalOccupation = caseData.isProfessionalOccupation ?? false;
      const derivedDates = calculateDerivedDates({
        sundayAdFirstDate: caseData.sundayAdFirstDate,
        sundayAdSecondDate: caseData.sundayAdSecondDate,
        jobOrderStartDate: caseData.jobOrderStartDate,
        jobOrderEndDate: caseData.jobOrderEndDate,
        noticeOfFilingStartDate: caseData.noticeOfFilingStartDate,
        noticeOfFilingEndDate: caseData.noticeOfFilingEndDate,
        additionalRecruitmentEndDate: caseData.additionalRecruitmentEndDate,
        additionalRecruitmentMethods: caseData.additionalRecruitmentMethods,
        pwdExpirationDate: caseData.pwdExpirationDate,
        isProfessionalOccupation,
      });

      // Validate imported case data (log warnings but don't reject)
      // Transform arrays to match validator expectations
      const transformedMethods = (caseData.additionalRecruitmentMethods ?? []).map((m) => ({
        method: m.method,
        date: m.date ?? "",
        description: m.description,
      }));
      const transformedRfiEntries = (caseData.rfiEntries ?? []).map((e) => ({
        ...e,
        createdAt: e.createdAt ?? now,
      }));
      const transformedRfeEntries = (caseData.rfeEntries ?? []).map((e) => ({
        ...e,
        createdAt: e.createdAt ?? now,
      }));
      const validationInput = mapToValidatorFormat({
        ...caseData,
        additionalRecruitmentMethods: transformedMethods,
        rfiEntries: transformedRfiEntries,
        rfeEntries: transformedRfeEntries,
        isProfessionalOccupation,
        recruitmentStartDate: derivedDates.recruitmentStartDate,
        recruitmentEndDate: derivedDates.recruitmentEndDate,
      });
      const validationResult = validateCase(validationInput);
      if (!validationResult.valid) {
        // Collect validation warnings to return to user
        validationWarnings.push({
          caseIndex: i,
          employerName: caseData.employerName,
          beneficiaryIdentifier: caseData.beneficiaryIdentifier,
          errors: validationResult.errors.map((e) => ({
            ruleId: e.ruleId,
            message: e.message,
          })),
        });
        // Also log for server-side debugging
        log.warn('Import case validation warnings', {
          caseIndex: i,
          employerName: caseData.employerName,
          beneficiaryIdentifier: caseData.beneficiaryIdentifier,
          warnings: validationResult.errors.map((e) => `[${e.ruleId}] ${e.message}`).join('; '),
        });
      }

      const caseId = await ctx.db.insert("cases", {
        userId: userId as Id<"users">,
        employerName: caseData.employerName,
        beneficiaryIdentifier: caseData.beneficiaryIdentifier,
        positionTitle: caseData.positionTitle ?? "",

        // Apply defaults
        caseStatus: caseData.caseStatus ?? "pwd",
        progressStatus: caseData.progressStatus ?? "working",
        priorityLevel: caseData.priorityLevel ?? "normal",
        isFavorite: caseData.isFavorite ?? false,
        isPinned: caseData.isPinned ?? false,
        isProfessionalOccupation,
        // Use imported values if provided, otherwise default to empty
        recruitmentApplicantsCount: Number(caseData.recruitmentApplicantsCount ?? 0),
        recruitmentSummaryCustom: caseData.recruitmentSummaryCustom,
        // Transform additionalRecruitmentMethods to ensure date is required
        additionalRecruitmentMethods: (caseData.additionalRecruitmentMethods ?? []).map((m) => ({
          method: m.method,
          date: m.date ?? "",
          description: m.description,
        })),
        tags: [],
        documents: [],
        // Transform notes to ensure status is required
        notes: (caseData.notes ?? []).map((n) => ({
          id: n.id,
          content: n.content,
          createdAt: n.createdAt,
          status: n.status ?? "pending" as const,
        })),
        // RFI/RFE arrays - transform to ensure createdAt is required
        // Map 'reason' to 'notes' for v1 compatibility
        rfiEntries: (caseData.rfiEntries ?? []).map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          notes: e.notes ?? e.reason, // Use reason as fallback for notes
          receivedDate: e.receivedDate,
          responseDueDate: e.responseDueDate,
          responseSubmittedDate: e.responseSubmittedDate,
          createdAt: e.createdAt ?? now,
        })),
        rfeEntries: (caseData.rfeEntries ?? []).map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          notes: e.notes ?? e.reason, // Use reason as fallback for notes
          receivedDate: e.receivedDate,
          responseDueDate: e.responseDueDate,
          responseSubmittedDate: e.responseSubmittedDate,
          createdAt: e.createdAt ?? now,
        })),
        calendarSyncEnabled: caseData.calendarSyncEnabled ?? true,
        showOnTimeline: caseData.showOnTimeline ?? true,

        // Optional dates
        pwdFilingDate: caseData.pwdFilingDate,
        pwdDeterminationDate: caseData.pwdDeterminationDate,
        pwdExpirationDate: caseData.pwdExpirationDate,
        pwdCaseNumber: caseData.pwdCaseNumber,
        pwdWageAmount: caseData.pwdWageAmount,
        pwdWageLevel: caseData.pwdWageLevel,
        jobOrderStartDate: caseData.jobOrderStartDate,
        jobOrderEndDate: caseData.jobOrderEndDate,
        sundayAdFirstDate: caseData.sundayAdFirstDate,
        sundayAdSecondDate: caseData.sundayAdSecondDate,
        sundayAdNewspaper: caseData.sundayAdNewspaper,
        noticeOfFilingStartDate: caseData.noticeOfFilingStartDate,
        noticeOfFilingEndDate: caseData.noticeOfFilingEndDate,
        additionalRecruitmentStartDate: caseData.additionalRecruitmentStartDate,
        additionalRecruitmentEndDate: caseData.additionalRecruitmentEndDate,
        // Derived dates (auto-calculated for queryability)
        recruitmentStartDate: derivedDates.recruitmentStartDate ?? undefined,
        recruitmentEndDate: derivedDates.recruitmentEndDate ?? undefined,
        filingWindowOpens: derivedDates.filingWindowOpens ?? undefined,
        filingWindowCloses: derivedDates.filingWindowCloses ?? undefined,
        recruitmentWindowCloses: derivedDates.recruitmentWindowCloses ?? undefined,
        eta9089FilingDate: caseData.eta9089FilingDate,
        eta9089CertificationDate: caseData.eta9089CertificationDate,
        eta9089ExpirationDate: caseData.eta9089ExpirationDate,
        eta9089CaseNumber: caseData.eta9089CaseNumber,
        i140FilingDate: caseData.i140FilingDate,
        i140ReceiptDate: caseData.i140ReceiptDate,
        i140ReceiptNumber: caseData.i140ReceiptNumber,
        i140ApprovalDate: caseData.i140ApprovalDate,
        i140DenialDate: caseData.i140DenialDate,

        // Optional text fields
        caseNumber: caseData.caseNumber,
        internalCaseNumber: caseData.internalCaseNumber,
        employerFein: caseData.employerFein,
        jobTitle: caseData.jobTitle,
        socCode: caseData.socCode,
        socTitle: caseData.socTitle,
        jobOrderState: caseData.jobOrderState,

        // Timestamps
        createdAt: now,
        updatedAt: now,
      });

      // Audit log: record the imported case creation
      try {
        const newCase = await ctx.db.get(caseId);
        await logCreate(ctx, "cases", caseId, newCase as Record<string, unknown>);
      } catch (auditError) {
        // Log audit failure but don't fail the operation - case was imported successfully
        log.error('Failed to log case import', { resourceId: caseId, error: auditError instanceof Error ? auditError.message : String(auditError) });
      }

      importedCount++;
    }

    return { importedCount, skippedCount, replacedCount, validationWarnings };
  },
});

/**
 * List cases with filtering, sorting, and pagination
 * Returns paginated case card data with metadata
 * Gracefully handles unauthenticated state by returning empty results
 *
 * NOTE: This query loads cases then applies client-side pagination.
 * For users with very large case counts (1000+), consider implementing
 * cursor-based pagination with indexed deadline fields.
 */
export const listFiltered = query({
  args: {
    status: v.optional(v.string()),
    progressStatus: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
    favoritesOnly: v.optional(v.boolean()),
    duplicatesOnly: v.optional(v.boolean()),
    activeOnly: v.optional(v.boolean()),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<CaseListResponse> => {
    // 1. Get authenticated user (null-safe for sign-out transitions)
    const userId = await getCurrentUserIdOrNull(ctx);

    // Return empty result if not authenticated (handles sign-out transitions gracefully)
    if (userId === null) {
      return {
        cases: [],
        pagination: createCaseListPagination({
          page: 1,
          pageSize: args.pageSize ?? 12,
          totalCount: 0,
        }),
      };
    }

    // 2. Query cases with ownership filter and reasonable limit
    const allCases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .take(1000);

    // 3. Filter out soft-deleted cases
    let filteredCases = allCases.filter((c) => c.deletedAt === undefined);

    // 4. Apply status filter
    if (args.status !== undefined) {
      filteredCases = filteredCases.filter((c) => c.caseStatus === args.status);
    }

    // 5. Apply progress status filter
    if (args.progressStatus !== undefined) {
      filteredCases = filteredCases.filter((c) => c.progressStatus === args.progressStatus);
    }

    // 6. Apply favorites filter
    if (args.favoritesOnly === true) {
      filteredCases = filteredCases.filter((c) => c.isFavorite === true);
    }

    // 6.5 Apply duplicates filter (show only cases marked as duplicates)
    if (args.duplicatesOnly === true) {
      filteredCases = filteredCases.filter((c) => c.duplicateOf !== undefined);
    }

    // 6.6 Apply activeOnly filter (exclude closed AND completed cases)
    // Completed = i140 status + approved progress status
    if (args.activeOnly === true) {
      filteredCases = filteredCases.filter((c) => {
        // Exclude closed cases
        if (c.caseStatus === "closed") return false;
        // Exclude completed cases (i140 + approved)
        if (c.caseStatus === "i140" && c.progressStatus === "approved") return false;
        return true;
      });
    }

    // 7. Project each case to CaseCardData using helper function
    const todayISO = new Date().toISOString().split("T")[0] as string;
    const caseCardDataList = filteredCases.map((caseDoc) =>
      projectCaseForCard(caseDoc, todayISO)
    );

    // 8. Apply fuzzy search filter (on CaseCardData for relevance ranking)
    const searchFilteredCases =
      args.searchQuery !== undefined && args.searchQuery.length > 0
        ? filterBySearch(caseCardDataList, args.searchQuery)
        : caseCardDataList;

    // 9. Sort results using helper function
    const sortByField = isCaseListSortField(args.sortBy) ? args.sortBy : "deadline";
    const sortOrderDir = isSortOrder(args.sortOrder) ? args.sortOrder : "asc";
    const sortedCases = sortCases(searchFilteredCases, sortByField, sortOrderDir);

    // 10. Apply pagination (pageSize: 0 means no limit)
    const page = args.page ?? 1;
    const pageSize = args.pageSize ?? 12;
    const totalCount = sortedCases.length;

    // If pageSize is 0, return all cases (no pagination)
    const paginatedCases = pageSize === 0
      ? sortedCases
      : sortedCases.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

    // 11. Return CaseListResponse with cases + pagination
    return {
      cases: paginatedCases,
      pagination: createCaseListPagination({
        page,
        pageSize,
        totalCount,
      }),
    };
  },
});

/**
 * Get all case IDs matching the current filters (for "Select All" functionality)
 * Returns just IDs to minimize data transfer - does not return full case data
 */
export const listFilteredIds = query({
  args: {
    status: v.optional(v.string()),
    progressStatus: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
    favoritesOnly: v.optional(v.boolean()),
    duplicatesOnly: v.optional(v.boolean()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"cases">[]> => {
    // 1. Get authenticated user (null-safe for sign-out transitions)
    const userId = await getCurrentUserIdOrNull(ctx);

    // Return empty result if not authenticated
    if (userId === null) {
      return [];
    }

    // 2. Query cases with ownership filter
    const allCases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .take(1000);

    // 3. Filter out soft-deleted cases
    let filteredCases = allCases.filter((c) => c.deletedAt === undefined);

    // 4. Apply status filter
    if (args.status !== undefined) {
      filteredCases = filteredCases.filter((c) => c.caseStatus === args.status);
    }

    // 5. Apply progress status filter
    if (args.progressStatus !== undefined) {
      filteredCases = filteredCases.filter((c) => c.progressStatus === args.progressStatus);
    }

    // 6. Apply favorites filter
    if (args.favoritesOnly === true) {
      filteredCases = filteredCases.filter((c) => c.isFavorite === true);
    }

    // 7. Apply duplicates filter
    if (args.duplicatesOnly === true) {
      filteredCases = filteredCases.filter((c) => c.duplicateOf !== undefined);
    }

    // 7.5 Apply activeOnly filter (exclude closed AND completed cases)
    if (args.activeOnly === true) {
      filteredCases = filteredCases.filter((c) => {
        if (c.caseStatus === "closed") return false;
        if (c.caseStatus === "i140" && c.progressStatus === "approved") return false;
        return true;
      });
    }

    // 8. Apply search filter if provided (simple substring match for IDs query)
    if (args.searchQuery !== undefined && args.searchQuery.length > 0) {
      const searchLower = args.searchQuery.toLowerCase();
      filteredCases = filteredCases.filter((c) => {
        const beneficiaryIdentifier = (c.beneficiaryIdentifier ?? "").toLowerCase();
        const employerName = c.employerName.toLowerCase();
        const jobTitle = c.jobTitle?.toLowerCase() ?? "";
        return (
          beneficiaryIdentifier.includes(searchLower) ||
          employerName.includes(searchLower) ||
          jobTitle.includes(searchLower)
        );
      });
    }

    // 9. Return just the IDs
    return filteredCases.map((c) => c._id);
  },
});

/**
 * Reopen a closed case
 * Recalculates appropriate caseStatus and progressStatus based on form data
 * Uses the PERM workflow to determine the correct stage
 */
export const reopenCase = mutation({
  args: {
    id: v.id("cases"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    newCaseStatus: string;
    newProgressStatus: string;
  }> => {
    const caseDoc = await ctx.db.get(args.id);

    // Verify ownership (throws if not found or not owned by user)
    await verifyOwnership(ctx, caseDoc, "case");

    // Only allow reopening closed cases
    if (caseDoc!.caseStatus !== "closed") {
      throw new Error("Case is not closed");
    }

    // Check not deleted
    if (caseDoc!.deletedAt !== undefined) {
      throw new Error("Cannot reopen deleted case");
    }

    // Capture old state for audit logging
    const oldDoc = caseDoc;

    // Determine appropriate status based on case data using helper function
    const { caseStatus: newCaseStatus, progressStatus: newProgressStatus } =
      determineReopenStatus(caseDoc!);

    await ctx.db.patch(args.id, {
      caseStatus: newCaseStatus,
      progressStatus: newProgressStatus,
      updatedAt: Date.now(),
    });

    // Audit log: record the case reopen as an update
    try {
      const newCase = await ctx.db.get(args.id);
      await logUpdate(
        ctx,
        "cases",
        args.id,
        oldDoc as Record<string, unknown>,
        newCase as Record<string, unknown>
      );
    } catch (auditError) {
      // Log audit failure but don't fail the operation - case was reopened successfully
      log.error('Failed to log case reopen', { resourceId: args.id, error: auditError instanceof Error ? auditError.message : String(auditError) });
    }

    return {
      success: true,
      newCaseStatus,
      newProgressStatus,
    };
  },
});

// ============================================================================
// EXPORT QUERIES
// ============================================================================

/**
 * List full case data by IDs for export
 *
 * Returns complete case documents (not CaseCardData projections) for the
 * specified case IDs. Verifies ownership for each case.
 *
 * Used by the export feature to get all case fields for JSON/CSV export.
 *
 * @param ids - Array of case IDs to fetch
 * @returns Array of full case documents (minus userId and internal fields)
 */
export const listByIds = query({
  args: {
    ids: v.array(v.id("cases")),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);

    // Return empty if not authenticated
    if (userId === null) {
      return [];
    }

    const cases = [];

    for (const id of args.ids) {
      const caseDoc = await ctx.db.get(id);

      // Skip if not found, deleted, or not owned by user
      if (!caseDoc) continue;
      if (caseDoc.deletedAt !== undefined) continue;
      if (caseDoc.userId !== userId) continue;

      // Return full case data (excluding userId for privacy)
      const { userId: _userId, ...caseData } = caseDoc;
      cases.push(caseData);
    }

    return cases;
  },
});

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

/**
 * List cases for calendar sync (internal query)
 *
 * Returns all non-deleted cases for a user with minimal fields needed for sync.
 * Used by syncAllCases action to batch sync all user cases.
 *
 * @param userId - The user ID to list cases for
 * @returns Array of cases with minimal sync-relevant fields
 */
export const listForSync = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Query all cases for this user
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .take(1000);

    // Filter out deleted cases and return minimal fields
    return cases
      .filter((c) => c.deletedAt === undefined)
      .map((c) => ({
        _id: c._id,
        employerName: c.employerName,
        calendarSyncEnabled: c.calendarSyncEnabled,
      }));
  },
});

/**
 * Get count of sync-eligible cases for progress UX
 *
 * Public query for the CalendarSyncSection to show "Syncing N cases..."
 * during the sync operation. Returns count of non-deleted cases where
 * calendarSyncEnabled is not explicitly false.
 */
export const getSyncEligibleCaseCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return 0;
    }

    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .take(1000);

    // Count non-deleted cases with sync enabled (not explicitly false)
    return cases.filter(
      (c) => c.deletedAt === undefined && c.calendarSyncEnabled !== false
    ).length;
  },
});

/**
 * Get count of cases with calendar events (for "Clear All" button UX)
 *
 * Returns the count of cases that have at least one calendar event synced.
 * Used by CalendarSyncSection to show "Clearing X cases..." during clear operation.
 */
export const getCasesWithEventsCount = query({
  args: {},
  handler: async (ctx): Promise<{ caseCount: number; estimatedEventCount: number }> => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return { caseCount: 0, estimatedEventCount: 0 };
    }

    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .take(1000);

    // Count non-deleted cases with calendar events
    let caseCount = 0;
    let estimatedEventCount = 0;

    for (const c of cases) {
      if (c.deletedAt === undefined && c.calendarEventIds) {
        const eventIds = c.calendarEventIds;
        const eventCount = Object.values(eventIds).filter(Boolean).length;
        if (eventCount > 0) {
          caseCount++;
          estimatedEventCount += eventCount;
        }
      }
    }

    return { caseCount, estimatedEventCount };
  },
});
