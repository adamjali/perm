/**
 * Dashboard Queries
 *
 * Provides 4 main queries for the dashboard:
 * 1. getDeadlines - Get all deadlines grouped by urgency
 * 2. getSummary - Get case counts by status with subtexts
 * 3. getRecentActivity - Get last 5 updated cases
 * 4. getUpcomingDeadlines - Get upcoming deadlines for next N days
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getCurrentUserIdOrNull } from "./lib/auth";
import {
  extractDeadlines,
  groupDeadlinesByUrgency,
  createDeadlineItem,
  buildPwdSubtext,
  mapDeadlineType,
} from "./lib/dashboardHelpers";
import { dateToISODate } from "./lib/dateTypes";
import { loggers } from "./lib/logging";

const log = loggers.dashboard;
import type {
  DeadlineItem,
  RecentActivityItem,
  CaseStatus,
  ProgressStatus,
  PwdBreakdown,
} from "./lib/dashboardTypes";

/**
 * Get all deadlines grouped by urgency
 * Returns deadlines from active (non-closed, non-deleted) cases
 *
 * NOTE: This query loads all cases to extract deadlines. For users with
 * very large case counts (1000+), consider implementing server-side
 * deadline extraction with indexed deadline dates.
 */
export const getDeadlines = query({
  args: {},
  handler: async (ctx) => {
    // Use null-safe auth check to gracefully handle sign-out transitions
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      // Return empty result during sign-out or unauthenticated state
      return {
        overdue: [],
        thisWeek: [],
        thisMonth: [],
        later: [],
      };
    }

    // Fetch non-deleted cases for user with reasonable limit
    // Most users have <100 cases, limit prevents unbounded growth
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .take(1000);

    // Filter out closed cases
    const activeCases = cases.filter((c) => c.caseStatus !== "closed");

    // Extract deadlines from all active cases
    const todayISO = dateToISODate(new Date());
    const allDeadlines: DeadlineItem[] = [];

    for (const caseDoc of activeCases) {
      try {
        const partialDeadlines = extractDeadlines(caseDoc, todayISO);

        // Build full DeadlineItem objects from extracted deadlines
        for (const extracted of partialDeadlines) {
          const deadline = createDeadlineItem({
            caseId: caseDoc._id,
            caseNumber: caseDoc.caseNumber,
            employerName: caseDoc.employerName,
            beneficiaryName: caseDoc.beneficiaryIdentifier,
            type: mapDeadlineType(extracted.type, extracted.daysUntil),
            label: extracted.label,
            dueDate: extracted.date,
            daysUntil: extracted.daysUntil,
            caseStatus: caseDoc.caseStatus as CaseStatus,
            progressStatus: caseDoc.progressStatus as ProgressStatus,
          });

          allDeadlines.push(deadline);
        }
      } catch (error) {
        // Log error but continue processing other cases - don't fail entire query
        log.error('Failed to extract deadlines for case', {
          resourceId: caseDoc._id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Group by urgency and sort
    const groups = groupDeadlinesByUrgency(allDeadlines);

    // Return without totalCount (tests expect just the 4 arrays)
    return {
      overdue: groups.overdue,
      thisWeek: groups.thisWeek,
      thisMonth: groups.thisMonth,
      later: groups.later,
    };
  },
});

/**
 * Get case counts by status with subtexts
 * Returns summary of cases grouped by caseStatus with progress breakdowns
 *
 * OPTIMIZED (Phase 2.2): Single-pass aggregation instead of 20+ filter() calls
 */
export const getSummary = query({
  args: {},
  handler: async (ctx) => {
    // Use null-safe auth check to gracefully handle sign-out transitions
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      // Return empty result during sign-out or unauthenticated state
      return {
        pwd: { count: 0, subtext: "" },
        recruitment: { count: 0, subtext: "" },
        eta9089: { count: 0, subtext: "" },
        i140: { count: 0, subtext: "" },
        complete: { count: 0, subtext: "" },
        closed: { count: 0, subtext: "" },
        duplicates: { count: 0, subtext: "" },
      };
    }

    // Fetch non-deleted cases for user with reasonable limit
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .take(1000);

    // SINGLE-PASS AGGREGATION: Count all breakdowns in one loop
    // This replaces 20+ sequential filter() calls with O(n) complexity
    const counts = {
      // PWD breakdowns
      pwd: { total: 0, working: 0, filed: 0 },
      // Recruitment breakdowns
      recruitment: { total: 0, readyToStart: 0, inProgress: 0 },
      // ETA 9089 breakdowns
      eta9089: { total: 0, prep: 0, rfi: 0, filed: 0 },
      // I-140 breakdowns (excluding approved)
      i140: { total: 0, prep: 0, rfe: 0, filed: 0 },
      // Complete (I-140 approved)
      complete: 0,
      // Closed/archived
      closed: 0,
      // Duplicates (cases marked as duplicates)
      duplicates: 0,
    };

    for (const c of cases) {
      const status = c.caseStatus;
      const progress = c.progressStatus;

      switch (status) {
        case "pwd":
          counts.pwd.total++;
          // working = working | waiting_intake | under_review
          if (progress === "working" || progress === "waiting_intake" || progress === "under_review") {
            counts.pwd.working++;
          }
          // filed = filed | approved
          if (progress === "filed" || progress === "approved") {
            counts.pwd.filed++;
          }
          break;

        case "recruitment":
          counts.recruitment.total++;
          // readyToStart = working | waiting_intake
          if (progress === "working" || progress === "waiting_intake") {
            counts.recruitment.readyToStart++;
          }
          // inProgress = filed | approved | under_review
          if (progress === "filed" || progress === "approved" || progress === "under_review") {
            counts.recruitment.inProgress++;
          }
          break;

        case "eta9089":
          counts.eta9089.total++;
          // prep = working | waiting_intake | under_review
          if (progress === "working" || progress === "waiting_intake" || progress === "under_review") {
            counts.eta9089.prep++;
          }
          // rfi = rfi_rfe
          if (progress === "rfi_rfe") {
            counts.eta9089.rfi++;
          }
          // filed = filed | approved
          if (progress === "filed" || progress === "approved") {
            counts.eta9089.filed++;
          }
          break;

        case "i140":
          if (progress === "approved") {
            // I-140 approved = Complete
            counts.complete++;
          } else {
            // I-140 not approved = in I-140 stage
            counts.i140.total++;
            // prep = working | waiting_intake | under_review
            if (progress === "working" || progress === "waiting_intake" || progress === "under_review") {
              counts.i140.prep++;
            }
            // rfe = rfi_rfe
            if (progress === "rfi_rfe") {
              counts.i140.rfe++;
            }
            // filed = filed
            if (progress === "filed") {
              counts.i140.filed++;
            }
          }
          break;

        case "closed":
          counts.closed++;
          break;
      }

      // Count duplicates (across all statuses)
      if (c.duplicateOf !== undefined) {
        counts.duplicates++;
      }
    }

    // Build subtexts from counts
    const pwdBreakdown: PwdBreakdown = {
      working: counts.pwd.working,
      filed: counts.pwd.filed,
    };
    const pwdSubtext = buildPwdSubtext(pwdBreakdown) || "0 working";

    // Recruitment subtext
    const recruitmentParts: string[] = [];
    if (counts.recruitment.readyToStart > 0) recruitmentParts.push(`${counts.recruitment.readyToStart} ready to start`);
    if (counts.recruitment.inProgress > 0) recruitmentParts.push(`${counts.recruitment.inProgress} in progress`);
    const recruitmentSubtext = recruitmentParts.join(", ") || "0 ready to start";

    // ETA 9089 subtext
    const eta9089Parts: string[] = [];
    if (counts.eta9089.prep > 0) eta9089Parts.push(`${counts.eta9089.prep} prep`);
    if (counts.eta9089.rfi > 0) eta9089Parts.push(`${counts.eta9089.rfi} RFI`);
    if (counts.eta9089.filed > 0) eta9089Parts.push(`${counts.eta9089.filed} filed`);
    const eta9089Subtext = eta9089Parts.join(", ") || "0 prep";

    // I-140 subtext
    const i140Parts: string[] = [];
    if (counts.i140.prep > 0) i140Parts.push(`${counts.i140.prep} prep`);
    if (counts.i140.rfe > 0) i140Parts.push(`${counts.i140.rfe} RFE`);
    if (counts.i140.filed > 0) i140Parts.push(`${counts.i140.filed} filed`);
    const i140Subtext = i140Parts.join(", ") || "0 prep";

    // Calculate progress percentages
    const pwdProgress = counts.pwd.total > 0
      ? Math.round((counts.pwd.filed / counts.pwd.total) * 100)
      : 0;
    const recruitmentProgress = counts.recruitment.total > 0
      ? Math.round((counts.recruitment.inProgress / counts.recruitment.total) * 100)
      : 0;
    const eta9089Progress = counts.eta9089.total > 0
      ? Math.round((counts.eta9089.filed / counts.eta9089.total) * 100)
      : 0;
    const i140Progress = counts.i140.total > 0
      ? Math.round((counts.i140.filed / counts.i140.total) * 100)
      : 0;

    return {
      pwd: {
        count: counts.pwd.total,
        subtext: pwdSubtext,
        progress: pwdProgress,
      },
      recruitment: {
        count: counts.recruitment.total,
        subtext: recruitmentSubtext,
        progress: recruitmentProgress,
      },
      eta9089: {
        count: counts.eta9089.total,
        subtext: eta9089Subtext,
        progress: eta9089Progress,
      },
      i140: {
        count: counts.i140.total,
        subtext: i140Subtext,
        progress: i140Progress,
      },
      complete: {
        count: counts.complete,
        subtext: "I-140 Approved",
        progress: 100,
      },
      closed: {
        count: counts.closed,
        subtext: "Archived",
        progress: 100,
      },
      duplicates: {
        count: counts.duplicates,
        subtext: "Marked as duplicate",
        progress: 0, // No progress concept for duplicates
      },
    };
  },
});

/**
 * Get last 5 updated cases
 * Returns most recently updated cases (non-deleted only)
 * OPTIMIZED: Uses by_user_and_updated_at index instead of collecting all cases
 */
export const getRecentActivity = query({
  args: {},
  handler: async (ctx): Promise<RecentActivityItem[]> => {
    // Use null-safe auth check to gracefully handle sign-out transitions
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return [];
    }

    // OPTIMIZED: Use index-based ordering and take only what we need
    // Take more than 5 to account for deleted cases that will be filtered out
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_and_updated_at", (q) => q.eq("userId", userId as Id<"users">))
      .order("desc")
      .take(20); // Take extra to account for deletions

    // Filter out deleted cases and take first 5
    const recentCases = cases
      .filter((c) => c.deletedAt === undefined)
      .slice(0, 5);

    // Build RecentActivityItem array
    return recentCases.map((c) => ({
      id: c._id,
      caseNumber: c.caseNumber,
      employerName: c.employerName,
      beneficiaryIdentifier: c.beneficiaryIdentifier, // Use beneficiaryIdentifier not beneficiaryName
      action: "Updated", // Generic action for now
      timestamp: c.updatedAt ?? c._creationTime,
      caseStatus: c.caseStatus,
      progressStatus: c.progressStatus,
    }));
  },
});

/**
 * Get upcoming deadlines for next N days
 * Includes overdue deadlines (negative daysUntil)
 */
export const getUpcomingDeadlines = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Use null-safe auth check to gracefully handle sign-out transitions
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return [];
    }
    // Validate and clamp days to reasonable range (1-365)
    const daysAhead = Math.max(1, Math.min(args.days ?? 30, 365));

    // Fetch non-deleted cases for user with reasonable limit
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .take(1000);

    // Filter out closed cases
    const activeCases = cases.filter((c) => c.caseStatus !== "closed");

    // Extract deadlines from all active cases
    const todayISO = dateToISODate(new Date());
    const allDeadlines: DeadlineItem[] = [];

    for (const caseDoc of activeCases) {
      try {
        const partialDeadlines = extractDeadlines(caseDoc, todayISO);

        // Build full DeadlineItem objects from extracted deadlines
        for (const extracted of partialDeadlines) {
          const deadline = createDeadlineItem({
            caseId: caseDoc._id,
            caseNumber: caseDoc.caseNumber,
            employerName: caseDoc.employerName,
            beneficiaryName: caseDoc.beneficiaryIdentifier,
            type: mapDeadlineType(extracted.type, extracted.daysUntil),
            label: extracted.label,
            dueDate: extracted.date,
            daysUntil: extracted.daysUntil,
            caseStatus: caseDoc.caseStatus as CaseStatus,
            progressStatus: caseDoc.progressStatus as ProgressStatus,
          });

          allDeadlines.push(deadline);
        }
      } catch (error) {
        // Log error but continue processing other cases - don't fail entire query
        log.error('Failed to extract upcoming deadlines for case', {
          resourceId: caseDoc._id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Filter to deadlines within N days (includes overdue)
    const upcomingDeadlines = allDeadlines.filter(
      (d) => d.daysUntil <= daysAhead
    );

    // Sort by daysUntil ascending (most urgent first)
    return upcomingDeadlines.sort((a, b) => a.daysUntil - b.daysUntil);
  },
});
