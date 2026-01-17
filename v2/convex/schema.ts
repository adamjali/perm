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
 * - `refreshTokens` - JWT refresh token rotation
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

export default defineSchema({
  // Spread authTables (includes users, authSessions, authAccounts, etc.)
  ...authTables,

  // Extend users table with minimal auth-related fields
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    phone: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("by_deleted_at", ["deletedAt"]),

  // Separate table for app-specific user data (survives Clerk migration)
  userProfiles: defineTable({
    // 1:1 relationship with users table
    userId: v.id("users"),

    // Legacy migration tracking (temporary - cleared after migration verification)
    // Used during v1→v2 migration for ID resolution
    // Safe to remove these fields after migration is complete and verified
    legacyId: v.optional(v.string()), // Original PostgreSQL UUID from public.users
    legacyAuthId: v.optional(v.string()), // Original PostgreSQL UUID from auth.users

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
    preferredNotificationEmail: v.union(
      v.literal("signup"),
      v.literal("google"),
      v.literal("both")
    ),

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
    privacyModeEnabled: v.optional(v.boolean()), // Hide sensitive info in UI

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
  })
    .index("by_user_id", ["userId"])
    .index("by_firm_id", ["firmId"])
    .index("by_deleted_at", ["deletedAt"])
    // Migration index: lookup by legacy PostgreSQL UUID
    // Used during v1→v2 migration to resolve user references
    // Safe to remove after migration is complete and verified
    .index("by_legacy_id", ["legacyId"]),

  // PERM case tracking
  cases: defineTable({
    // Core identity
    userId: v.id("users"),
    caseNumber: v.optional(v.string()), // DOL case number
    internalCaseNumber: v.optional(v.string()), // Attorney's reference

    // Legacy migration tracking (temporary - cleared after migration verification)
    // Used during v1→v2 migration for ID resolution
    // Safe to remove these fields after migration is complete and verified
    legacyId: v.optional(v.string()), // Original PostgreSQL UUID from cases table
    legacyUserId: v.optional(v.string()), // Original PostgreSQL UUID of the user (for resolution)

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

    // Case status (two-tier system)
    caseStatus: v.union(
      v.literal("pwd"),
      v.literal("recruitment"),
      v.literal("eta9089"),
      v.literal("i140"),
      v.literal("closed")
    ),
    progressStatus: v.union(
      v.literal("working"),
      v.literal("waiting_intake"),
      v.literal("filed"),
      v.literal("approved"),
      v.literal("under_review"),
      v.literal("rfi_rfe")
    ),
    progressStatusOverride: v.optional(v.boolean()),

    // PWD phase
    pwdFilingDate: v.optional(v.string()), // ISO date YYYY-MM-DD
    pwdDeterminationDate: v.optional(v.string()),
    pwdExpirationDate: v.optional(v.string()), // Auto-calculated
    pwdCaseNumber: v.optional(v.string()),
    pwdWageAmount: v.optional(v.number()), // Stored as cents
    pwdWageLevel: v.optional(v.string()),

    // Recruitment - Job Order
    jobOrderStartDate: v.optional(v.string()),
    jobOrderEndDate: v.optional(v.string()),

    // Recruitment - Sunday Ads
    sundayAdFirstDate: v.optional(v.string()),
    sundayAdSecondDate: v.optional(v.string()),
    sundayAdNewspaper: v.optional(v.string()),

    // Recruitment - Additional Methods
    additionalRecruitmentStartDate: v.optional(v.string()),
    additionalRecruitmentEndDate: v.optional(v.string()),
    additionalRecruitmentMethods: v.array(
      v.object({
        method: v.string(),
        date: v.string(),
        description: v.optional(v.string()),
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
    i140Category: v.optional(v.union(v.literal("EB-1"), v.literal("EB-2"), v.literal("EB-3"))),
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
        url: v.string(), // Convex file storage URL
        mimeType: v.string(),
        size: v.number(), // File size in bytes
        uploadedAt: v.number(),
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
    .index("by_user_and_recruitment_window", ["userId", "recruitmentWindowCloses"])
    // Migration indexes: lookup by legacy PostgreSQL UUIDs
    // Used during v1→v2 migration for ID resolution
    // Safe to remove after migration is complete and verified
    .index("by_legacy_id", ["legacyId"])
    .index("by_legacy_user_id", ["legacyUserId"]),

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
        content: v.string(), // Compressed history text
        tokenCount: v.number(), // Approximate tokens in summary
        messageCountAtSummary: v.number(), // Messages when summarized
        lastSummarizedAt: v.number(), // Timestamp of summarization
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

  // Token management for refresh token rotation
  refreshTokens: defineTable({
    userId: v.id("users"),
    token: v.string(), // Hashed token
    expiresAt: v.number(), // Unix timestamp
    revokedAt: v.optional(v.number()),
    revokedReason: v.optional(
      v.union(
        v.literal("rotation"),
        v.literal("logout"),
        v.literal("security"),
        v.literal("expired")
      )
    ),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_token", ["token"])
    .index("by_expires_at", ["expiresAt"]),

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
    filters: v.object({
      status: v.optional(v.union(
        v.literal("pwd"),
        v.literal("recruitment"),
        v.literal("eta9089"),
        v.literal("i140"),
        v.literal("closed")
      )),
      progressStatus: v.optional(v.union(
        v.literal("working"),
        v.literal("waiting_intake"),
        v.literal("filed"),
        v.literal("approved"),
        v.literal("under_review"),
        v.literal("rfi_rfe")
      )),
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
});
