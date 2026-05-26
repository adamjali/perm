import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { recordError } from "./lib/errorRecording";

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
 * - Collision-guarded (BOTH levels):
 *   - User-level: refuses to rename a row if a DIFFERENT user already owns the
 *     lowercase email. Detects collisions across the entire user set up front,
 *     not just from the first writer, so iteration order can't mask one.
 *   - Account-level: refuses to lowercase an authAccounts.providerAccountId if
 *     a DIFFERENT account already exists at (provider, lower(providerAccountId)).
 *     This protects the unique index `providerAndAccountId` from a transactional
 *     rollback mid-batch.
 * - `dryRun: true` returns the planned changes without writing anything.
 * - Errors during patches are recorded via `recordError` and re-thrown so the
 *   single-mutation transaction rolls back as a whole — but operators see the
 *   failure attributed properly.
 * - `take(4096)` caps the user scan at Convex's per-mutation document-read
 *   limit. Sufficient for the current user count; bump or move to a
 *   scheduler-driven pattern (@convex-dev/migrations) when crossing ~4K users.
 *
 * Run (prod):  npx convex run migrations:normalizeMixedCaseEmails '{}' --prod
 * Dry run:     npx convex run migrations:normalizeMixedCaseEmails '{"dryRun":true}' --prod
 */

/** Per-account change emitted by the migration result. */
export type AccountChange = {
  accountId: string;
  providerAccountId?: string;
  emailVerified?: string;
};

/** Public result shape of `normalizeMixedCaseEmails`. */
export type EmailNormalizationResult = {
  dryRun: boolean;
  usersChanged: number;
  usersSkipped: number;
  changes: Array<{
    userId: string;
    from: string;
    to: string;
    accountChanges: AccountChange[];
  }>;
  skipped: Array<{ userId: string; email: string; reason: string }>;
};

export const normalizeMixedCaseEmails = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<EmailNormalizationResult> => {
    const dryRun = args.dryRun ?? false;

    // .take(4096) caps the scan at Convex's per-mutation document-read limit.
    // Current user count is well below this; if we ever cross ~4K users this
    // should move to a cursor-driven scheduler pattern (e.g. @convex-dev/migrations).
    const users = await ctx.db.query("users").take(4096);

    // User-level collision detection: track ALL owners of each lowercase email
    // (not just the last writer) so we never miss a collision across two
    // already-different-case users.
    const ownersByLowerEmail = new Map<string, Set<string>>();
    for (const u of users) {
      if (!u.email) continue;
      const lower = u.email.toLowerCase();
      const owners = ownersByLowerEmail.get(lower) ?? new Set<string>();
      owners.add(u._id);
      ownersByLowerEmail.set(lower, owners);
    }

    // Account-level collision detection: build the (provider, lower(providerAccountId))
    // -> accountId map so we can refuse to rewrite into an existing account.
    // Convex enforces a unique index `providerAndAccountId` on the underlying table,
    // so without this pre-check a real mid-batch rewrite would throw and atomically
    // roll back the entire mutation — leaving the operator with no per-row info.
    const allAccounts = await ctx.db.query("authAccounts").take(4096);
    const accountByProviderLower = new Map<string, string>();
    for (const a of allAccounts) {
      if (!a.providerAccountId.includes("@")) continue;
      const key = `${a.provider}:${a.providerAccountId.toLowerCase()}`;
      // Last write wins is fine here: if there's a same-lowercase collision
      // ALREADY in the table, the index would have rejected it on insert; this
      // map is used to detect WHEN a rewrite would create a duplicate.
      accountByProviderLower.set(key, a._id);
    }

    const changes: EmailNormalizationResult["changes"] = [];
    const skipped: EmailNormalizationResult["skipped"] = [];

    for (const u of users) {
      if (!u.email) continue;
      const lower = u.email.toLowerCase();
      if (u.email === lower) continue; // already normalized

      // Collision guard: any OTHER user owns the lowercase form
      // (size > 1 OR the single owner isn't us).
      const owners = ownersByLowerEmail.get(lower);
      if (owners && (owners.size > 1 || !owners.has(u._id))) {
        skipped.push({
          userId: u._id,
          email: u.email,
          reason: `lowercase email '${lower}' is shared with one or more other users — needs account merge, not rename`,
        });
        continue;
      }

      try {
        if (!dryRun) await ctx.db.patch(u._id, { email: lower });

        // Use the source-verified index name from @convex-dev/auth (cited:
        // node_modules/@convex-dev/auth/src/server/implementation/types.ts:73).
        // This replaces a previous unindexed .filter() that violated the Convex
        // guideline ("Do NOT use filter in queries").
        const accounts = await ctx.db
          .query("authAccounts")
          .withIndex("userIdAndProvider", (q) => q.eq("userId", u._id))
          .collect();

        const accountChanges: AccountChange[] = [];

        for (const a of accounts) {
          const patch: { providerAccountId?: string; emailVerified?: string } = {};

          // Only touch values that look like emails (contain '@'). Some
          // providerAccountId values are OAuth subject IDs (e.g. "google|12345")
          // and must NOT be lowercased — that would change the identifier itself
          // and orphan the auth row from the upstream provider.
          if (
            a.providerAccountId &&
            a.providerAccountId.includes("@") &&
            a.providerAccountId !== a.providerAccountId.toLowerCase()
          ) {
            const targetKey = `${a.provider}:${a.providerAccountId.toLowerCase()}`;
            const existing = accountByProviderLower.get(targetKey);
            if (existing && existing !== a._id) {
              // Account-level collision — refuse rewrite (would violate the
              // providerAndAccountId unique index and roll back the whole mutation).
              skipped.push({
                userId: u._id,
                email: u.email,
                reason: `authAccount(${a._id}) collides with existing account at (${a.provider}, ${a.providerAccountId.toLowerCase()})`,
              });
              continue;
            }
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
      } catch (err) {
        // Per project convention (CLAUDE.md backend error-handling section):
        // record the failure to the system-errors table + admin email + Sentry
        // before re-throwing. The single-mutation transaction will roll back
        // the partial writes; the recordError captures attribution.
        await recordError(
          ctx,
          "mutation",
          "migrations.normalizeMixedCaseEmails",
          err,
          { userId: u._id, extra: `email=${u.email}` },
        );
        throw err;
      }
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
