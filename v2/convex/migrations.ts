import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * One-time backfill: normalize pre-existing mixed-case emails to lowercase.
 *
 * Why this is needed (and is login-critical, not just cleanup):
 * @convex-dev/auth's Password provider uses the email returned by `profile()`
 * as the account id (`authAccounts.providerAccountId`). We added
 * `.trim().toLowerCase()` in `profile()` (convex/auth.ts) so login lookups
 * lowercase the entered email before matching `providerAccountId`. Any account
 * created BEFORE that change with a mixed-case email can therefore no longer be
 * found at login (Convex index matches are case-sensitive) — the user is locked
 * out. This backfill lowercases the stored `providerAccountId` / `emailVerified`
 * and the `users.email` for those rows so login matches again and the suspension
 * lookup (which also lowercases) lines up.
 *
 * Safety:
 * - Idempotent — re-running is a no-op once every row is already lowercase.
 * - Collision-guarded — refuses to rename a row if a different user already owns
 *   the lowercase email (that needs a real account merge, not a rename); reports
 *   it instead so it can be handled deliberately.
 * - `dryRun: true` returns the planned changes without writing anything.
 *
 * Run (prod):  npx convex run migrations:normalizeMixedCaseEmails '{}' --prod
 * Dry run:     npx convex run migrations:normalizeMixedCaseEmails '{"dryRun":true}' --prod
 */
export const normalizeMixedCaseEmails = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const users = await ctx.db.query("users").collect();

    // Map lowercase email -> owning userId, to detect collisions before renaming.
    const ownerByLowerEmail = new Map<string, string>();
    for (const u of users) {
      if (u.email) ownerByLowerEmail.set(u.email.toLowerCase(), u._id);
    }

    const changes: Array<{
      userId: string;
      from: string;
      to: string;
      accountChanges: Array<{
        accountId: string;
        providerAccountId?: string;
        emailVerified?: string;
      }>;
    }> = [];
    const skipped: Array<{ userId: string; email: string; reason: string }> = [];

    for (const u of users) {
      if (!u.email) continue;
      const lower = u.email.toLowerCase();
      if (u.email === lower) continue; // already normalized

      // Collision guard: a DIFFERENT user already owns the lowercase email.
      const owner = ownerByLowerEmail.get(lower);
      if (owner && owner !== u._id) {
        skipped.push({
          userId: u._id,
          email: u.email,
          reason: `lowercase twin already owned by ${owner} (needs account merge, not rename)`,
        });
        continue;
      }

      if (!dryRun) await ctx.db.patch(u._id, { email: lower });

      // Lowercase this user's auth-account login keys. providerAccountId is the
      // case-sensitive lookup key; emailVerified mirrors the verified address.
      const accounts = await ctx.db
        .query("authAccounts")
        .filter((q) => q.eq(q.field("userId"), u._id))
        .collect();

      const accountChanges: Array<{
        accountId: string;
        providerAccountId?: string;
        emailVerified?: string;
      }> = [];

      for (const a of accounts) {
        const patch: { providerAccountId?: string; emailVerified?: string } = {};
        if (
          a.providerAccountId &&
          a.providerAccountId.includes("@") &&
          a.providerAccountId !== a.providerAccountId.toLowerCase()
        ) {
          patch.providerAccountId = a.providerAccountId.toLowerCase();
        }
        if (
          typeof a.emailVerified === "string" &&
          a.emailVerified.includes("@") &&
          a.emailVerified !== a.emailVerified.toLowerCase()
        ) {
          patch.emailVerified = a.emailVerified.toLowerCase();
        }
        if (patch.providerAccountId !== undefined || patch.emailVerified !== undefined) {
          if (!dryRun) await ctx.db.patch(a._id, patch);
          accountChanges.push({ accountId: a._id, ...patch });
        }
      }

      changes.push({ userId: u._id, from: u.email, to: lower, accountChanges });
    }

    return {
      dryRun,
      usersChanged: changes.length,
      usersSkipped: skipped.length,
      changes,
      skipped,
    };
  },
});
