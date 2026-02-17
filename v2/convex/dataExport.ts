/**
 * Full Account Data Export (DSAR — Data Subject Access Request)
 *
 * Exports all user data as structured JSON for SOC 2 Privacy compliance.
 * Includes: profile, cases, conversations, notifications, audit logs.
 *
 * SOC 2 P4 — Privacy: Right to access personal data.
 */

import { query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { getCurrentUserId } from "./lib/auth";
import { decryptToken, isEncryptedToken } from "./lib/crypto";

/**
 * Decrypt FEIN for export (handles legacy plaintext gracefully)
 */
async function decryptFeinForExport(fein: string | undefined): Promise<string | undefined> {
  if (!fein) return undefined;
  if (!isEncryptedToken(fein)) return fein;
  try {
    return await decryptToken(fein);
  } catch {
    return fein;
  }
}

/**
 * Get all account data for the current user (DSAR export).
 *
 * Returns a structured JSON object containing all user data:
 * - User record and profile
 * - All cases (with decrypted FEINs)
 * - All conversations and messages
 * - All notifications
 * - Audit log entries for this user
 */
export const getFullAccountData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);

    // User record
    const user = await ctx.db.get(userId);

    // User profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    // All cases (non-deleted)
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
    const activeCases = cases.filter((c) => c.deletedAt === undefined);

    // Decrypt FEINs for export
    const casesWithDecryptedFein = await Promise.all(
      activeCases.map(async (c) => ({
        ...c,
        employerFein: await decryptFeinForExport(c.employerFein),
      }))
    );

    // All conversations
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    // All messages for all conversations
    const messages: Doc<"conversationMessages">[] = [];
    for (const conv of conversations) {
      const convMessages = await ctx.db
        .query("conversationMessages")
        .withIndex("by_conversation_id", (q) =>
          q.eq("conversationId", conv._id)
        )
        .collect();
      messages.push(...convMessages);
    }

    // All notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    // Audit logs for this user
    const auditLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    return {
      exportVersion: "1.0",
      exportDate: new Date().toISOString(),
      user: user
        ? {
            id: user._id,
            email: user.email,
            name: user.name,
            createdAt: user._creationTime,
          }
        : null,
      profile: profile
        ? {
            ...profile,
            // Redact sensitive tokens from export
            googleAccessToken: profile.googleAccessToken ? "[REDACTED]" : undefined,
            googleRefreshToken: profile.googleRefreshToken ? "[REDACTED]" : undefined,
            pushSubscription: profile.pushSubscription ? "[REDACTED]" : undefined,
          }
        : null,
      cases: casesWithDecryptedFein,
      conversations: conversations.map((c) => ({
        ...c,
        messages: messages
          .filter((m) => m.conversationId === c._id)
          .sort((a, b) => a.createdAt - b.createdAt),
      })),
      notifications,
      auditLogs,
    };
  },
});
