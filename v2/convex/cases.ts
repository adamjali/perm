import { query, mutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v, ConvexError, type ObjectType } from "convex/values";
import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import schema from "./schema";
import { getCurrentUserId, getCurrentUserIdOrNull, verifyOwnership } from "./lib/auth";
import { rateLimiter } from "./rateLimitConfig";
import { logCreate, logUpdate, logDelete } from "./lib/audit";
import { validateInputLengths, INPUT_LIMITS } from "./lib/validation";
import { readUserCases, USER_CASES_MAX } from "./lib/userCases";
import { encryptToken, decryptToken, isEncryptedToken } from "./lib/crypto";
import {
  createCaseListPagination,
  type CaseListResponse,
  isCaseListSortField,
  isSortOrder,
} from "./lib/caseListTypes";
import { filterBySearch, projectCaseForCard, sortCases, determineReopenStatus } from "./lib/caseListHelpers";
import { calculateDerivedDates, resolveEta9089ExpirationDate } from "./lib/derivedCalculations";
import { validateCase, mapToValidatorFormat, calculateAutoStatus } from "./lib/perm";
import { shouldSendEmail, formatCaseStatus, buildUserNotificationPrefs } from "./lib/notificationHelpers";
import { scheduleCalendarSync, scheduleCalendarSyncBulk } from "./lib/calendarSyncHelpers";
import { loggers } from "./lib/logging";
import { recordError } from "./lib/errorRecording";

const log = loggers.cases;

/**
 * Clear the auto-closure trail for a case that is leaving "closed": dismiss the
 * unread `auto_closure` alert notification(s) that drive the dashboard banner.
 * Without this, a case whose dates were corrected (so its status recomputes out
 * of closed) still shows the "auto-closed" alert. The case row's closureReason/
 * closedAt are cleared by the caller's own patch.
 */
async function dismissAutoClosureAlerts(
  ctx: MutationCtx,
  caseId: Id<"cases">
): Promise<void> {
  const notifs = await ctx.db
    .query("notifications")
    .withIndex("by_case_id", (q) => q.eq("caseId", caseId))
    .collect();
  const now = Date.now();
  for (const n of notifs) {
    if (n.type === "auto_closure" && !n.isRead) {
      await ctx.db.patch(n._id, { isRead: true, updatedAt: now });
    }
  }
}

/**
 * Encrypt FEIN for storage (returns undefined if input is undefined/null)
 */
async function encryptFein(fein: string | undefined | null): Promise<string | undefined> {
  if (!fein) return undefined;
  // Let encryptToken throw if OAUTH_ENCRYPTION_KEY is missing — never store plaintext. Key shared for OAuth tokens and FEIN encryption.
  return await encryptToken(fein);
}

/**
 * Decrypt FEIN for display (handles legacy plaintext gracefully)
 */
async function decryptFein(fein: string | undefined): Promise<string | undefined> {
  if (!fein) return undefined;
  if (!isEncryptedToken(fein)) return fein; // Legacy plaintext
  try {
    return await decryptToken(fein);
  } catch {
    // Corrupted or key mismatch — log and return undefined so UI shows empty field
    console.error("[decryptFein] Failed to decrypt FEIN — key mismatch or data corruption");
    return undefined;
  }
}

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

    // Security: Verify userId exists in users table (protects against invalid/foreign auth tokens)
    const userExists = await ctx.db.get(userId);
    if (!userExists) {
      console.warn("[list] Invalid userId from auth token:", userId);
      return [];
    }

    // Live cases, newest first (convex/lib/userCases.ts)
    let filteredCases = (await readUserCases(ctx, userId)).cases;

    // Apply status filter if provided
    if (args.status !== undefined) {
      filteredCases = filteredCases.filter((c) => c.caseStatus === args.status);
    }

    // Apply favorites filter if provided
    if (args.favoritesOnly === true) {
      filteredCases = filteredCases.filter((c) => c.isFavorite === true);
    }

    // Decrypt FEIN for display
    return Promise.all(
      filteredCases.map(async (c) => ({
        ...c,
        employerFein: await decryptFein(c.employerFein),
      }))
    );
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

    // Decrypt FEIN for display
    return { ...caseDoc, employerFein: await decryptFein(caseDoc.employerFein) };
  },
});

/**
 * The fields callers may send to `create` and `update`, taken from the `cases`
 * table so the arguments can't drift from it. The server sets the owner, the
 * derived recruitment dates, the closure fields and the timestamps.
 */
const caseTable = schema.tables.cases.validator;
const caseInput = caseTable.omit(
  "userId",
  "recruitmentStartDate",
  "recruitmentEndDate",
  "filingWindowOpens",
  "filingWindowCloses",
  "recruitmentWindowCloses",
  "closureReason",
  "closedAt",
  "createdAt",
  "updatedAt",
  "deletedAt",
);

/** The calendar event slots callers may set; calendar sync writes every slot. */
const callerCalendarEventIds = caseTable.fields.calendarEventIds.pick(
  "pwd_expiration",
  "eta9089_filing_window",
  "eta9089_expiration",
  "i140_filing_deadline",
  "rfi_due",
  "rfe_due",
  "recruitment_end",
);

/**
 * `create` takes every field as optional except the employer and the position.
 * The server stamps `markedAsDuplicateAt` from `duplicateOf`.
 */
const caseCreateArgs = {
  ...caseInput.omit("markedAsDuplicateAt").partial().fields,
  employerName: caseTable.fields.employerName,
  positionTitle: caseTable.fields.positionTitle,
  calendarEventIds: callerCalendarEventIds,
};

/** A text field `update` can clear: `null` removes the stored value. */
const clearableText = v.optional(v.union(v.string(), v.null()));

/**
 * `update` takes every field as optional, and an absent field keeps its stored
 * value. The fields listed here also take `null`, which clears them. Whether a
 * case is a sample is fixed when it's created.
 */
