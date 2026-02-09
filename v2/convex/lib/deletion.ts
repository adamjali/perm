/**
 * Centralized User Data Deletion
 *
 * Single source of truth for purging all user data.
 * Used by both admin deletion and user-initiated account deletion.
 *
 * @module
 */

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

interface PurgeResult {
  cases: number;
  notifications: number;
  conversations: number;
  auditLogs: number;
  caseOrders: number;
  timelinePrefs: number;
  templates: number;
  authAccounts: number;
  authSessions: number;
  authRefreshTokens: number;
  authVerificationCodes: number;
  profileDeleted: boolean;
  userDeleted: boolean;
}

/**
 * Purge ALL data for a user. Deletes everything:
 * cases, notifications, conversations (+ messages + tool cache),
 * audit logs, case order, timeline prefs, job description templates,
 * user profile, auth accounts (+ verification codes),
 * auth sessions (+ refresh tokens), and the user record itself.
 *
 * This is the single source of truth for user deletion.
 * Both `deleteUserAdmin` and `permanentlyDeleteAccount` call this.
 */
export async function purgeAllUserData(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<PurgeResult> {
  // Delete all user's cases
  const cases = await ctx.db
    .query("cases")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  for (const caseDoc of cases) {
    await ctx.db.delete(caseDoc._id);
  }

  // Delete all user's notifications
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  for (const notif of notifications) {
    await ctx.db.delete(notif._id);
  }

  // Delete conversations, messages, and tool cache
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
      await ctx.db.delete(msg._id);
    }

    const cacheEntries = await ctx.db
      .query("toolCache")
      .withIndex("by_conversation_tool_hash", (q) => q.eq("conversationId", conv._id))
      .collect();
    for (const entry of cacheEntries) {
      await ctx.db.delete(entry._id);
    }

    await ctx.db.delete(conv._id);
  }

  // Delete audit logs
  const auditLogs = await ctx.db
    .query("auditLogs")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  for (const logEntry of auditLogs) {
    await ctx.db.delete(logEntry._id);
  }

  // Delete custom case order
  const caseOrders = await ctx.db
    .query("userCaseOrder")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  for (const order of caseOrders) {
    await ctx.db.delete(order._id);
  }

  // Delete timeline preferences
  const timelinePrefs = await ctx.db
    .query("timelinePreferences")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  for (const pref of timelinePrefs) {
    await ctx.db.delete(pref._id);
  }

  // Delete job description templates
  const templates = await ctx.db
    .query("jobDescriptionTemplates")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  for (const template of templates) {
    await ctx.db.delete(template._id);
  }

  // Delete user profile (use collect to handle any duplicates)
  const profiles = await ctx.db
    .query("userProfiles")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  for (const profile of profiles) {
    await ctx.db.delete(profile._id);
  }

  // Delete auth accounts and their child verification codes
  const authAccounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();
  let authVerificationCodesCount = 0;
  for (const account of authAccounts) {
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .collect();
    for (const code of codes) {
      await ctx.db.delete(code._id);
    }
    authVerificationCodesCount += codes.length;
    await ctx.db.delete(account._id);
  }

  // Delete auth sessions and their child refresh tokens
  const authSessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();
  let authRefreshTokensCount = 0;
  for (const session of authSessions) {
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of tokens) {
      await ctx.db.delete(token._id);
    }
    authRefreshTokensCount += tokens.length;
    await ctx.db.delete(session._id);
  }

  // Finally delete the user record itself
  await ctx.db.delete(userId);

  return {
    cases: cases.length,
    notifications: notifications.length,
    conversations: conversations.length,
    auditLogs: auditLogs.length,
    caseOrders: caseOrders.length,
    timelinePrefs: timelinePrefs.length,
    templates: templates.length,
    authAccounts: authAccounts.length,
    authSessions: authSessions.length,
    authRefreshTokens: authRefreshTokensCount,
    authVerificationCodes: authVerificationCodesCount,
    profileDeleted: profiles.length > 0,
    userDeleted: true,
  };
}
