/**
 * PERM Tracker Database Schema
 * =============================
 *
 * Convex schema definition for the PERM case tracking application.
 * This file is the single source of truth for all database table structures.
 *
 * ## Table of Contents
 *
 * ### User Management
 * - `users` - Core auth fields (extended from @convex-dev/auth)
 * - `userProfiles` - App-specific user data (settings, preferences)
 *
 * ### Case Management
 * - `cases` - PERM case tracking (PWD, recruitment, ETA 9089, I-140)
 *
 * ### Communications
 * - `notifications` - Deadline alerts and system messages
 * - `conversations` - Chatbot conversation tracking
 * - `conversationMessages` - Message history with tool calls
 *
 * ### Infrastructure
 * - `auditLogs` - Append-only change tracking
 * - `userCaseOrder` - Custom drag-drop case ordering
 * - `timelinePreferences` - Timeline display settings
 * - `rateLimits` - Request throttling for auth endpoints
 * - `apiUsage` - Daily usage tracking for external search APIs
 *
 * ## Naming Conventions
 * - Tables: camelCase (cases, userProfiles, auditLogs)
 * - Fields: camelCase (employerName, pwdFilingDate, rfiEntries)
 * - Indexes: snake_case with "by_" prefix (by_user_id, by_user_and_status)
 *
 * ## Design Patterns
 * - All tables use soft deletes via `deletedAt` timestamp
 * - User data isolation via Row-Level Security pattern (userId foreign keys)
 * - Audit logging for compliance and debugging
 * - Branded types in TypeScript for compile-time safety
 *
 * @see /docs/SCHEMA_MIGRATION.md for deprecation and migration guides
 * @see /convex/lib/perm/statusTypes.ts for CaseStatus/ProgressStatus types
 */

import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { errorSourceValidator } from "./lib/errorRecording";
import { contactEventTypeValidator } from "./marketingWebhook";
import { CASE_STATUSES, PROGRESS_STATUSES } from "./lib/perm/statusTypes";

// Reusable literal-union validators built from the single-source status arrays
// in `lib/perm/statusTypes.ts`, so schema + app code never drift. `caseStatus`
// and `progressStatus` are used by both the `cases` table and the
// `userCaseOrder.filters` snapshot.
const caseStatusValidator = v.union(
  ...CASE_STATUSES.map((s) => v.literal(s)),
);
const progressStatusValidator = v.union(
  ...PROGRESS_STATUSES.map((s) => v.literal(s)),
);

