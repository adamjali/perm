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
    userType: v.union(
      v.literal("individual"),
      v.literal("firm_admin"),
      v.literal("firm_member")
    ),
    firmId: v.optional(v.id("users")), // Self-reference for firm hierarchy
    firmName: v.optional(v.string()),

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
      v.literal("deletedCases"), v.literal("firmName"), v.literal("termsVersion"),
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
    .index("by_firm_id", ["firmId"])
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
   * Rows are immutable. A run only inserts when `contentHash` differs from the
   * newest stored row, so re-fetching an unchanged page is a no-op and the
   * series contains one row per genuine publication.
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
    .index("by_perm_as_of", ["permAsOf"])
    .index("by_fetched", ["fetchedAt"])
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
    /** Optional, and the only segmentation we collect. */
    role: v.optional(
      v.union(v.literal("attorney"), v.literal("applicant"), v.literal("employer")),
    ),

    /** Null until the address is confirmed; nothing is ever sent before then. */
    confirmedAt: v.optional(v.number()),
    /** Set once the queue reached their month and we sent the one alert. */
    notifiedAt: v.optional(v.number()),
    /** Set when they opt out. Rows are kept so a later re-subscribe is honest. */
    unsubscribedAt: v.optional(v.number()),

    createdAt: v.number(),
    /** Where the signup happened, so we can see which page actually converts. */
    source: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    // Drives the notify sweep: confirmed, not yet notified, ordered by month.
    .index("by_filing_month", ["filingMonth"])
    .index("by_created", ["createdAt"]),
});