const caseUpdateArgs = {
  id: v.id("cases"),
  ...caseInput.omit("isSample").partial().fields,
  calendarEventIds: callerCalendarEventIds,
  caseNumber: clearableText,
  internalCaseNumber: clearableText,
  employerFein: clearableText,
  jobTitle: clearableText,
  socCode: clearableText,
  socTitle: clearableText,
  jobOrderState: clearableText,
  pwdFilingDate: clearableText,
  pwdDeterminationDate: clearableText,
  pwdExpirationDate: clearableText,
  pwdCaseNumber: clearableText,
  pwdWageLevel: clearableText,
  jobOrderStartDate: clearableText,
  jobOrderEndDate: clearableText,
  sundayAdFirstDate: clearableText,
  sundayAdSecondDate: clearableText,
  sundayAdNewspaper: clearableText,
  additionalRecruitmentStartDate: clearableText,
  additionalRecruitmentEndDate: clearableText,
  recruitmentNotes: clearableText,
  recruitmentSummaryCustom: clearableText,
  noticeOfFilingStartDate: clearableText,
  noticeOfFilingEndDate: clearableText,
  eta9089FilingDate: clearableText,
  eta9089AuditDate: clearableText,
  eta9089CertificationDate: clearableText,
  eta9089ExpirationDate: clearableText,
  eta9089CaseNumber: clearableText,
  i140FilingDate: clearableText,
  i140ReceiptDate: clearableText,
  i140ReceiptNumber: clearableText,
  i140ApprovalDate: clearableText,
  i140DenialDate: clearableText,
  i140ServiceCenter: clearableText,
  i140Category: v.optional(v.union(...caseTable.fields.i140Category.members, v.null())),
  jobDescription: clearableText,
  jobDescriptionPositionTitle: clearableText,
};

/**
 * Compile-time proof that every argument `create` and `update` take is a
 * stored case field of the stored type (`null` on update means "clear").
 * The derived fields hold by construction. A field written out above could
 * name one the table doesn't have, and that would typecheck in the handler and
 * fail at runtime in `ctx.db.patch`.
 */
type StoredCase = WithoutSystemFields<Doc<"cases">>;
type FieldsFitTable<Args> = {
  [K in keyof Args]-?: K extends keyof StoredCase
    ? Exclude<Args[K], null | undefined> extends Exclude<StoredCase[K], undefined>
      ? true
      : false
    : false;
}[keyof Args];
type CaseArgsFitTable = false extends
  | FieldsFitTable<ObjectType<typeof caseCreateArgs>>
  | FieldsFitTable<Omit<ObjectType<typeof caseUpdateArgs>, "id">>
  ? never
  : true;
const _caseArgsFitTable: CaseArgsFitTable = true;
void _caseArgsFitTable;

/**
 * Create a new case
 * Sets defaults for all optional fields
 */