export default defineSchema({
  // Spread authTables (includes users, authSessions, authAccounts, etc.)
  ...authTables,

  // Extend users table with minimal auth-related fields
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    phone: v.optional(v.string()),
    // DEPRECATED: Unreliable — custom createOrUpdateUser bypasses the library's
    // default setter. Use authAccounts table via isEmailVerified() instead.
    // Kept as optional for backwards compat with existing documents.
    emailVerificationTime: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("by_deleted_at", ["deletedAt"]),

  // Separate table for app-specific user data (survives Clerk migration)
  userProfiles: defineTable({
    // 1:1 relationship with users table
    userId: v.id("users"),

    // Profile section
    fullName: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    company: v.optional(v.string()),
    profilePhotoUrl: v.optional(v.string()),

    // Organization section
    // The firm hierarchy (firm_admin/firm_member, firmId, firmName, the
    // by_firm_id index and three auth helpers) was declared in 2025 and never
    // called from anywhere. Removed 2026-08-24 with zero rows carrying any of
    // its fields; if firms become real, build the invite flow first and the
    // schema after it.
    userType: v.literal("individual"),

    // Notification settings
    emailNotificationsEnabled: v.boolean(),
    smsNotificationsEnabled: v.boolean(),
    pushNotificationsEnabled: v.boolean(),
    pushSubscription: v.optional(v.string()), // JSON stringified PushSubscription
    urgentDeadlineDays: v.number(), // Days before deadline to mark urgent
    reminderDaysBefore: v.array(v.number()), // e.g., [1, 3, 7, 14, 30]

    // Email preferences
    emailDeadlineReminders: v.boolean(), // Master toggle for all deadline reminders
    // Individual deadline type reminders (granular control)
    emailDeadlineReminderPwd: v.optional(v.boolean()),
    emailDeadlineReminderRecruitment: v.optional(v.boolean()),
    emailDeadlineReminderEta9089: v.optional(v.boolean()),
    emailDeadlineReminderI140: v.optional(v.boolean()),
    emailDeadlineReminderRfi: v.optional(v.boolean()),
    emailDeadlineReminderRfe: v.optional(v.boolean()),
    emailStatusUpdates: v.boolean(),
    emailRfeAlerts: v.boolean(),
    emailWeeklyDigest: v.optional(v.boolean()), // Weekly summary email (Mondays 9 AM EST) - defaults to false
    // DEPRECATED: No longer used — emails always go to signup email.
    // Kept as optional for backwards compat with existing documents.
    preferredNotificationEmail: v.optional(v.union(
      v.literal("signup"),
      v.literal("google"),
      v.literal("both")
    )),

    // Quiet hours
    quietHoursEnabled: v.boolean(),
    quietHoursStart: v.optional(v.string()), // HH:MM format
    quietHoursEnd: v.optional(v.string()),
    timezone: v.string(), // IANA timezone

    // Calendar sync
    calendarSyncEnabled: v.boolean(),
    calendarSyncPwd: v.boolean(),
    calendarSyncEta9089: v.boolean(),
    calendarSyncI140: v.boolean(),
    calendarSyncRfe: v.boolean(),
    calendarSyncRfi: v.boolean(),
    calendarSyncRecruitment: v.boolean(),
    calendarSyncFilingWindow: v.boolean(),

    // Google OAuth
    googleEmail: v.optional(v.string()),
    googleRefreshToken: v.optional(v.string()),
    googleAccessToken: v.optional(v.string()),
    googleTokenExpiry: v.optional(v.number()),
    googleScopes: v.optional(v.array(v.string())),
    googleCalendarConnected: v.boolean(),
    gmailConnected: v.boolean(),

    // UI preferences
    casesSortBy: v.string(), // e.g., "updatedAt", "nextDeadline"
    casesSortOrder: v.union(v.literal("asc"), v.literal("desc")),
    casesPerPage: v.number(),
    dismissedDeadlines: v.array(
      v.object({
        caseId: v.id("cases"),
        deadlineType: v.string(),
        dismissedAt: v.number(),
      })
    ),
    darkModeEnabled: v.boolean(),
    privacyModeEnabled: v.optional(v.boolean()),

    // Chatbot action mode
    /**
     * Controls how the chatbot handles actions that modify case data.
     * - "off": Chatbot cannot execute actions, only provides information
     * - "confirm": Chatbot proposes actions and waits for user confirmation (safest, default)
     * - "auto": Chatbot executes actions automatically without confirmation
     */
    actionMode: v.optional(v.union(v.literal("off"), v.literal("confirm"), v.literal("auto"))),

    // Calendar UI preferences
    calendarHiddenCases: v.optional(v.array(v.id("cases"))),
    calendarHiddenDeadlineTypes: v.optional(v.array(v.string())),
    calendarShowCompleted: v.optional(v.boolean()), // Show I-140 approved cases
    calendarShowClosed: v.optional(v.boolean()), // Show closed/archived cases

    // Admin UI preferences
    adminSortBy: v.optional(v.union(
      v.literal("lastActivity"), v.literal("email"), v.literal("name"),
      v.literal("accountStatus"), v.literal("totalCases"), v.literal("activeCases"),
      v.literal("totalLogins"), v.literal("accountCreated"), v.literal("lastLoginTime"),
      v.literal("userType"), v.literal("emailVerified"), v.literal("verificationMethod"),
      v.literal("deletedCases"), v.literal("termsVersion"),
      v.literal("termsAccepted"), v.literal("lastCaseUpdate"), v.literal("deletedAt"),
      v.literal("userId"), v.literal("authProviders")
    )),
    adminSortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),

    // DEPRECATED (2026-06-08): admin self-notification emails ("New User Signup",
    // "First Case Created", "New Case Created") were removed entirely for cost control.
    // These optional fields are retained ONLY because one legacy admin profile still
    // carries them; dropping them from the schema would fail deploy validation against
    // that doc without a data migration. Nothing reads or writes them anymore. Safe to
    // delete after clearing the values from that one profile.
    adminNotifyNewUser: v.optional(v.boolean()),
    adminNotifyFirstCase: v.optional(v.boolean()),
    adminNotifyAnyCase: v.optional(v.boolean()),

    // Deadline Enforcement
    autoDeadlineEnforcementEnabled: v.boolean(),

    // Legal & Compliance
    /**
     * Timestamp when user accepted Terms of Service and Privacy Policy.
     * Required for all users to use the service.
     * Stored as Unix timestamp (milliseconds since epoch).
     */
    termsAcceptedAt: v.optional(v.number()),
    /**
     * Version of Terms of Service accepted (for re-consent when terms change).
     * Format: "YYYY-MM-DD" matching the effective date in the Terms page.
     */
    termsVersion: v.optional(v.string()),

    // Onboarding
    /**
     * Current onboarding step for the wizard/tour flow.
     * undefined = not started, "done" = fully complete.
     * Wizard steps: "welcome" | "role" | "create_case" | "value_preview" | "completion"
     * Post-wizard: "tour_pending" | "tour_completed" | "done"
     */
    onboardingStep: v.optional(v.string()),
    /** Timestamp when onboarding wizard was completed. */
    onboardingCompletedAt: v.optional(v.number()),
    /** Completed checklist item IDs. */
    onboardingChecklist: v.optional(v.array(v.string())),
    /** Whether the user dismissed the getting-started checklist. */
    onboardingChecklistDismissed: v.optional(v.boolean()),

    // Login tracking (persistent — authSessions get cleaned up by Convex Auth)
    loginCount: v.optional(v.number()),
    lastLoginAt: v.optional(v.number()),

    // Server-side inactivity tracking (heartbeat writes this every 5 min)
    lastActiveAt: v.optional(v.number()),

    // Re-engagement nudge state. reengagementNudgeSentAt: when the "you've been
    // away" email was sent (one nudge per inactivity spell; cleared on next
    // login). weeklyDigestSuppressedAt: when the weekly digest was auto-paused
    // after the nudge went unanswered — distinguishes an auto-pause from a manual
    // unsubscribe and drives the in-app reactivation banner.
    reengagementNudgeSentAt: v.optional(v.number()),
    weeklyDigestSuppressedAt: v.optional(v.number()),

    // One-shot flag: welcome email + admin notification are fired on first
    // successful authenticated login (NOT on signup). This prevents signup-spam
    // from delivering emails via our verified sender reputation — unverified
    // attackers never reach this point. Set to true once the post-signup emails
    // have been sent successfully. See convex/users.ts:recordMyLogin.
    postSignupEmailsSent: v.optional(v.boolean()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),

    /**
     * Scheduled deletion job ID (for cancellation).
     * References `_scheduled_functions` - a Convex system table that tracks scheduled jobs.
     * This allows us to cancel the permanent deletion if the user changes their mind.
     * @see scheduledJobs.ts permanentlyDeleteAccount for the scheduled job handler
     */
    scheduledDeletionJobId: v.optional(v.id("_scheduled_functions")),

    // Abuse suspension (admin-controlled). When `suspendedAt` is set, login
    // is blocked until `suspendedUntil` passes or an admin unsuspends.
    suspendedAt: v.optional(v.number()),
    suspendedReason: v.optional(v.string()),
    suspendedUntil: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_deleted_at", ["deletedAt"]),

  // PERM case tracking
  cases: defineTable({
    // Core identity
    userId: v.id("users"),
    caseNumber: v.optional(v.string()), // DOL case number
    internalCaseNumber: v.optional(v.string()), // Attorney's reference

    // Employer info
    employerName: v.string(),
    employerFein: v.optional(v.string()),

    // Beneficiary info
    beneficiaryIdentifier: v.optional(v.string()), // Privacy-safe identifier (optional)

    // Position info
    positionTitle: v.string(),
    jobTitle: v.optional(v.string()),
    socCode: v.optional(v.string()),
    socTitle: v.optional(v.string()),
    jobOrderState: v.optional(v.string()), // 2-letter state code

    // Case status (two-tier system) — single-sourced from lib/perm/statusTypes
    caseStatus: caseStatusValidator,
    progressStatus: progressStatusValidator,
    progressStatusOverride: v.optional(v.boolean()),

    // Sample case flag (for onboarding demo data)
    isSample: v.optional(v.boolean()),

    // PWD phase
    pwdFilingDate: v.optional(v.string()), // ISO date YYYY-MM-DD
    pwdDeterminationDate: v.optional(v.string()),
    pwdExpirationDate: v.optional(v.string()), // Auto-calculated
    pwdCaseNumber: v.optional(v.string()),
    pwdWageAmount: v.optional(v.number()), // Stored as dollars (e.g., 85000 or 85000.50)
    pwdWageLevel: v.optional(v.string()),

    // Recruitment - Job Order
    jobOrderStartDate: v.optional(v.string()),
    jobOrderEndDate: v.optional(v.string()),

    // Recruitment - Sunday Ads
    sundayAdFirstDate: v.optional(v.string()),
    sundayAdSecondDate: v.optional(v.string()),
    sundayAdNewspaper: v.optional(v.string()),

    // Recruitment - Additional Methods
    // DEPRECATED: Legacy top-level date fields (Feature 006 moves dates to method level)
    // Keep for backward compatibility - do NOT remove until data migration is complete
    additionalRecruitmentStartDate: v.optional(v.string()),
    additionalRecruitmentEndDate: v.optional(v.string()),
    additionalRecruitmentMethods: v.array(
      v.object({
        method: v.string(),
        date: v.string(),
        description: v.optional(v.string()),
        // Feature 006: Per-method date fields
        startDate: v.optional(v.string()),   // For date-range methods (job_website_ad, employer_website, private_employment_firm)
        endDate: v.optional(v.string()),     // For date-range methods
        subEntries: v.optional(v.array(      // For radio_ad, tv_ad (multiple spots)
          v.object({
            date: v.string(),
            description: v.optional(v.string()),
          })
        )),
      })
    ),
    recruitmentNotes: v.optional(v.string()),
    recruitmentApplicantsCount: v.number(),
    recruitmentSummaryCustom: v.optional(v.string()),

    // Derived recruitment dates (auto-calculated, stored for queryability)
    // These are computed from recruitment dates and stored in mutations
    recruitmentStartDate: v.optional(v.string()), // MIN of all start dates (first step)
    recruitmentEndDate: v.optional(v.string()),   // MAX of all end dates (last step)
    filingWindowOpens: v.optional(v.string()),    // recruitmentEnd + 30 days
    filingWindowCloses: v.optional(v.string()),   // MIN(recruitmentStart + 180 days, pwdExpiration)
    recruitmentWindowCloses: v.optional(v.string()), // MIN(recruitmentStart + 150 days, pwdExpiration - 30 days)

    // Professional occupation
    isProfessionalOccupation: v.boolean(),

    // Notice of Filing
    noticeOfFilingStartDate: v.optional(v.string()),
    noticeOfFilingEndDate: v.optional(v.string()),

    // ETA 9089
    eta9089FilingDate: v.optional(v.string()),
    eta9089AuditDate: v.optional(v.string()),
    eta9089CertificationDate: v.optional(v.string()),
    eta9089ExpirationDate: v.optional(v.string()),
    eta9089CaseNumber: v.optional(v.string()),

    /**
     * RFI entries (Request for Information from DOL).
     * Strict 30-day response deadline, auto-calculated from receivedDate.
     *
     * @optional Backwards compatibility - existing documents may not have this field.
     * New cases always initialize with empty array [].
     */
    rfiEntries: v.optional(v.array(
      v.object({
        id: v.string(),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        notes: v.optional(v.string()),
        receivedDate: v.string(),
        responseDueDate: v.string(), // Auto-calculated: +30 days, NOT editable
        responseSubmittedDate: v.optional(v.string()),
        createdAt: v.number(),
      })
    )),

    /**
     * RFE entries (Request for Evidence from USCIS for I-140).
     * Due date is user-editable (varies by case complexity).
     *
     * @optional Backwards compatibility - existing documents may not have this field.
     * New cases always initialize with empty array [].
     */
    rfeEntries: v.optional(v.array(
      v.object({
        id: v.string(),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        notes: v.optional(v.string()),
        receivedDate: v.string(),
        responseDueDate: v.string(), // USER EDITABLE
        responseSubmittedDate: v.optional(v.string()),
        createdAt: v.number(),
      })
    )),

    // I-140
    i140FilingDate: v.optional(v.string()),
    i140ReceiptDate: v.optional(v.string()),
    i140ReceiptNumber: v.optional(v.string()),
    i140ApprovalDate: v.optional(v.string()),
    i140DenialDate: v.optional(v.string()),
    i140Category: v.optional(v.union(v.literal("EB-1"), v.literal("EB-2"), v.literal("EB-2-NIW"), v.literal("EB-3"))),
    i140PremiumProcessing: v.optional(v.boolean()),
    i140ServiceCenter: v.optional(v.string()),

    // Organization & Metadata
    priorityLevel: v.union(
      v.literal("low"),
      v.literal("normal"),
      v.literal("high"),
      v.literal("urgent")
    ),
    isFavorite: v.boolean(),
    /**
     * Pinned cases appear at top of case list.
     * @optional Backwards compatibility - existing documents default to false.
     */
    isPinned: v.optional(v.boolean()),
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
          dueDate: v.optional(v.string()), // ISO date string
        })
      )
    ),
    tags: v.array(v.string()),

    // Job Description (for PERM postings)
    /**
     * Position title for the job description.
     * Inherited from positionTitle by default, but can be edited independently.
     * Used for template matching and display.
     * @optional Backwards compatibility - existing documents won't have this.
     */
    jobDescriptionPositionTitle: v.optional(v.string()),
    /**
     * Job description text for PERM postings.
     * Can be loaded from templates or entered manually.
     * @optional Backwards compatibility - existing documents won't have this.
     */
    jobDescription: v.optional(v.string()),
    /**
     * Reference to the template this job description was loaded from.
     * Null if entered manually or if template was deleted.
     * @optional Only set when loaded from a template.
     */
    jobDescriptionTemplateId: v.optional(v.id("jobDescriptionTemplates")),

    // Calendar integration - maps deadline type to Google Calendar event ID
    calendarEventIds: v.optional(
      v.object({
        pwd_expiration: v.optional(v.string()),
        eta9089_filing_window: v.optional(v.string()),
        eta9089_expiration: v.optional(v.string()),
        i140_filing_deadline: v.optional(v.string()),
        rfi_due: v.optional(v.string()),
        rfe_due: v.optional(v.string()),
        recruitment_end: v.optional(v.string()),
        recruitment_window_closes: v.optional(v.string()),
        job_order_start_deadline: v.optional(v.string()),
        notice_of_filing_start_deadline: v.optional(v.string()),
        first_sunday_ad_deadline: v.optional(v.string()),
        second_sunday_ad_deadline: v.optional(v.string()),
      })
    ),
    calendarSyncEnabled: v.boolean(),
    /**
     * Whether to display this case on the timeline view.
     * @optional Backwards compatibility - existing documents default to true.
     */
    showOnTimeline: v.optional(v.boolean()),

    // Document attachments (ISS-007)
    documents: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        url: v.string(), // Convex file storage serving URL
        storageId: v.optional(v.string()), // Convex _storage ID for deletion
        mimeType: v.string(),
        size: v.number(), // File size in bytes
        uploadedAt: v.number(),
        category: v.optional(
          v.union(
            v.literal("pwd"),
            v.literal("recruitment"),
            v.literal("eta9089"),
            v.literal("i140"),
            v.literal("general")
          )
        ),
      })
    ),

    // Duplicate tracking
    // When a case is created as a duplicate (user chose "Create Anyway"), this stores the original
    duplicateOf: v.optional(v.id("cases")),
    // Timestamp when this case was marked as a duplicate (for filtering/metrics)
    markedAsDuplicateAt: v.optional(v.number()),

    // Closure tracking (auto-closure and manual)
    closureReason: v.optional(v.union(
      // Auto-closure reasons
      v.literal("pwd_expired"),
      v.literal("recruitment_window_missed"),
      v.literal("filing_window_missed"),
      v.literal("eta9089_expired"),
      // Manual closure reasons
      v.literal("withdrawn"),
      v.literal("denied"),
      v.literal("manual"),
      v.literal("other")
    )),
    closedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_and_deleted", ["userId", "deletedAt"])
    .index("by_user_and_duplicate", ["userId", "duplicateOf"])
    .index("by_user_and_status", ["userId", "caseStatus"])
    .index("by_user_and_favorite", ["userId", "isFavorite"])
    .index("by_user_and_priority", ["userId", "priorityLevel"])
    .index("by_user_and_updated_at", ["userId", "updatedAt"]) // ISS-009: Sorting index
    .index("by_deleted_at", ["deletedAt"])
    // Chatbot-ready indexes for deadline queries
    .index("by_user_and_filing_deadline", ["userId", "filingWindowCloses"])
    .index("by_user_and_pwd_expiration", ["userId", "pwdExpirationDate"])
    .index("by_user_and_recruitment_end", ["userId", "recruitmentEndDate"])
    .index("by_user_and_recruitment_window", ["userId", "recruitmentWindowCloses"]),

  // Notifications for deadline alerts and system messages
  notifications: defineTable({
    // Relationships
    userId: v.id("users"),
    caseId: v.optional(v.id("cases")), // Optional - system notifications don't have case

    // Notification content
    type: v.union(
      v.literal("deadline_reminder"),
      v.literal("status_change"),
      v.literal("rfe_alert"),
      v.literal("rfi_alert"),
      v.literal("system"),
      v.literal("auto_closure")
    ),
    title: v.string(),
    message: v.string(),

    // Priority
    priority: v.union(
      v.literal("low"),
      v.literal("normal"),
      v.literal("high"),
      v.literal("urgent")
    ),

    // Deadline information
    deadlineDate: v.optional(v.string()), // ISO date
    deadlineType: v.optional(v.string()), // e.g., "pwd_expiration", "rfi_due"
    daysUntilDeadline: v.optional(v.number()),

    // Read status
    isRead: v.boolean(),
    readAt: v.optional(v.number()),

    // Email status
    emailSent: v.boolean(),
    emailSentAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_and_unread", ["userId", "isRead"])
    .index("by_case_id", ["caseId"])
    .index("by_deadline_date", ["deadlineDate"]),

  // Chatbot conversation tracking
  conversations: defineTable({
    userId: v.id("users"),
    title: v.string(),
    isArchived: v.boolean(),
    // Conversation context metadata
    metadata: v.optional(
      v.object({
        // Related case for context
        relatedCaseId: v.optional(v.id("cases")),
        // Conversation type/purpose
        conversationType: v.optional(
          v.union(
            v.literal("general"),
            v.literal("case_inquiry"),
            v.literal("deadline_help"),
            v.literal("document_help")
          )
        ),
        // Last active timestamp for cleanup
        lastActiveAt: v.optional(v.number()),
        // Custom tags for organization
        tags: v.optional(v.array(v.string())),
      })
    ),
    // Conversation summary for context compression
    summary: v.optional(
      v.object({
        content: v.string(), // Compressed history text (prose, bounded at ~1000 tokens)
        facts: v.optional(v.string()), // JSON string of structured entities (cases, people, dates, preferences, openActions) — merged losslessly across compactions
        tokenCount: v.number(), // Approximate tokens in summary
        messageCountAtSummary: v.number(), // Messages when summarized
        lastSummarizedAt: v.number(), // Timestamp of summarization
        summarizingAt: v.optional(v.number()), // Race lock: timestamp when summarization started, cleared on finish. Stale entries (>60s) are treated as unlocked.
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_and_archived", ["userId", "isArchived"]),

  // Chatbot message history
  conversationMessages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    // Tool calls made by the assistant
    toolCalls: v.optional(
      v.array(
        v.object({
          tool: v.string(),
          // Arguments are JSON-serialized to string for consistent storage
          arguments: v.string(),
          // Result is JSON-serialized to string for consistent storage
          result: v.optional(v.string()),
          status: v.optional(
            v.union(
              v.literal("pending"),
              v.literal("success"),
              v.literal("error")
            )
          ),
          executedAt: v.optional(v.number()),
        })
      )
    ),
    // Message metadata
    metadata: v.optional(
      v.object({
        // Citations or references
        citations: v.optional(
          v.array(
            v.object({
              caseId: v.optional(v.id("cases")),
              field: v.optional(v.string()),
              value: v.optional(v.string()),
            })
          )
        ),
        // Processing time in ms
        processingTimeMs: v.optional(v.number()),
        // Model used (for debugging)
        model: v.optional(v.string()),
        // Token usage
        tokenCount: v.optional(v.number()),
      })
    ),
    createdAt: v.number(),
  })
    .index("by_conversation_id", ["conversationId"])
    .index("by_created_at", ["createdAt"]),

  // Audit logging for detailed change tracking (append-only)
  auditLogs: defineTable({
    userId: v.id("users"), // Who made the change
    tableName: v.string(), // Which table was affected
    documentId: v.string(), // ID of affected document (stored as string for flexibility)
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete")
    ),
    changes: v.optional(
      v.array(
        v.object({
          field: v.string(),
          // Values are serialized to string for consistency across all field types
          oldValue: v.optional(v.string()),
          newValue: v.optional(v.string()),
        })
      )
    ),
    metadata: v.optional(
      v.object({
        ipAddress: v.optional(v.string()),
        userAgent: v.optional(v.string()),
        source: v.optional(v.string()), // "web", "api", "chatbot"
      })
    ),
    timestamp: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_table_name", ["tableName"])
    .index("by_document_id", ["documentId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_user_and_table", ["userId", "tableName"])
    .index("by_user_and_timestamp", ["userId", "timestamp"]),

  // Custom case order (drag-drop reordering)
  userCaseOrder: defineTable({
    userId: v.id("users"),
    // Ordered array of case IDs (defines the custom order)
    caseIds: v.array(v.id("cases")),
    // Snapshot of active filters when custom order was saved
    // (status/progressStatus single-sourced from lib/perm/statusTypes)
    filters: v.object({
      status: v.optional(caseStatusValidator),
      progressStatus: v.optional(progressStatusValidator),
      searchQuery: v.optional(v.string()),
      favoritesOnly: v.optional(v.boolean()),
    }),
    // Sort method active when custom order was saved (for handling new cases)
    baseSortMethod: v.union(
      v.literal("deadline"),
      v.literal("updated"),
      v.literal("employer"),
      v.literal("status"),
      v.literal("pwdFiled"),
      v.literal("etaFiled"),
      v.literal("i140Filed")
    ),
    baseSortOrder: v.union(v.literal("asc"), v.literal("desc")),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"]),

  // Timeline display preferences
  timelinePreferences: defineTable({
    userId: v.id("users"),
    // Selected case IDs (null = all active cases, empty array = none)
    selectedCaseIds: v.optional(v.array(v.id("cases"))),
    // Time range in months (3, 6, 12, or 24)
    timeRange: v.union(
      v.literal(3),
      v.literal(6),
      v.literal(12),
      v.literal(24)
    ),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"]),

  // Rate limiting table for tracking request attempts
  // Used to protect auth endpoints from brute force attacks
  rateLimits: defineTable({
    key: v.string(), // Composite key: action:identifier
    timestamp: v.number(), // When the attempt occurred
    identifier: v.string(), // Email, IP, or user ID
    action: v.string(), // Action type (e.g., "otp_verify", "password_reset")
  })
    .index("by_key_and_timestamp", ["key", "timestamp"])
    .index("by_timestamp", ["timestamp"]), // For cleanup queries

  // Abuse blocklist — IPs auto-banned after repeat rate-limit offenses.
  // Middleware short-circuits on any entry whose expiresAt > now.
  // Entries auto-expire; cleanup cron removes stale rows to bound table size.
  abuseBlocklist: defineTable({
    ip: v.string(),              // Normalized client IP (lowercased, first-hop only)
    addedAt: v.number(),         // When the block was created
    expiresAt: v.number(),       // Absolute timestamp when block auto-lifts
    reason: v.string(),          // Why blocked (e.g., "ip_auth_limit_tripped_3x")
    strikes: v.number(),         // Accumulated rate-limit strikes that led here
    manualOverride: v.boolean(), // True when an admin set/cleared this manually
  })
    .index("by_ip", ["ip"])
    .index("by_expiresAt", ["expiresAt"]), // For cleanup

  // API usage tracking for external search providers
  // Used to enforce daily rate limits for web search APIs
  apiUsage: defineTable({
    provider: v.string(), // "tavily" | "brave"
    date: v.string(), // YYYY-MM-DD (UTC)
    count: v.number(), // Number of API calls made
  }).index("by_provider_date", ["provider", "date"]),

  // Tool result caching for chat API
  // Caches expensive tool calls (case queries, knowledge search, web search)
  // to avoid redundant API calls within a conversation
  toolCache: defineTable({
    conversationId: v.id("conversations"),
    toolName: v.string(), // "query_cases" | "search_knowledge" | "search_web"
    queryHash: v.string(), // Hash of query params for lookup
    queryParams: v.string(), // JSON of original params (for debugging)
    result: v.string(), // JSON stringified result
    createdAt: v.number(),
    expiresAt: v.number(), // TTL-based expiration
  })
    .index("by_conversation_tool_hash", ["conversationId", "toolName", "queryHash"])
    .index("by_expires", ["expiresAt"]),

  /**
   * Job Description Templates
   *
   * Reusable job description templates for PERM cases.
   * Templates are user-scoped and identified by position title (name).
   * No duplicate names allowed per user.
   *
   * Usage: When filling out PERM applications, attorneys often need
   * the same job description text for multiple postings. Templates
   * allow saving and reusing descriptions efficiently.
   */
  jobDescriptionTemplates: defineTable({
    // Owner
    userId: v.id("users"),

    // Template identity - position title serves as the template name
    // Must be unique per user (enforced in mutations)
    name: v.string(),

    // The actual job description text
    description: v.string(),

    // Usage tracking
    usageCount: v.number(), // Incremented when template is loaded
    lastUsedAt: v.optional(v.number()), // Timestamp of last use

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()), // Soft delete
  })
    .index("by_user_id", ["userId"])
    .index("by_user_and_name", ["userId", "name"])
    .index("by_deleted_at", ["deletedAt"]),

  // =========================================================================
  // Support Emails
  // =========================================================================

  /**
   * Inbound support emails received via Resend webhook.
   * Stores full email content for admin review and threaded replies.
   */
  supportEmails: defineTable({
    // Sender info
    fromEmail: v.string(),
    fromName: v.optional(v.string()),

    // Recipient (usually support@permtracker.app)
    toEmail: v.string(),

    // Email content
    subject: v.string(),
    bodyHtml: v.optional(v.string()),
    bodyText: v.optional(v.string()),

    // Threading headers
    messageId: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.string()),

    // Resend metadata
    resendEmailId: v.string(),

    // Status tracking
    status: v.union(
      v.literal("received"),
      v.literal("replied"),
      v.literal("forwarded"),
      v.literal("archived")
    ),

    // Admin reply (stored for history)
    replyBody: v.optional(v.string()),
    repliedAt: v.optional(v.number()),
    replyMessageId: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_created_at", ["createdAt"])
    .index("by_from_email", ["fromEmail"]),

  /**
   * System Errors
   *
   * Stores application errors for admin visibility and debugging.
   * Frontend errors are captured by Sentry; this table stores
   * backend (Convex) errors that need admin attention.
   */
  systemErrors: defineTable({
    // Single-sourced from `systemErrors.ts` — see `errorSourceValidator`.
    // `"query"` was removed here (no writer ever produced it; the mutation,
    // the `ErrorSource` TS type, and `sentryReportAction` all omit it).
    source: errorSourceValidator,
    operation: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    resourceId: v.optional(v.string()),
    extra: v.optional(v.string()),
    resolved: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_resolved", ["resolved", "createdAt"])
    .index("by_source", ["source", "createdAt"])
    .index("by_created_at", ["createdAt"]),

  /**
   * Append-only audit log of Resend contact webhook events (subscribe, unsubscribe, delete).
   * Resend remains the source of truth for current subscription status — this table mirrors
   * the event stream for analytics and churn visibility. Deduped by svix message ID.
   */
  marketingEvents: defineTable({
    svixId: v.string(), // Idempotency key from svix-id header
    email: v.string(),
    contactId: v.string(), // Resend contact UUID
    audienceId: v.optional(v.string()),
    // Event types: live Resend webhook deliveries + synthetic backfill rows
    // generated by `marketingEmail.backfillMarketingEvents`. Tightened from
    // v.string() to a literal union — all existing rows match these literals.
    // Single-sourced from `marketingWebhook.ts` (`contactEventTypeValidator`).
    eventType: contactEventTypeValidator,
    unsubscribed: v.boolean(),
    occurredAt: v.number(), // Resend's top-level created_at (epoch ms)
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    rawPayload: v.string(), // Full event JSON for debugging
  })
    .index("by_svix_id", ["svixId"])
    .index("by_email_and_time", ["email", "occurredAt"])
    .index("by_occurred", ["occurredAt"])
    .index("by_event_type_and_time", ["eventType", "occurredAt"]),

  /**
   * DOL processing-times snapshots
   *
   * Captures https://flag.dol.gov/processingtimes, which is the official
   * ground truth for where the PERM and prevailing-wage queues actually are.
   *
   * DOL publishes a SNAPSHOT and overwrites it each month. The page carries no
   * history and no archive, so the moment a new one goes up the previous
   * figures are gone. Keeping every snapshot is the entire point of this
   * table: it turns a single number into a measured series, which is what
   * lets the site state how far the queue moved between two real dates
   * instead of predicting where it will go next.
   *
   * Rows are immutable. A run only inserts when `contentHash` matches NO row we
   * already hold, so re-fetching an unchanged page is a no-op and the series
   * contains one row per genuine publication. Note that is any row, not merely
   * the newest: if DOL published A, then B, then reverted to exactly A, the
   * revert is treated as already-seen and not stored. That is deliberate (it
   * keeps a flapping page from filling the table) and narrow in practice,
   * because `permAsOf` is part of the hash, so a true revert would have to
   * restore the old as-of date too.
   */
  dolProcessingTimes: defineTable({
    // DOL's own as-of stamp for the PERM section (YYYY-MM-DD). The PERM and
    // prevailing-wage sections update on different cadences and carry
    // different dates, so they are stored separately rather than collapsed
    // into one misleading "last updated".
    permAsOf: v.string(),
    pwdAsOf: v.optional(v.string()),

    // Which filing month each PERM queue is currently working.
    // `priorityDate` is null where DOL prints "--".
    permQueues: v.array(
      v.object({
        queue: v.string(),
        priorityDate: v.union(v.string(), v.null()),
        raw: v.string(),
      }),
    ),

    // Average calendar days to a determination, as published by DOL.
    permAverageDays: v.array(
      v.object({
        determination: v.string(),
        month: v.union(v.string(), v.null()),
        calendarDays: v.union(v.number(), v.null()),
        raw: v.string(),
      }),
    ),

    // Prevailing-wage queue across all programs (PERM, H-1B, H-2B, CW-1).
    pwdQueues: v.array(
      v.object({
        program: v.string(),
        oewsReceiptDate: v.union(v.string(), v.null()),
        nonOewsReceiptDate: v.union(v.string(), v.null()),
      }),
    ),

    // Prevailing-wage requests still pending for PERM, by month of receipt.
    pwdPermBacklog: v.array(
      v.object({
        receiptMonth: v.string(),
        remainingRequests: v.number(),
      }),
    ),

    // Canonical source recorded per row, so a stored snapshot is
    // self-describing if it is ever exported or cited.
    sourceUrl: v.string(),
    // When we fetched, as distinct from DOL's as-of date.
    fetchedAt: v.number(),
    // Stable hash of the parsed content. Drives insert-only-on-change, and
    // catches a silent DOL correction that reuses the same as-of date.
    contentHash: v.string(),
  })
    // by_perm_as_of was declared here and never queried. Dropped: an unused
    // index is a write cost on every insert and a false signal about how the
    // table is read.
    .index("by_fetched", ["fetchedAt"])
    .index("by_content_hash", ["contentHash"]),

  /**
   * Derived statistics from DOL's quarterly PERM disclosure files.
   *
   * AGGREGATES ONLY, and that is a hard boundary rather than a preference. The
   * source rows carry `ATTY_AG_EMAIL`, `EMP_POC_EMAIL`, `DECL_PREP_EMAIL`,
   * direct phone numbers and street addresses for roughly 112,000 real people.
   * The file is public, republishing it is not our business, and nothing on
   * this table can identify a case or a person. The ingest computes counts and
   * percentiles and discards every row.
   *
   * Written as one snapshot document rather than a row per cohort, matching
   * `dolProcessingTimes` above. The whole payload is a few KB against Convex's
   * 1 MB document limit, and a snapshot keeps a published figure and the data
   * it came from atomically consistent.
   *
   * Ingestion cannot run inside Convex: a single quarterly file is 1.21 GB of
   * XML uncompressed, so it is stream-parsed outside and only the result is
   * written here.
   */
  permDisclosureStats: defineTable({
    /** Filenames unioned for this snapshot, e.g. `PERM_Disclosure_Data_FY2026_Q3.xlsx`. */
    sourceFiles: v.array(v.string()),
    /** Distinct cases across the union, after de-duplicating by case number. */
    uniqueCases: v.number(),

    /**
     * Receipt-to-determination percentiles per filing month, over DECIDED
     * cases only.
     *
     * These are unsafe to read for a filing month DOL has not worked through:
     * the disclosure files contain no pending rows, so a recent month shows
     * only its earliest closures. Measured on real data, the June-2026 cohort's
     * median is 1 day. `cohortMaturity()` in
     * `convex/lib/perm/calculators/queueEstimate.ts` is what decides whether a
     * row here may be published, and it keys on DOL's frontier, never on
     * anything in this table.
     */
    cohorts: v.array(
      v.object({
        /** Filing month, `YYYY-MM`. */
        cohortMonth: v.string(),
        decided: v.number(),
        p25: v.union(v.number(), v.null()),
        p50: v.union(v.number(), v.null()),
        p75: v.union(v.number(), v.null()),
        p90: v.union(v.number(), v.null()),
      }),
    ),

    /** Determinations issued per calendar month. DOL's actual clearance rate. */
    clearanceByMonth: v.array(
      v.object({
        /** `YYYY-MM` of the determination. */
        month: v.string(),
        decisions: v.number(),
      }),
    ),

    /**
     * The frontier history DOL does not publish.
     *
     * DOL's processing-times page shows only where the queue stands today and
     * keeps no archive, so the rate at which it advances cannot be read from
     * DOL at all. Determination dates let it be reconstructed backwards: for
     * each month of decisions, the median filing month those decisions came
     * from. That series is what makes the queue-advance model measurable
     * instead of assumed.
     */
    frontierHistory: v.array(
      v.object({
        /** `YYYY-MM` in which the determinations were issued. */
        decisionMonth: v.string(),
        /** `YYYY-MM` filing month at the median of those determinations. */
        medianFilingMonth: v.string(),
        decisions: v.number(),
      }),
    ),

    computedAt: v.number(),
    /** Insert-only-on-change, matching `dolProcessingTimes`. */
    /**
     * Analytical dimensions from the same union, added 2026-08-24. Aggregate
     * only — the ingest never lets a row survive its parse loop, and employer
     * names are as printed in DOL's public disclosure file.
     */
    byState: v.optional(v.array(v.object({
      state: v.string(),
      total: v.number(),
      certified: v.number(),
      denied: v.number(),
      withdrawn: v.number(),
      medianDays: v.union(v.number(), v.null()),
      medianAnnualWage: v.union(v.number(), v.null()),
    }))),
    topOccupations: v.optional(v.array(v.object({
      code: v.string(),
      title: v.string(),
      total: v.number(),
      certified: v.number(),
      denied: v.number(),
      medianDays: v.union(v.number(), v.null()),
      medianAnnualWage: v.union(v.number(), v.null()),
    }))),
    topEmployers: v.optional(v.array(v.object({
      name: v.string(),
      total: v.number(),
      certified: v.number(),
      denied: v.number(),
      medianDays: v.union(v.number(), v.null()),
    }))),

    /**
     * The law firm on the filing. DOL publishes it and no competitor surfaces
     * it for the people it describes, which is the attorney half of this
     * product's audience.
     */
    topAttorneys: v.optional(v.array(v.object({
      name: v.string(),
      state: v.string(),
      total: v.number(),
      certified: v.number(),
      denied: v.number(),
      medianDays: v.union(v.number(), v.null()),
    }))),

    /** National offered-wage percentiles over certified cases. */
    wageLadder: v.optional(v.union(v.object({
      count: v.number(),
      p10: v.union(v.number(), v.null()),
      p25: v.union(v.number(), v.null()),
      p50: v.union(v.number(), v.null()),
      p75: v.union(v.number(), v.null()),
      p90: v.union(v.number(), v.null()),
    }), v.null())),

    /**
     * Denial rates by wage band, fiscal year and form flag. Withdrawals are in
     * neither the numerator nor the denominator: a withdrawn case is not an
     * approval and not a denial, and counting it as either misstates the rate.
     */
    risk: v.optional(v.object({
      baseline: v.object({
        decided: v.number(),
        denied: v.number(),
        denialRate: v.number(),
      }),
      byWage: v.array(v.object({
        bucket: v.string(),
        decided: v.number(),
        denied: v.number(),
        denialRate: v.number(),
      })),
      byYear: v.array(v.object({
        bucket: v.string(),
        decided: v.number(),
        denied: v.number(),
        denialRate: v.number(),
      })),
      byFlag: v.array(v.object({
        bucket: v.string(),
        decided: v.number(),
        denied: v.number(),
        denialRate: v.number(),
      })),
    })),
    contentHash: v.string(),
  })
    .index("by_computed", ["computedAt"])
    .index("by_content_hash", ["contentHash"]),

  /**
   * The employment-based visa bulletin, as a series.
   *
   * Sourced from the Internet Archive, because travel.state.gov refuses
   * automated clients behind a bot challenge and defeating that is not
   * something this project does. Reading a public archive of a public page is
   * a different thing, and the archive is built to be read programmatically.
   *
   * The trade is freshness: the archive lags the live bulletin by a month or
   * two, so nothing built on this may claim to hold the current month. Every
   * row carries the bulletin's own month, and the pages label figures with it.
   *
   * A series rather than a snapshot on purpose. Anyone can read this month's
   * cutoff off the State Department's page; what they cannot get is the
   * direction, and direction is what matters. Across the archived run EB-2
   * India advanced from January 2013 to July 2014, went backwards to September
   * 2013, then became unavailable.
   */
  visaBulletins: defineTable({
    /** The bulletin's own month, `YYYY-MM`. Not when it was archived. */
    bulletinMonth: v.string(),
    /** Wayback timestamp of the snapshot read, for provenance. */
    archivedAt: v.string(),
    sourceUrl: v.string(),
    /**
     * Cutoffs per category, per country, exactly as the bulletin prints them:
     * a `DDMMMYY` date, `C` for current, or `U` for unavailable. Stored raw so
     * the parser stays in one place and a cell we cannot read is visible as
     * itself rather than silently becoming a date.
     */
    finalAction: v.any(),
    datesForFiling: v.any(),
    computedAt: v.number(),
  })
    .index("by_month", ["bulletinMonth"])
    .index("by_computed", ["computedAt"]),

  /**
   * USCIS I-140 counts, per petition subtype, for the newest published quarter.
   *
   * Separate from `i140ProcessingTimes` in the frontend, and the two answer
   * different questions on purpose. That table holds what USCIS says a case
   * takes, measured over petitions already decided. This one holds how many are
   * stacked up and how fast they are clearing, which on real figures disagrees:
   * the national interest waiver shows 89,215 pending against 6,325 completed
   * in a quarter, while USCIS publishes 29 to 32 months for the same category.
   * Both are true, because NIW intake is outrunning its output.
   *
   * Ingested by `scripts/ingest_uscis_i140.py` from www.uscis.gov, which serves
   * scripts. The processing-time figures live on egov.uscis.gov behind a bot
   * challenge and are deliberately not fetched by anything.
   */
  uscisI140Stats: defineTable({
    /** The workbook this came from, e.g. `i140_fy2026_q2_v1.xlsx`. */
    sourceFile: v.string(),
    /** USCIS's own quarter label, e.g. `FY2026 Q2`. */
    asOfQuarter: v.string(),
    subtypes: v.array(
      v.object({
        /** USCIS subtype code, e.g. `NIW`. */
        code: v.string(),
        label: v.string(),
        received: v.number(),
        approved: v.number(),
        denied: v.number(),
        /** Awaiting a decision at quarter end. Never by receipt month: USCIS
         *  does not publish that, so "how many are ahead of me" is unanswerable. */
        pending: v.number(),
      }),
    ),
    computedAt: v.number(),
    /** Insert-only-on-change, matching the other ingested tables. */
    contentHash: v.string(),
  })
    .index("by_computed", ["computedAt"])
    .index("by_content_hash", ["contentHash"]),

  /**
   * Queue-reached alerts
   *
   * A visitor tells us the month their case was filed and we email them once,
   * when DOL's analyst-review queue actually reaches it. That is the single
   * question every PERM applicant has, and DOL's own page cannot answer it
   * because it only shows today's frontier and keeps no history.
   *
   * Deliberately minimal: an email address and a month. We ask an optional
   * role because it is the one field that changes what we build next, and
   * nothing else, because nothing else would be used.
   *
   * Double opt-in. A row is inert until `confirmedAt` is set, so a typo'd or
   * malicious address never receives mail. Confirm and unsubscribe both run on
   * the existing HMAC token scheme rather than a guessable id.
   */
  dolQueueAlerts: defineTable({
    email: v.string(),
    /** Month the case was filed with DOL, "YYYY-MM". */
    filingMonth: v.string(),
    /**
     * WHICH DOL queue the month is measured against. Absent means "perm"
     * (the analyst-review frontier) - every row that existed before the PWD
     * queues were added has no value here, and rewriting history to add one
     * would churn rows for nothing. The PWD variants compare the same
     * "YYYY-MM" month against the OEWS / non-OEWS receipt-date frontiers
     * from the same DOL snapshot.
     */
    queue: v.optional(
      v.union(
        v.literal("perm"),
        v.literal("pwd-oews"),
        v.literal("pwd-nonoews"),
      ),
    ),
    /** Optional, and the only segmentation we collect. */
    role: v.optional(
      v.union(v.literal("attorney"), v.literal("applicant"), v.literal("employer")),
    ),

    /** Null until the address is confirmed; nothing is ever sent before then. */
    confirmedAt: v.optional(v.number()),
    /**
     * A month change requested by an unauthenticated POST, held here until the
     * inbox owner clicks a fresh confirm link.
     *
     * Applying a change straight to `filingMonth` would let anyone who knows an
     * address rewrite that person's subscription, resurrect an opt-out, or reset
     * `notifiedAt` to trigger another send. Staging it means a hostile POST costs
     * one confirmation email and changes nothing.
     */
    pendingFilingMonth: v.optional(v.string()),
    /**
     * Throttles repeat confirmation sends to THIS address. It cannot stop an
     * attacker cycling fresh addresses, which is what the per-IP limit on the
     * HTTP route is for. Written before the send, so it records intent; a
     * failed send clears it (see queueAlerts.clearConfirmationCooldown).
     */
    lastConfirmationSentAt: v.optional(v.number()),
    /** Set once the queue reached their month and we sent the one alert. */
    notifiedAt: v.optional(v.number()),
    /** Set when they opt out. Rows are kept so a later re-subscribe is honest. */
    unsubscribedAt: v.optional(v.number()),

    createdAt: v.number(),
    /** Where the signup happened, so we can see which page actually converts. */
    source: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    /**
     * Drives the notify sweep.
     *
     * Field order matters and is not cosmetic. Leading with the two "is this
     * row still live" flags means the range scan starts inside the un-notified,
     * un-unsubscribed rows and never walks the ones already dealt with. An
     * earlier version indexed `filingMonth` alone, so the sweep selected every
     * row at or before the frontier and filtered in JS: as the frontier
     * advanced that became a full-table read on every run, re-reading rows it
     * had already notified, forever.
     *
     * `confirmedAt` is deliberately NOT in the index. Convex allows a range
     * comparison only on the final indexed field, and `filingMonth` has to hold
     * that position, so adding it would force `filingMonth` to equality.
     */
    .index("by_alert_sweep", ["notifiedAt", "unsubscribedAt", "filingMonth"])
    .index("by_created", ["createdAt"]),

  /**
   * Someone waiting on ONE specific PERM case, by case number.
   *
   * Sibling of `dolQueueAlerts` and deliberately a separate table rather than a
   * variant of it. That one answers a COHORT question ("has DOL reached my
   * filing month") and fires exactly once, ever. This one answers a PER-CASE
   * question ("did anything happen to mine") and fires every time the status
   * moves, until the case reaches a final status and the subscription retires
   * itself. Same shape of consent, completely different lifecycle, and merging
   * them would mean one row carrying two `notifiedAt` semantics.
   *
   * One row per (email, caseNumber): a person routinely waits on their own case
   * and a spouse's.
   */
  caseStatusAlerts: defineTable({
    email: v.string(),
    /** Normalised DOL case number, e.g. "P-100-26125-868956". */
    caseNumber: v.string(),

    /**
     * The status as of the last time we told this subscriber, or as of the
     * moment they confirmed.
     *
     * THIS is the change detector, and it lives here rather than being read
     * back out of the mirror because the question is not "has the case moved"
     * but "has it moved since THIS subscriber last heard from us". A subscriber
     * who signs up the day after a transition must not be mailed about it.
     *
     * Compared with an explicit inequality between two defined values. A
     * truthiness check here would fire on every sweep for every row.
     */
    lastSeenStatus: v.optional(v.string()),

    /** Null until the address is confirmed; nothing is ever sent before then. */
    confirmedAt: v.optional(v.number()),
    /**
     * A case number requested by an unauthenticated POST, held until the inbox
     * owner clicks a fresh confirm link. Same reasoning as
     * `dolQueueAlerts.pendingFilingMonth`: writing straight to `caseNumber`
     * would let anyone who knows an address repoint that person's alerts.
     */
    pendingCaseNumber: v.optional(v.string()),
    /** Throttles repeat confirmations to THIS address. Records intent, not delivery. */
    lastConfirmationSentAt: v.optional(v.number()),

    /**
     * Set when the case reached a final status and we sent the last alert.
     *
     * Retires the row from the sweep permanently. A certified or denied case
     * cannot move again, so continuing to read it every hour would be a growing
     * cost that buys nothing, and this is the field that stops it.
     */
    caseClosedAt: v.optional(v.number()),
    /**
     * When the sweep last LOOKED at this row, whether or not anything moved.
     *
     * This is the sweep's cursor and it has to be distinct from
     * `lastAlertSentAt`. Using the send stamp as the cursor starves the tail of
     * the table: a subscription whose case has not moved never gets a send, so
     * its stamp stays undefined, so it sorts first on every single run and the
     * rows behind it are never reached. Bumping this on every read makes the
     * sweep round-robin over the whole table by construction.
     */
    lastCheckedAt: v.optional(v.number()),
    /** When we last mailed this subscriber. Drives the per-subscription cooldown only. */
    lastAlertSentAt: v.optional(v.number()),
    /** How many alerts this subscription has produced. Honest volume reporting. */
    alertCount: v.optional(v.number()),

    unsubscribedAt: v.optional(v.number()),
    createdAt: v.number(),
    /** Which page the signup came from. */
    source: v.optional(v.string()),
  })
    /** Token lookup and one-click unsubscribe, which act on every row for an address. */
    .index("by_email", ["email"])
    /** The upsert path on subscribe, and the only unique key. */
    .index("by_email_case", ["email", "caseNumber"])
    /**
     * Drives the sweep. Field order is load-bearing, exactly as it is on
     * `dolQueueAlerts.by_alert_sweep`.
     *
     * The two equality fields mean "is this subscription still live", so the
     * scan starts inside the rows that can still produce an email and never
     * walks a retired or opted-out one. `lastCheckedAt` holds the final
     * position because Convex allows a range comparison only there, and
     * because ascending order on it IS the round-robin: the least recently
     * checked rows come first, and rows never checked sort before every number
     * so a new subscription is looked at on the next sweep.
     *
     * `confirmedAt` is deliberately NOT indexed. It would have to take the
     * range position, and a "not undefined" test is a worse use of that slot
     * than the cursor. It is filtered in JS after the index has already cut
     * the read down to live rows.
     */
    .index("by_alert_sweep", ["unsubscribedAt", "caseClosedAt", "lastCheckedAt"])
    .index("by_created", ["createdAt"]),

  /**
   * Someone watching ONE visa-bulletin series: a category x country cutoff.
   *
   * Third sibling of `dolQueueAlerts` / `caseStatusAlerts`, same consent
   * grammar on purpose: double opt-in, staged changes, tombstoned opt-outs,
   * purpose-scoped tokens (`bulletin-confirm` / `bulletin-unsubscribe`).
   * Recurring like case alerts (a cutoff can move every month), not one-shot
   * like queue alerts, so it carries `lastSeenCutoff` as its change detector
   * rather than `notifiedAt`.
   */
  bulletinAlerts: defineTable({
    email: v.string(),
    /** Employment category as the bulletin prints it: EB1..EB5, EW3. */
    category: v.string(),
    /** Country column: ALL, CHINA, INDIA, MEXICO, PHILIPPINES. */
    country: v.string(),
    /**
     * The final-action cutoff we last told them about, as the bulletin
     * prints it ("C", "U", or "01JAN23"-style). Absent until the first
     * confirmed sweep baselines it, so the first alert is a real movement
     * rather than "here is the current value you already saw when you
     * subscribed".
     */
    lastSeenCutoff: v.optional(v.string()),
    /** Which bulletin month lastSeenCutoff came from, "YYYY-MM". */
    lastSeenBulletin: v.optional(v.string()),

    /** Null until the address is confirmed; nothing is ever sent before then. */
    confirmedAt: v.optional(v.number()),
    /**
     * A series change requested by an unauthenticated POST, staged exactly
     * like `pendingFilingMonth`: "category|country", applied only when the
     * inbox owner clicks a fresh confirm link.
     */
    pendingSeries: v.optional(v.string()),
    lastConfirmationSentAt: v.optional(v.number()),
    lastAlertSentAt: v.optional(v.number()),
    alertCount: v.optional(v.number()),
    unsubscribedAt: v.optional(v.number()),
    createdAt: v.number(),
    source: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    /** The upsert key: one row per (address, series). */
    .index("by_email_series", ["email", "category", "country"])
    /**
     * Drives the monthly sweep. The table is small (hundreds, not hundreds of
     * thousands), so live rows are the only cut that matters; `confirmedAt`
     * is filtered in JS as on the sibling tables.
     */
    .index("by_alert_sweep", ["unsubscribedAt", "createdAt"]),

  /**
   * Occasional product-news consent for addresses WITHOUT an account.
   *
   * Signed-in users' marketing consent lives in Resend (source of truth,
   * audited via marketingEvents). Anonymous alert subscribers could not join
   * that list because `marketingEmail.syncContacts` deletes any Resend
   * contact not in the `users` table - so this table extends the roster:
   * a confirmed, un-unsubscribed row here both creates the contact and
   * protects it from orphan removal.
   *
   * Rows are created UNCONFIRMED by the news checkbox on an alert form and
   * confirmed by the same double-opt-in click that confirms the alert; the
   * confirmation email states both. No sending path reads this table
   * directly - broadcasts go out via Resend, which is where the unsubscribe
   * footer lives too.
   */
  newsSubscribers: defineTable({
    email: v.string(),
    confirmedAt: v.optional(v.number()),
    unsubscribedAt: v.optional(v.number()),
    createdAt: v.number(),
    source: v.optional(v.string()),
  }).index("by_email", ["email"]),

  /**
   * One row per PERM entity: employer, law firm, or occupation.
   *
   * These used to live as arrays inside the permDisclosureStats document,
   * capped at the top 100. Measured, the uncapped set is 1.14 MB of
   * employers alone against Convex's 1 MB document limit, so the cap was
   * load-bearing rather than editorial and the data had to move.
   *
   * Rows are replaced wholesale per kind on each quarterly ingest, keyed by
   * `slug` so a URL that worked last quarter still works this one.
   */
  permEntities: defineTable({
    kind: v.union(
      v.literal("employer"),
      v.literal("attorney"),
      v.literal("occupation"),
    ),
    /** URL segment. Unique within a kind; collisions resolved at ingest. */
    slug: v.string(),
    name: v.string(),
    /** Rank by filing volume within its kind, 1-based. */
    rank: v.number(),
    total: v.number(),
    certified: v.number(),
    denied: v.number(),
    medianDays: v.union(v.number(), v.null()),
    /** Occupations and employers carry a wage; law firms do not. */
    medianAnnualWage: v.optional(v.union(v.number(), v.null())),
    /** Law firms carry a state; the SOC code lives here for occupations. */
    state: v.optional(v.string()),
    code: v.optional(v.string()),
    computedAt: v.number(),
  })
    /** Detail pages: one exact row. */
    // Name search, so an entity is findable even when it is far outside the
    // slice the index page has loaded. The page lazy-loads a bounded head of
    // the rank order; without this, searching for a small sponsor returns
    // "no match" when the row exists and simply was not downloaded.
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["kind"],
    })
    .index("by_kind_slug", ["kind", "slug"])
    /** Listing and generateStaticParams: ordered, bounded reads. */
    .index("by_kind_rank", ["kind", "rank"]),

  /**
   * Contact-form submissions. Stored first, THEN forwarded by a scheduled
   * action, so a Resend outage loses nothing - the message is already here.
   */
  /**
   * One row per PERM case DOL has published a decision for.
   *
   * Everything else derived from the disclosure files is an aggregate. This
   * is the exception, and it is deliberate: the rival product ships a
   * case-level browser and we hold the same source rows, so the only thing
   * separating us from it was where the rows were dropped.
   *
   * PRIVACY BOUNDARY, UNCHANGED IN SUBSTANCE. The source rows carry
   * `ATTY_AG_EMAIL`, `EMP_POC_EMAIL`, `DECL_PREP_EMAIL`, direct phone
   * numbers and street addresses for roughly 112,000 real people. Not one
   * of those columns is read by the ingest, and none of them can appear
   * here. Every field below is an organisation, a date, a job, or a wage -
   * the same facts DOL prints in the public file and the same facts the
   * aggregate pages already publish, just not yet summed.
   *
   * SIZE. ~259,000 rows against a 1 MB document limit is exactly why this
   * is a table and not an array on `permDisclosureStats`. Rows are replaced
   * wholesale each quarter (`clearBatch` looped, then `insertChunk`),
   * following `permEntities`, because Convex counts reads PER FUNCTION
   * EXECUTION and a clear-then-insert mutation cannot delete 259,000 rows
   * however it batches them internally.
   *
   * INDEXES. Every browse index ends in `decisionDate`, which buys the date
   * range filter on all of them for free (Convex allows a range comparison
   * only on the final indexed field). The leading fields are the slice, and
   * `planCaseQuery` in `convex/permCases.ts` is the only thing that chooses
   * among them - it is a pure function so the mapping can be tested, because
   * picking the wrong index here is the difference between a bounded read
   * and a table scan that dies at 4,096 documents.
   *
   * A later index addition must be declared `staged: true`: adding one to a
   * table this size blocks the deploy until the backfill finishes.
   */
  permCases: defineTable({
    /** DOL's case number, e.g. `A-24123-45678`. Unique within the window. */
    caseNumber: v.string(),
    status: v.union(
      v.literal("certified"),
      v.literal("denied"),
      v.literal("withdrawn"),
    ),
    /** Receipt date, `YYYY-MM-DD`. */
    receivedDate: v.string(),
    /** Determination date, `YYYY-MM-DD`. The sort key of every browse index. */
    decisionDate: v.string(),
    /** Receipt to determination. Stored, not derived: the ingest REJECTS a
     *  row outside 0..2500 days, so this value is a filtered fact rather
     *  than arithmetic anyone can redo from the two dates. */
    days: v.number(),
    /** Federal fiscal year of the DECISION. Present only because a search
     *  index filter field cannot express a date range; browse paths use a
     *  `decisionDate` range instead. */
    fiscalYear: v.string(),
    employerName: v.string(),
    /** Matching `permEntities` slug, or "" for an employer below the entity
     *  floor of 3 cases. "" means no detail page, so no link is rendered. */
    employerSlug: v.string(),
    /** Two-letter worksite state, or "" when DOL published none we resolve.
     *  Empty string rather than an absent field on purpose: every index over
     *  it stays dense and every filter over it is total. */
    state: v.string(),
    jobTitle: v.string(),
    socCode: v.string(),
    socTitle: v.string(),
    attorneyName: v.string(),
    attorneySlug: v.string(),
    /** Offered wage annualised from DOL's amount and unit-of-pay columns.
     *  `null` when the pair could not be trusted, which is not the same as
     *  zero and must not render as one. */
    wage: v.union(v.number(), v.null()),
    computedAt: v.number(),
  })
    /** Case-number lookup: one row, one read. */
    .index("by_case_number", ["caseNumber"])
    /** Everything, newest first. */
    .index("by_decision", ["decisionDate"])
    .index("by_status_decision", ["status", "decisionDate"])
    .index("by_state_decision", ["state", "decisionDate"])
    .index("by_state_status_decision", ["state", "status", "decisionDate"])
    .index("by_soc_decision", ["socCode", "decisionDate"])
    .index("by_soc_status_decision", ["socCode", "status", "decisionDate"])
    .index("by_employer_decision", ["employerSlug", "decisionDate"])
    .index("by_employer_status_decision", ["employerSlug", "status", "decisionDate"])
    .index("by_attorney_decision", ["attorneySlug", "decisionDate"])
    .index("by_attorney_status_decision", ["attorneySlug", "status", "decisionDate"])
    /**
     * Free text over the organisation names, which is the one thing no
     * ordered index can serve. Both cover the long tail that `permEntities`
     * cannot: an employer with one or two cases has no entity row, so name
     * search is the only way to reach it.
     *
     * `fiscalYear` is a filter field because search filters are equality
     * only - a date range is not expressible here the way it is on the
     * browse indexes.
     */
    .searchIndex("search_employer", {
      searchField: "employerName",
      filterFields: ["status", "state", "fiscalYear"],
    })
    .searchIndex("search_attorney", {
      searchField: "attorneyName",
      filterFields: ["status", "state", "fiscalYear"],
    }),

  /**
   * What the case browser covers, and the exact counts behind its filters.
   *
   * Counts NEVER come from counting `permCases`. Counting a filtered set
   * means reading it, and a read that walks 50,000 rows to print a number
   * dies at Convex's 4,096-document limit. These are computed by the ingest
   * over EXACTLY the rows it emitted, so a facet total and the rows the
   * browser pages through cannot disagree - they are the same pass.
   *
   * `byState` duplicates `permDisclosureStats.byState` on purpose and is not
   * the same list: that one drops states under 25 cases and carries medians,
   * and a browser that pages through rows the header refuses to count is
   * worse than a small duplication.
   */
  permCasesMeta: defineTable({
    sourceFiles: v.array(v.string()),
    /** Rows emitted, which is the number the browser can actually reach. */
    totalCases: v.number(),
    firstDecisionDate: v.string(),
    lastDecisionDate: v.string(),
    firstReceivedDate: v.string(),
    lastReceivedDate: v.string(),
    byStatus: v.array(
      v.object({
        status: v.union(
          v.literal("certified"),
          v.literal("denied"),
          v.literal("withdrawn"),
        ),
        count: v.number(),
      }),
    ),
    byFiscalYear: v.array(
      v.object({
        fiscalYear: v.string(),
        total: v.number(),
        certified: v.number(),
        denied: v.number(),
        withdrawn: v.number(),
      }),
    ),
    byState: v.array(
      v.object({
        state: v.string(),
        total: v.number(),
        certified: v.number(),
        denied: v.number(),
        withdrawn: v.number(),
      }),
    ),
    computedAt: v.number(),
    contentHash: v.string(),
  }).index("by_computed", ["computedAt"]),

  /**
   * Wage percentile cells for the salary explorer.
   *
   * One row per (partition, key, fiscal year). Three partitions - occupation,
   * state, and occupation-by-state - each emitted per fiscal year and once
   * more pooled as `"all"`.
   *
   * PER YEAR MATTERS once the ingest reaches back five years. Pooling a 2022
   * salary with a 2026 one and publishing the median reports a rate that was
   * never the market rate in any year of it, which is the same defect as
   * averaging a 2016 processing time into a 2026 estimate.
   *
   * A TABLE RATHER THAN A DOCUMENT, and the reason is arithmetic. A cell
   * needs F values to be published and each case lands in exactly one cell,
   * so a partition yields at most N/F cells: at N = 259,489, occupation-by-
   * state at F = 100 can reach 2,594 cells and the three partitions together
   * about 26,000 rows worst case. That is comfortable for a table and far
   * past the 1 MB document limit.
   *
   * Every percentile here is LINEAR INTERPOLATION between closest ranks - the
   * convention `percentile()` in the ingest states and every other figure on
   * the site already uses. Wages are annualised from DOL's amount and
   * unit-of-pay columns before any of this, and values outside the
   * plausibility band are EXCLUDED, not clamped. `permWageMeta` records that
   * policy and how many rows it dropped, because silently excluding outliers
   * and silently keeping them look identical from the outside.
   */
  permWageStats: defineTable({
    kind: v.union(
      v.literal("occupation"),
      v.literal("state"),
      v.literal("occupationState"),
    ),
    /** The partition key. For `occupationState` it is `<soc>|<state>`. */
    key: v.string(),
    /** "" on a state row. */
    socCode: v.string(),
    socTitle: v.string(),
    /** "" on an occupation row. */
    state: v.string(),
    /** A federal fiscal year, or `"all"` for the pooled row. */
    fiscalYear: v.string(),
    count: v.number(),
    p5: v.number(),
    p10: v.number(),
    p25: v.number(),
    p50: v.number(),
    p75: v.number(),
    p90: v.number(),
    p95: v.number(),
    mean: v.number(),
    /** Counts aligned to `permWageMeta.binEdges`, one entry per bin. */
    histogram: v.array(v.number()),
    computedAt: v.number(),
  })
    /** One cell, for a detail view. */
    .index("by_kind_year_key", ["kind", "fiscalYear", "key"])
    /** The busiest cells in a partition and year, for a ranked listing. */
    .index("by_kind_year_count", ["kind", "fiscalYear", "count"]),

  /**
   * The salary explorer's shared axis and its stated policy.
   *
   * One row, replaced each ingest. `binEdges` lives here rather than being
   * hardcoded in a chart so every histogram in `permWageStats` shares one
   * axis and two of them can be laid over each other.
   */
  permWageMeta: defineTable({
    sourceFiles: v.array(v.string()),
    /** Lower bound of each histogram bin. The last bin is open-ended. */
    binEdges: v.array(v.number()),
    /** Minimum cell size before a cell is published, per partition shape. */
    floors: v.object({ single: v.number(), pair: v.number() }),
    policy: v.object({
      /** `exclude-out-of-band`: what happens to an implausible wage. */
      rule: v.string(),
      min: v.number(),
      max: v.number(),
      /** Certified cases carrying a published wage of any kind. */
      considered: v.number(),
      kept: v.number(),
      excluded: v.number(),
      /** `below-band`, `above-band`, `unknown-unit`, `unparseable`, `ok`. */
      excludedByReason: v.array(
        v.object({ reason: v.string(), count: v.number() }),
      ),
      population: v.string(),
      percentileMethod: v.string(),
    }),
    cells: v.number(),
    fiscalYears: v.array(v.string()),
    computedAt: v.number(),
    contentHash: v.string(),
  }).index("by_computed", ["computedAt"]),

  contactMessages: defineTable({
    name: v.string(),
    email: v.string(),
    message: v.string(),
    /** Best-effort caller IP for the per-IP limit; spoofable, cost-raiser only. */
    ip: v.string(),
    createdAt: v.number(),
    /** Set when the forward to support@ actually succeeded. */
    notifiedAt: v.optional(v.number()),
  })
    .index("by_created", ["createdAt"])
    .index("by_ip_created", ["ip", "createdAt"]),
});