export const create = mutation({
  args: caseCreateArgs,
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    // Per-user rate limit (caps compromised-JWT abuse)
    await rateLimiter.limit(ctx, "caseCreate", { key: userId, throws: true });

    // Input length validation (PI1 — Processing Integrity)
    validateInputLengths([
      { value: args.employerName, name: "Employer Name", limit: INPUT_LIMITS.SHORT },
      { value: args.positionTitle, name: "Position Title", limit: INPUT_LIMITS.SHORT },
      { value: args.beneficiaryIdentifier, name: "Beneficiary Identifier", limit: INPUT_LIMITS.SHORT },
      { value: args.jobDescription, name: "Job Description", limit: INPUT_LIMITS.LONG },
      { value: args.recruitmentNotes, name: "Recruitment Notes", limit: INPUT_LIMITS.MEDIUM },
      { value: args.recruitmentSummaryCustom, name: "Recruitment Summary", limit: INPUT_LIMITS.MEDIUM },
    ]);

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
    // A certified case always carries its expiration (see the helper).
    const eta9089ExpirationDate = resolveEta9089ExpirationDate(
      args.eta9089CertificationDate,
      args.eta9089ExpirationDate
    );
    const validationInput = mapToValidatorFormat({
      ...args,
      eta9089ExpirationDate,
      recruitmentStartDate: derivedDates.recruitmentStartDate,
      recruitmentEndDate: derivedDates.recruitmentEndDate,
    });
    const validationResult = validateCase(validationInput);
    if (!validationResult.valid) {
      const errorMessages = validationResult.errors
        .map((e) => `[${e.ruleId}] ${e.field}: ${e.message}`)
        .join('; ');
      throw new ConvexError(`Validation failed: ${errorMessages}`);
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
      userId: userId,
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
      eta9089ExpirationDate,
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
      employerFein: await encryptFein(args.employerFein),
      jobTitle: args.jobTitle,
      socCode: args.socCode,
      socTitle: args.socTitle,
      jobOrderState: args.jobOrderState,
      jobDescriptionPositionTitle: args.jobDescriptionPositionTitle,
      jobDescription: args.jobDescription,
      jobDescriptionTemplateId: args.jobDescriptionTemplateId,
      progressStatusOverride: args.progressStatusOverride,
      notes: args.notes,
      calendarEventIds: args.calendarEventIds,

      // Duplicate tracking
      duplicateOf: args.duplicateOf,
      markedAsDuplicateAt: args.duplicateOf ? now : undefined,

      // Sample case flag
      isSample: args.isSample,

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
      await recordError(ctx, "mutation", "cases.createCase.audit", auditError, { userId, resourceId: caseId.toString() });
    }

    // Create notification for case creation (v1 parity)
    // Check if user has emailStatusUpdates enabled before creating notification
    try {
      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .first();

      const userPrefs = buildUserNotificationPrefs(userProfile);
      if (userPrefs.emailStatusUpdates) {
        const notificationId = await ctx.runMutation(internal.notifications.createNotification, {
          userId: userId,
          caseId: caseId,
          type: "status_change",
          title: "New case created",
          message: `Case for ${args.beneficiaryIdentifier || "beneficiary"} at ${args.employerName} has been created.`,
          priority: "normal",
        });

        // Schedule email if preferences allow
        if (shouldSendEmail("status_change", "normal", userPrefs)) {
          // Get user email from users table
          const user = await ctx.db.get(userId);
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
      await recordError(ctx, "mutation", "cases.createCase.notification", notificationError, { userId, resourceId: caseId.toString() });
    }

    // Schedule Google Calendar sync for the new case (best-effort, non-blocking)
    // Only sync if case-level calendarSyncEnabled is not explicitly false
    if (args.calendarSyncEnabled !== false) {
      try {
        const syncResult = await scheduleCalendarSync(ctx, userId, caseId);
        if (syncResult.scheduled) {
          log.info('Scheduled sync for new case', { resourceId: caseId });
        }
      } catch (calendarError) {
        // Log calendar sync failure but don't fail the operation - case was created successfully
        log.error('Failed to schedule sync for new case', { resourceId: caseId, error: calendarError instanceof Error ? calendarError.message : String(calendarError) });
        await recordError(ctx, "mutation", "cases.createCase.calendar", calendarError, { userId, resourceId: caseId.toString() });
      }
    }

    return caseId;
  },
});

/** Fields that represent status-only changes (skip full validation). */
const STATUS_ONLY_FIELDS = new Set([
  "caseStatus",
  "progressStatus",
  "progressStatusOverride",
]);

/** Metadata fields that don't affect PERM date/deadline validation. */
const METADATA_FIELDS = new Set([
  "notes",
  "documents",
  "isFavorite",
  "isPinned",
  "tags",
  "calendarSyncEnabled",
  "showOnTimeline",
]);

/**
 * Update an existing case
 * Verifies ownership before allowing updates
 */
export const update = mutation({
  args: caseUpdateArgs,
  handler: async (ctx, args) => {
    // Input length validation (PI1 — Processing Integrity)
    validateInputLengths([
      { value: args.employerName, name: "Employer Name", limit: INPUT_LIMITS.SHORT },
      { value: args.positionTitle, name: "Position Title", limit: INPUT_LIMITS.SHORT },
      { value: args.beneficiaryIdentifier, name: "Beneficiary Identifier", limit: INPUT_LIMITS.SHORT },
      { value: typeof args.jobDescription === "string" ? args.jobDescription : undefined, name: "Job Description", limit: INPUT_LIMITS.LONG },
      { value: args.recruitmentNotes, name: "Recruitment Notes", limit: INPUT_LIMITS.MEDIUM },
      { value: args.recruitmentSummaryCustom, name: "Recruitment Summary", limit: INPUT_LIMITS.MEDIUM },
    ]);

    const caseDoc = await ctx.db.get(args.id);

    // Verify ownership (throws if not found or not owned by user)
    await verifyOwnership(ctx, caseDoc, "case");

    // Per-user rate limit (caps compromised-JWT abuse)
    await rateLimiter.limit(ctx, "caseUpdate", { key: caseDoc!.userId, throws: true });

    // Check not deleted
    if (caseDoc!.deletedAt !== undefined) {
      throw new ConvexError("Cannot update deleted case");
    }

    // Capture old state for audit logging
    const oldDoc = caseDoc;

    // Extract ID field, then build the updates object
    const { id: _id, ...rawUpdates } = args;

    // Clean null values to undefined for db.patch (null = "clear this field")
    const updates: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(rawUpdates)) {
      updates[key] = val === null ? undefined : val;
    }

    // Encrypt FEIN if being updated
    if (updates.employerFein !== undefined) {
      updates.employerFein = await encryptFein(updates.employerFein as string);
    }

    // Resolve a field value for update merge:
    // - string value → use the new value
    // - null → clear the field (returns undefined)
    // - undefined (absent from args) → keep existing DB value
    const resolve = (
      argVal: string | null | undefined,
      dbVal: string | undefined,
    ): string | undefined => {
      if (argVal !== undefined) return argVal === null ? undefined : argVal;
      return dbVal;
    };

    // Merge existing case data with updates to calculate derived dates
    // Uses resolve() so null signals "clear this field" instead of falling back to old value
    const mergedData = {
      sundayAdFirstDate: resolve(args.sundayAdFirstDate, caseDoc!.sundayAdFirstDate),
      sundayAdSecondDate: resolve(args.sundayAdSecondDate, caseDoc!.sundayAdSecondDate),
      jobOrderStartDate: resolve(args.jobOrderStartDate, caseDoc!.jobOrderStartDate),
      jobOrderEndDate: resolve(args.jobOrderEndDate, caseDoc!.jobOrderEndDate),
      noticeOfFilingStartDate: resolve(args.noticeOfFilingStartDate, caseDoc!.noticeOfFilingStartDate),
      noticeOfFilingEndDate: resolve(args.noticeOfFilingEndDate, caseDoc!.noticeOfFilingEndDate),
      additionalRecruitmentEndDate: resolve(args.additionalRecruitmentEndDate, caseDoc!.additionalRecruitmentEndDate),
      additionalRecruitmentMethods: args.additionalRecruitmentMethods ?? caseDoc!.additionalRecruitmentMethods,
      pwdExpirationDate: resolve(args.pwdExpirationDate, caseDoc!.pwdExpirationDate),
      isProfessionalOccupation: args.isProfessionalOccupation ?? caseDoc!.isProfessionalOccupation,
    };

    // Recalculate derived dates based on merged data
    const derivedDates = calculateDerivedDates(mergedData);

    // Skip full validation for status-only updates (archive/close/reopen).
    // Every other status-change path (bulkUpdateStatus, reopenCase, deadlineEnforcement)
    // already skips validation — this brings cases:update in line.
    const updateKeys = Object.keys(rawUpdates);
    const isMetadataOnlyUpdate = updateKeys.length > 0 &&
      updateKeys.every((k) => STATUS_ONLY_FIELDS.has(k) || METADATA_FIELDS.has(k));

    // Merge case data (always needed for auto-status calculation)
    const fullCaseData = {
      // PWD dates
      pwdFilingDate: resolve(args.pwdFilingDate, caseDoc!.pwdFilingDate),
      pwdDeterminationDate: resolve(args.pwdDeterminationDate, caseDoc!.pwdDeterminationDate),
      pwdExpirationDate: resolve(args.pwdExpirationDate, caseDoc!.pwdExpirationDate),
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
      eta9089FilingDate: resolve(args.eta9089FilingDate, caseDoc!.eta9089FilingDate),
      eta9089CertificationDate: resolve(args.eta9089CertificationDate, caseDoc!.eta9089CertificationDate),
      eta9089ExpirationDate: resolveEta9089ExpirationDate(
        resolve(args.eta9089CertificationDate, caseDoc!.eta9089CertificationDate),
        resolve(args.eta9089ExpirationDate, caseDoc!.eta9089ExpirationDate)
      ),
      // I-140 dates
      i140FilingDate: resolve(args.i140FilingDate, caseDoc!.i140FilingDate),
      i140ApprovalDate: resolve(args.i140ApprovalDate, caseDoc!.i140ApprovalDate),
      // RFI/RFE entries
      rfiEntries: args.rfiEntries ?? caseDoc!.rfiEntries,
      rfeEntries: args.rfeEntries ?? caseDoc!.rfeEntries,
      // Status
      caseStatus: args.caseStatus ?? caseDoc!.caseStatus,
      progressStatus: args.progressStatus ?? caseDoc!.progressStatus,
    };
    if (!isMetadataOnlyUpdate) {
      const validationInput = mapToValidatorFormat(fullCaseData);
      const validationResult = validateCase(validationInput);
      if (!validationResult.valid) {
        const errorMessages = validationResult.errors
          .map((e) => `[${e.ruleId}] ${e.field}: ${e.message}`)
          .join('; ');
        throw new ConvexError(`Validation failed: ${errorMessages}`);
      }
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
      i140DenialDate: resolve(args.i140DenialDate, caseDoc!.i140DenialDate),
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

    // If correcting dates takes the case out of "closed", clear the auto-closure
    // trail (reason/date + the dashboard alert) so it doesn't look still-closed.
    const resolvedCaseStatus = isOverridden
      ? (args.caseStatus ?? caseDoc!.caseStatus)
      : autoStatus.caseStatus;
    const leavingClosed =
      caseDoc!.caseStatus === "closed" && resolvedCaseStatus !== "closed";

    await ctx.db.patch(args.id, {
      ...updates,
      ...statusUpdates,
      ...(leavingClosed ? { closureReason: undefined, closedAt: undefined } : {}),
      // A certified case always carries its expiration (see the helper).
      eta9089ExpirationDate: fullCaseData.eta9089ExpirationDate,
      // Always recalculate derived dates on update
      recruitmentStartDate: derivedDates.recruitmentStartDate ?? undefined,
      recruitmentEndDate: derivedDates.recruitmentEndDate ?? undefined,
      filingWindowOpens: derivedDates.filingWindowOpens ?? undefined,
      filingWindowCloses: derivedDates.filingWindowCloses ?? undefined,
      recruitmentWindowCloses: derivedDates.recruitmentWindowCloses ?? undefined,
      updatedAt: Date.now(),
    });

    if (leavingClosed) {
      await dismissAutoClosureAlerts(ctx, args.id);
    }

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
      await recordError(ctx, "mutation", "cases.updateCase.audit", auditError, { userId: oldDoc!.userId, resourceId: args.id.toString() });
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
      const userPrefs = buildUserNotificationPrefs(userProfile);

      // 1. Case status change notification
      if (caseStatusChanged) {
        if (userPrefs.emailStatusUpdates) {
          const notificationId = await ctx.runMutation(internal.notifications.createNotification, {
            userId: oldDoc!.userId,
            caseId: args.id,
            type: "status_change",
            title: "Case status updated",
            message: `Case for ${caseLabel} status changed from ${formatCaseStatus(oldDoc!.caseStatus)} to ${formatCaseStatus(actualNewCaseStatus)}.`,
            priority: "normal",
          });

          // Schedule email if preferences allow
          if (shouldSendEmail("status_change", "normal", userPrefs)) {
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
        if (userPrefs.emailStatusUpdates) {
          await ctx.runMutation(internal.notifications.createNotification, {
            userId: oldDoc!.userId,
            caseId: args.id,
            type: "status_change",
            title: "Case progress updated",
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
          title: "Job description updated",
          message: `Job description for ${caseLabel} has been updated.`,
          priority: "low",
        });
        // Note: Not sending email for job description changes to reduce noise
      }
    } catch (notificationError) {
      // Log notification failure but don't fail the operation - case was updated successfully
      log.error('Failed to create notification', { resourceId: args.id, error: notificationError instanceof Error ? notificationError.message : String(notificationError) });
      await recordError(ctx, "mutation", "cases.updateCase.notification", notificationError, { userId: oldDoc!.userId, resourceId: args.id.toString() });
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
        await recordError(ctx, "mutation", "cases.updateCase.calendar", calendarError, { userId: oldDoc!.userId, resourceId: args.id.toString() });
      }
    }

    return args.id;
  },
});

/**
 * Clears what other records hold about deleted cases: the custom case order,
 * the timeline selection, dismissed deadlines, a conversation's related case,
 * chat citations and duplicate links. Each step is best-effort: a failure is
 * logged and recorded under `report.source`, and the remaining steps still run.
 */
async function clearCaseReferences(
  ctx: MutationCtx,
  userId: Id<"users">,
  caseIds: Id<"cases">[],
  report: { source: string; suffix: string; resourceId?: Id<"cases"> },
): Promise<void> {
  const ids = new Set(caseIds);
  const failed = async (what: string, step: string, err: unknown) => {
    log.error(`Failed to cleanup ${what}${report.suffix}`, {
      ...(report.resourceId ? { resourceId: report.resourceId } : {}),
      error: err instanceof Error ? err.message : String(err),
    });
    await recordError(
      ctx,
      "mutation",
      `${report.source}.${step}`,
      err,
      report.resourceId ? { userId, resourceId: report.resourceId.toString() } : { userId },
    );
  };

  // Remove the cases from userCaseOrder.caseIds
  try {
    const userCaseOrder = await ctx.db
      .query("userCaseOrder")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (userCaseOrder) {
      const kept = userCaseOrder.caseIds.filter((id) => !ids.has(id));
      if (kept.length !== userCaseOrder.caseIds.length) {
        await ctx.db.patch(userCaseOrder._id, { caseIds: kept, updatedAt: Date.now() });
      }
    }
  } catch (err) {
    await failed("userCaseOrder", "cleanupCaseOrder", err);
  }

  // Remove them from timelinePreferences.selectedCaseIds
  try {
    const timelinePrefs = await ctx.db
      .query("timelinePreferences")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (timelinePrefs?.selectedCaseIds) {
      const kept = timelinePrefs.selectedCaseIds.filter((id) => !ids.has(id));
      if (kept.length !== timelinePrefs.selectedCaseIds.length) {
        await ctx.db.patch(timelinePrefs._id, { selectedCaseIds: kept, updatedAt: Date.now() });
      }
    }
  } catch (err) {
    await failed("timelinePreferences", "cleanupTimeline", err);
  }

  // Remove their entries from userProfiles.dismissedDeadlines
  try {
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (userProfile) {
      const kept = userProfile.dismissedDeadlines.filter((d) => !ids.has(d.caseId));
      if (kept.length !== userProfile.dismissedDeadlines.length) {
        await ctx.db.patch(userProfile._id, { dismissedDeadlines: kept, updatedAt: Date.now() });
      }
    }
  } catch (err) {
    await failed("userProfiles.dismissedDeadlines", "cleanupDismissedDeadlines", err);
  }

  // Clear conversations.metadata.relatedCaseId where it names one of them
  try {
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    for (const conv of conversations) {
      if (conv.metadata?.relatedCaseId && ids.has(conv.metadata.relatedCaseId)) {
        await ctx.db.patch(conv._id, {
          metadata: {
            ...conv.metadata,
            relatedCaseId: undefined,
          },
          updatedAt: Date.now(),
        });
      }
    }
  } catch (err) {
    await failed("conversations.relatedCaseId", "cleanupConversations", err);
  }

  // Drop citations of them from conversationMessages
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
        if (msg.metadata?.citations?.some((c) => c.caseId && ids.has(c.caseId))) {
          await ctx.db.patch(msg._id, {
            metadata: {
              ...msg.metadata,
              citations: msg.metadata.citations.filter((c) => !c.caseId || !ids.has(c.caseId)),
            },
          });
        }
      }
    }
  } catch (err) {
    await failed("conversationMessages citations", "cleanupCitations", err);
  }

  // Clear duplicateOf on cases that point at one of them
  try {
    for (const id of caseIds) {
      const duplicates = await ctx.db
        .query("cases")
        .withIndex("by_user_and_duplicate", (q) =>
          q.eq("userId", userId).eq("duplicateOf", id)
        )
        .collect();

      for (const dup of duplicates) {
        await ctx.db.patch(dup._id, {
          duplicateOf: undefined,
          markedAsDuplicateAt: undefined,
        });
      }
    }
  } catch (err) {
    await failed("duplicateOf references", "cleanupDuplicateOf", err);
  }
}

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
      await recordError(ctx, "mutation", "cases.deleteCase.audit", auditError, { userId, resourceId: args.id.toString() });
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
      await recordError(ctx, "mutation", "cases.deleteCase.cleanupNotifications", cleanupError, { userId, resourceId: args.id.toString() });
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
      await recordError(ctx, "mutation", "cases.deleteCase.calendar", calendarError, { userId, resourceId: args.id.toString() });
    }

    // 3-8. What other records hold about this case
    await clearCaseReferences(ctx, userId, [args.id], {
      source: "cases.deleteCase",
      suffix: "",
      resourceId: args.id,
    });

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
          await recordError(ctx, "mutation", "cases.bulkRemove.audit", auditError, { userId, resourceId: id.toString() });
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
          await recordError(ctx, "mutation", "cases.bulkRemove.cleanupNotifications", cleanupError, { userId, resourceId: id.toString() });
        }

        // 2. Schedule calendar event deletion (async/background)
        try {
          await ctx.scheduler.runAfter(
            0,
            internal.googleCalendarActions.deleteCaseCalendarEvents,
            { userId: userId, caseId: id }
          );
        } catch (calendarError) {
          log.error('Failed to schedule event deletion in bulk', { resourceId: id, error: calendarError instanceof Error ? calendarError.message : String(calendarError) });
          await recordError(ctx, "mutation", "cases.bulkRemove.calendar", calendarError, { userId, resourceId: id.toString() });
        }

        // ===== HARD DELETE THE CASE =====
        await ctx.db.delete(id);

        deletedCaseIds.push(id);
        successCount++;
      } catch (error) {
        failedCount++;
        errors.push(`Case ${id}: ${error instanceof Error ? error.message : "Unknown error"}`);
        await recordError(ctx, "mutation", "cases.bulkRemove.deleteCase", error, { userId, resourceId: id.toString() });
      }
    }

    // ===== BATCH CLEANUP FOR SHARED RESOURCES (once, after all cases deleted) =====
    if (deletedCaseIds.length > 0) {
      // 3-8. What other records hold about the deleted cases
      await clearCaseReferences(ctx, userId, deletedCaseIds, {
        source: "cases.bulkRemove",
        suffix: " in bulk",
      });
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
          await recordError(ctx, "mutation", "cases.bulkUpdateStatus.audit", auditError, { userId, resourceId: id.toString() });
        }

        // Create notification for status change (v1 parity)
        try {
          const userProfile = await ctx.db
            .query("userProfiles")
            .withIndex("by_user_id", (q) => q.eq("userId", oldDoc.userId))
            .first();
          const bulkPrefs = buildUserNotificationPrefs(userProfile);

          if (bulkPrefs.emailStatusUpdates) {
            const notificationId = await ctx.runMutation(internal.notifications.createNotification, {
              userId: oldDoc.userId,
              caseId: id,
              type: "status_change",
              title: "Case status updated",
              message: `Case for ${oldDoc.beneficiaryIdentifier || "beneficiary"} status changed from ${oldDoc.caseStatus} to ${args.status}.`,
              priority: "normal",
            });

            // Schedule email if preferences allow - limit bulk emails to first 10 cases
            // to prevent overwhelming the user with too many emails at once
            if (successCount < 10 && shouldSendEmail("status_change", "normal", bulkPrefs)) {
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
          await recordError(ctx, "mutation", "cases.bulkUpdateStatus.notification", notificationError, { userId, resourceId: id.toString() });
        }

        successCount++;
        successfulCaseIds.push(id);
      } catch (error) {
        failedCount++;
        errors.push(`Case ${id}: ${error instanceof Error ? error.message : "Unknown error"}`);
        await recordError(ctx, "mutation", "cases.bulkUpdateStatus.updateCase", error, { userId, resourceId: id.toString() });
      }
    }

    // Schedule calendar sync for successfully updated cases (best-effort, non-blocking)
    // Status changes affect calendar display (e.g., case stage progression)
    if (successfulCaseIds.length > 0) {
      try {
        const syncResult = await scheduleCalendarSyncBulk(ctx, userId, successfulCaseIds);
        if (syncResult.scheduledCount > 0) {
          log.info('Scheduled bulk sync for status-updated cases', { count: syncResult.scheduledCount });
        }
      } catch (calendarError) {
        // Log calendar sync failure but don't fail the operation - status updates were successful
        log.error('Failed to schedule bulk sync for status updates', { error: calendarError instanceof Error ? calendarError.message : String(calendarError) });
        await recordError(ctx, "mutation", "cases.bulkUpdateStatus.calendar", calendarError, { userId });
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
          const syncResult = await scheduleCalendarSyncBulk(ctx, userId, successfulCaseIds);
          if (syncResult.scheduledCount > 0) {
            log.info('Scheduled bulk sync for cases', { count: syncResult.scheduledCount });
          }
        } else {
          // Disabling - delete from calendar
          for (const caseId of successfulCaseIds) {
            await ctx.scheduler.runAfter(
              0,
              internal.googleCalendarActions.deleteCaseCalendarEvents,
              { userId: userId, caseId }
            );
          }
          log.info('Scheduled bulk delete for cases', { count: successfulCaseIds.length });
        }
      } catch (calendarError) {
        // Log but don't fail - the DB updates were successful
        log.error('Error scheduling bulk calendar operations', { error: calendarError instanceof Error ? calendarError.message : String(calendarError) });
        await recordError(ctx, "mutation", "cases.bulkUpdateCalendarSync.calendar", calendarError, { userId });
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
      throw new ConvexError("Cannot update deleted case");
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
      await recordError(ctx, "mutation", "cases.toggleCalendarSync.calendar", calendarError, { userId: caseDoc!.userId, resourceId: args.id.toString() });
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
      throw new ConvexError("Cannot update deleted case");
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
        await recordError(ctx, "mutation", "cases.enableCalendarSync.calendar", calendarError, { userId: caseDoc!.userId, resourceId: args.id.toString() });
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
      throw new ConvexError("Cannot update deleted case");
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
        await recordError(ctx, "mutation", "cases.disableCalendarSync.calendar", calendarError, { userId: caseDoc!.userId, resourceId: args.id.toString() });
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
      throw new ConvexError("Case not found");
    }
    await verifyOwnership(ctx, caseDoc, "case");

    if (caseDoc.deletedAt !== undefined) {
      throw new ConvexError("Cannot update deleted case");
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
      .withIndex("by_user_and_deleted", (q) =>
        q.eq("userId", userId).eq("deletedAt", undefined)
      )
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

/** An RFI or RFE entry as an import file carries it. */
const importedRequestEntry = v.object({
  id: v.string(),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  notes: v.optional(v.string()),
  reason: v.optional(v.string()), // Alias for notes from v1 format
  receivedDate: v.string(),
  responseDueDate: v.string(),
  responseSubmittedDate: v.optional(v.string()),
  createdAt: v.optional(v.number()),
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
        // Older export formats: the beneficiary is required, the position
        // isn't, entries may lack `createdAt`, an RFI or RFE note may arrive
        // as `reason`, and a note's status is pending or done.
        employerName: v.string(),
        beneficiaryIdentifier: v.string(),
        ...caseInput
          .pick(
            "positionTitle",
            "caseStatus",
            "progressStatus",
            "priorityLevel",
            "isFavorite",
            "isPinned",
            "isProfessionalOccupation",
            "calendarSyncEnabled",
            "showOnTimeline",
            "pwdFilingDate",
            "pwdDeterminationDate",
            "pwdExpirationDate",
            "pwdCaseNumber",
            "pwdWageAmount",
            "pwdWageLevel",
            "jobOrderStartDate",
            "jobOrderEndDate",
            "sundayAdFirstDate",
            "sundayAdSecondDate",
            "sundayAdNewspaper",
            "additionalRecruitmentStartDate",
            "additionalRecruitmentEndDate",
            "eta9089FilingDate",
            "eta9089CertificationDate",
            "eta9089ExpirationDate",
            "eta9089CaseNumber",
            "i140FilingDate",
            "i140ReceiptDate",
            "i140ReceiptNumber",
            "i140ApprovalDate",
            "i140DenialDate",
            "caseNumber",
            "internalCaseNumber",
            "employerFein",
            "jobTitle",
            "socCode",
            "socTitle",
            "jobOrderState",
            "noticeOfFilingStartDate",
            "noticeOfFilingEndDate",
            "recruitmentApplicantsCount",
            "recruitmentSummaryCustom",
            "recruitmentNotes",
            "eta9089AuditDate",
            "i140Category",
            "i140PremiumProcessing",
            "i140ServiceCenter",
            "progressStatusOverride",
            "tags",
            "jobDescriptionPositionTitle",
            "jobDescription",
          )
          .partial().fields,
        // Additional Recruitment Methods (array of objects)
        additionalRecruitmentMethods: v.optional(
          v.array(
            v.object({
              method: v.string(),
              date: v.optional(v.string()),
              description: v.optional(v.string()),
              startDate: v.optional(v.string()),
              endDate: v.optional(v.string()),
              subEntries: v.optional(v.array(
                v.object({
                  date: v.string(),
                  description: v.optional(v.string()),
                })
              )),
            })
          )
        ),
        rfiEntries: v.optional(v.array(importedRequestEntry)),
        rfeEntries: v.optional(v.array(importedRequestEntry)),
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
      .withIndex("by_user_and_deleted", (q) =>
        q.eq("userId", userId).eq("deletedAt", undefined)
      )
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
      // The same caps as create, so an imported file can't store more than the form can.
      validateInputLengths([
        { value: caseData.employerName, name: "Employer Name", limit: INPUT_LIMITS.SHORT },
        { value: caseData.positionTitle, name: "Position Title", limit: INPUT_LIMITS.SHORT },
        { value: caseData.beneficiaryIdentifier, name: "Beneficiary Identifier", limit: INPUT_LIMITS.SHORT },
        { value: caseData.jobDescription, name: "Job Description", limit: INPUT_LIMITS.LONG },
        { value: caseData.recruitmentNotes, name: "Recruitment Notes", limit: INPUT_LIMITS.MEDIUM },
        { value: caseData.recruitmentSummaryCustom, name: "Recruitment Summary", limit: INPUT_LIMITS.MEDIUM },
      ]);
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
            await recordError(ctx, "mutation", "cases.importCases.replaceAudit", auditError, { userId, resourceId: existingCaseId.toString() });
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
            await recordError(ctx, "mutation", "cases.importCases.replaceCleanupNotifications", cleanupError, { userId, resourceId: existingCaseId.toString() });
          }

          // Schedule calendar event deletion
          try {
            await ctx.scheduler.runAfter(
              0,
              internal.googleCalendarActions.deleteCaseCalendarEvents,
              { userId: userId, caseId: existingCaseId }
            );
          } catch (calendarError) {
            log.error('Failed to schedule event deletion during import replace', { resourceId: existingCaseId, error: calendarError instanceof Error ? calendarError.message : String(calendarError) });
            await recordError(ctx, "mutation", "cases.importCases.replaceCalendar", calendarError, { userId, resourceId: existingCaseId.toString() });
          }

          // Clean up userCaseOrder
          try {
            const userCaseOrder = await ctx.db
              .query("userCaseOrder")
              .withIndex("by_user_id", (q) => q.eq("userId", userId))
              .first();
            if (userCaseOrder && userCaseOrder.caseIds.includes(existingCaseId)) {
              await ctx.db.patch(userCaseOrder._id, {
                caseIds: userCaseOrder.caseIds.filter((id) => id !== existingCaseId),
                updatedAt: now,
              });
            }
          } catch (cleanupError) {
            log.error('Failed to cleanup userCaseOrder during import replace', { resourceId: existingCaseId, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
            await recordError(ctx, "mutation", "cases.importCases.replaceCleanupCaseOrder", cleanupError, { userId, resourceId: existingCaseId.toString() });
          }

          // Clean up timelinePreferences
          try {
            const timelinePrefs = await ctx.db
              .query("timelinePreferences")
              .withIndex("by_user_id", (q) => q.eq("userId", userId))
              .first();
            if (timelinePrefs?.selectedCaseIds?.includes(existingCaseId)) {
              await ctx.db.patch(timelinePrefs._id, {
                selectedCaseIds: timelinePrefs.selectedCaseIds.filter((id) => id !== existingCaseId),
                updatedAt: now,
              });
            }
          } catch (cleanupError) {
            log.error('Failed to cleanup timelinePreferences during import replace', { resourceId: existingCaseId, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
            await recordError(ctx, "mutation", "cases.importCases.replaceCleanupTimeline", cleanupError, { userId, resourceId: existingCaseId.toString() });
          }

          // Clean up dismissedDeadlines
          try {
            const userProfile = await ctx.db
              .query("userProfiles")
              .withIndex("by_user_id", (q) => q.eq("userId", userId))
              .first();
            if (userProfile?.dismissedDeadlines.some((d) => d.caseId === existingCaseId)) {
              await ctx.db.patch(userProfile._id, {
                dismissedDeadlines: userProfile.dismissedDeadlines.filter((d) => d.caseId !== existingCaseId),
                updatedAt: now,
              });
            }
          } catch (cleanupError) {
            log.error('Failed to cleanup dismissedDeadlines during import replace', { resourceId: existingCaseId, error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
            await recordError(ctx, "mutation", "cases.importCases.replaceCleanupDismissedDeadlines", cleanupError, { userId, resourceId: existingCaseId.toString() });
          }

          // Clean up conversation references
          try {
            const conversations = await ctx.db
              .query("conversations")
              .withIndex("by_user_id", (q) => q.eq("userId", userId))
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
            await recordError(ctx, "mutation", "cases.importCases.replaceCleanupConversations", cleanupError, { userId, resourceId: existingCaseId.toString() });
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
        userId: userId,
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
        recruitmentNotes: caseData.recruitmentNotes,
        progressStatusOverride: caseData.progressStatusOverride,
        // Transform additionalRecruitmentMethods to ensure date is required
        additionalRecruitmentMethods: (caseData.additionalRecruitmentMethods ?? []).map((m) => ({
          method: m.method,
          date: m.date ?? "",
          description: m.description,
        })),
        tags: caseData.tags ?? [],
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
        eta9089ExpirationDate: resolveEta9089ExpirationDate(
          caseData.eta9089CertificationDate,
          caseData.eta9089ExpirationDate
        ),
        eta9089CaseNumber: caseData.eta9089CaseNumber,
        eta9089AuditDate: caseData.eta9089AuditDate,
        i140FilingDate: caseData.i140FilingDate,
        i140ReceiptDate: caseData.i140ReceiptDate,
        i140ReceiptNumber: caseData.i140ReceiptNumber,
        i140ApprovalDate: caseData.i140ApprovalDate,
        i140DenialDate: caseData.i140DenialDate,
        i140Category: caseData.i140Category,
        i140PremiumProcessing: caseData.i140PremiumProcessing,
        i140ServiceCenter: caseData.i140ServiceCenter,

        // Optional text fields
        caseNumber: caseData.caseNumber,
        internalCaseNumber: caseData.internalCaseNumber,
        employerFein: await encryptFein(caseData.employerFein),
        jobTitle: caseData.jobTitle,
        socCode: caseData.socCode,
        socTitle: caseData.socTitle,
        jobOrderState: caseData.jobOrderState,
        jobDescriptionPositionTitle: caseData.jobDescriptionPositionTitle,
        jobDescription: caseData.jobDescription,

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
        await recordError(ctx, "mutation", "cases.importCases.audit", auditError, { userId, resourceId: caseId.toString() });
      }

      importedCount++;
    }

    return { importedCount, skippedCount, replacedCount, validationWarnings };
  },
});

/** The filters the case list and its "select all" both take. */
const caseListFilterArgs = {
  status: v.optional(v.string()),
  progressStatus: v.optional(v.string()),
  searchQuery: v.optional(v.string()),
  favoritesOnly: v.optional(v.boolean()),
  duplicatesOnly: v.optional(v.boolean()),
  activeOnly: v.optional(v.boolean()),
};

/**
 * The case list's filters other than search: stage, progress, favourites,
 * duplicates, and active-only (neither closed nor an approved I-140).
 */
function applyCaseListFilters<T extends Doc<"cases">>(
  cases: T[],
  args: ObjectType<typeof caseListFilterArgs>,
): T[] {
  return cases.filter((c) => {
    if (args.status !== undefined && c.caseStatus !== args.status) return false;
    if (args.progressStatus !== undefined && c.progressStatus !== args.progressStatus) return false;
    if (args.favoritesOnly === true && c.isFavorite !== true) return false;
    if (args.duplicatesOnly === true && c.duplicateOf === undefined) return false;
    if (args.activeOnly === true) {
      if (c.caseStatus === "closed") return false;
      if (c.caseStatus === "i140" && c.progressStatus === "approved") return false;
    }
    return true;
  });
}

/**
 * List cases with filtering, sorting, and pagination
 * Returns paginated case card data with metadata
 * Gracefully handles unauthenticated state by returning empty results
 *
 * It reads the account's live cases (newest first, up to USER_CASES_MAX)
 * and then filters, sorts and pages them in memory; `pagination.truncated`
 * says when the account holds more than one read returns.
 */
export const listFiltered = query({
  args: {
    ...caseListFilterArgs,
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

    // 1.5 Security: Verify userId exists in users table (protects against invalid/foreign auth tokens)
    const userExists = await ctx.db.get(userId);
    if (!userExists) {
      console.warn("[listFiltered] Invalid userId from auth token:", userId);
      return {
        cases: [],
        pagination: createCaseListPagination({
          page: 1,
          pageSize: args.pageSize ?? 12,
          totalCount: 0,
        }),
      };
    }

    // 2-3. Live cases, newest first; `truncated` says when the account holds
    // more than one read returns (convex/lib/userCases.ts)
    const read = await readUserCases(ctx, userId);
    let filteredCases = read.cases;
    const totalUnfilteredCount = filteredCases.length;

    // 4-6. Stage, progress, favourites, duplicates and active-only
    filteredCases = applyCaseListFilters(filteredCases, args);

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
        totalUnfilteredCount,
        truncated: read.truncated,
      }),
    };
  },
});

/**
 * Whether the account holds more live cases than one read returns
 * (USER_CASES_MAX). The case list, dashboard, calendar and timeline show a
 * notice when it does (src/components/cases/CaseCapNotice.tsx), so no page
 * leaves cases out without saying so.
 */
export const readCoverage = query({
  args: {},
  handler: async (ctx): Promise<{ truncated: boolean; max: number }> => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) return { truncated: false, max: USER_CASES_MAX };
    const { truncated } = await readUserCases(ctx, userId);
    return { truncated, max: USER_CASES_MAX };
  },
});

/**
 * Get all case IDs matching the current filters (for "Select All" functionality)
 * Returns just IDs to minimize data transfer - does not return full case data
 */
export const listFilteredIds = query({
  args: caseListFilterArgs,
  handler: async (ctx, args): Promise<Id<"cases">[]> => {
    // 1. Get authenticated user (null-safe for sign-out transitions)
    const userId = await getCurrentUserIdOrNull(ctx);

    // Return empty result if not authenticated
    if (userId === null) {
      return [];
    }

    // 1.5 Security: Verify userId exists in users table (protects against invalid/foreign auth tokens)
    const userExists = await ctx.db.get(userId);
    if (!userExists) {
      console.warn("[listFilteredIds] Invalid userId from auth token:", userId);
      return [];
    }

    // 2-3. Live cases, newest first (convex/lib/userCases.ts)
    let filteredCases = (await readUserCases(ctx, userId)).cases;

    // 4-7. Stage, progress, favourites, duplicates and active-only
    filteredCases = applyCaseListFilters(filteredCases, args);

    // 8. The list's own search, so "select all" and "export what's shown" pick
    // exactly the cases the list shows, fuzzy matches included.
    if (args.searchQuery !== undefined && args.searchQuery.length > 0) {
      const todayISO = new Date().toISOString().split("T")[0] as string;
      const cards = filteredCases.map((caseDoc) => projectCaseForCard(caseDoc, todayISO));
      return filterBySearch(cards, args.searchQuery).map((c) => c._id as Id<"cases">);
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
      throw new ConvexError("Case is not closed");
    }

    // Check not deleted
    if (caseDoc!.deletedAt !== undefined) {
      throw new ConvexError("Cannot reopen deleted case");
    }

    // Capture old state for audit logging
    const oldDoc = caseDoc;

    // Determine appropriate status based on case data using helper function
    const { caseStatus: newCaseStatus, progressStatus: newProgressStatus } =
      determineReopenStatus(caseDoc!);

    await ctx.db.patch(args.id, {
      caseStatus: newCaseStatus,
      progressStatus: newProgressStatus,
      // Clear the closure trail now that the case is open again.
      closureReason: undefined,
      closedAt: undefined,
      updatedAt: Date.now(),
    });
    await dismissAutoClosureAlerts(ctx, args.id);

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
      await recordError(ctx, "mutation", "cases.reopenCase.audit", auditError, { userId: oldDoc!.userId, resourceId: args.id.toString() });
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

      // Return full case data (excluding userId for privacy), decrypt FEIN
      const { userId: _userId, ...caseData } = caseDoc;
      cases.push({ ...caseData, employerFein: await decryptFein(caseData.employerFein) });
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
    // Live cases, newest first (convex/lib/userCases.ts)
    const { cases } = await readUserCases(ctx, args.userId);
    return cases
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

    const { cases } = await readUserCases(ctx, userId);

    // Count live cases with sync enabled (not explicitly false)
    return cases.filter((c) => c.calendarSyncEnabled !== false).length;
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

    const { cases } = await readUserCases(ctx, userId);

    // Count live cases with calendar events
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
