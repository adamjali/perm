import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { GenericId } from "convex/values";
import { ResendOTP } from "./ResendOTP";
import { ResendPasswordReset } from "./ResendPasswordReset";
import { DataModel } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { recordError } from "./lib/errorRecording";

/**
 * Post-auth hook: ensure user profile exists and record login.
 *
 * IMPORTANT: This logic lives here (not in afterUserCreatedOrUpdated) because
 * the Convex Auth library skips afterUserCreatedOrUpdated when a custom
 * createOrUpdateUser callback is defined. Since we define createOrUpdateUser
 * for email-based account linking, we must call these directly.
 *
 * @see https://labs.convex.dev/auth/api_reference/server — createOrUpdateUser
 * @see node_modules/@convex-dev/auth/src/server/implementation/users.ts
 */
async function onAuthEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  userId: GenericId<"users">,
) {
  // Ensure user profile exists (idempotent — no-op if profile already exists)
  try {
    await ctx.runMutation(internal.users.ensureUserProfileInternal, {
      userId,
    });
  } catch (error) {
    // Log but don't block auth — PendingTermsHandler has a client-side safety net
    console.error(
      `[auth] Failed to ensure user profile for ${userId}:`,
      error instanceof Error ? error.message : error
    );
    await recordError(ctx, "mutation", "auth.createOrUpdateUser.ensureProfile", error, { userId });
  }

  // NOTE: Login tracking is handled client-side via LoginTracker component.
  // The createOrUpdateUser callback only fires for OAuth and new accounts,
  // NOT for password sign-ins of existing users (retrieveAccountWithCredentials
  // bypasses it). Client-side tracking covers all auth flows reliably.
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Password<DataModel>({
      verify: ResendOTP,
      reset: ResendPasswordReset,
      profile(params) {
        return {
          email: params.email as string,
          name: params.name as string | undefined,
        };
      },
      validatePasswordRequirements(password: string | undefined) {
        // Skip validation if password is undefined (happens during reset flow initial step)
        if (password === undefined) return;
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters");
        }
      },
    }),
  ],
  callbacks: {
    /**
     * Custom user creation/update to prevent duplicate accounts.
     *
     * This callback links accounts by verified email address:
     * - If a user with the same email already exists, link to that user
     * - Otherwise create a new user
     *
     * This prevents the issue where signing up with email/password and then
     * signing in with Google OAuth (same email) creates two separate accounts.
     *
     * Both Google OAuth and our Password provider (with OTP verification) are
     * "trusted" providers - they verify email ownership before allowing sign-in.
     *
     * NOTE: afterUserCreatedOrUpdated is NOT called when createOrUpdateUser
     * is defined (library short-circuits). All post-auth logic (profile creation,
     * login tracking) is handled via onAuthEvent() at each return point.
     */
    async createOrUpdateUser(ctx, args) {
      // If there's already an existing user (e.g., returning user), use that
      if (args.existingUserId) {
        // Optionally update user fields from the latest profile data
        const updates: Record<string, unknown> = {};

        if (args.profile.name) {
          updates.name = args.profile.name;
        }
        if (args.profile.image) {
          updates.image = args.profile.image;
        }

        // Only patch if there are updates
        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(args.existingUserId, updates);
        }

        await onAuthEvent(ctx, args.existingUserId);
        return args.existingUserId;
      }

      // Check if a user with this email already exists
      const email = args.profile.email;
      if (email) {
        // Use the "email" index (schema.ts line 62) for O(1) lookup instead of full table scan.
        /* eslint-disable @typescript-eslint/no-explicit-any -- Convex FilterApi can't resolve "email" index */
        const existingUser = await (ctx.db.query("users") as any)
          .withIndex("email", (q: any) => q.eq("email", email))
        /* eslint-enable @typescript-eslint/no-explicit-any */
          .first();

        if (existingUser) {
          // Link to the existing user account
          // Update profile info if available (Google may have newer name/image)
          const updates: Record<string, unknown> = {};

          if (args.profile.name && !existingUser.name) {
            updates.name = args.profile.name;
          }
          if (args.profile.image && !existingUser.image) {
            updates.image = args.profile.image;
          }
          if (Object.keys(updates).length > 0) {
            await ctx.db.patch(existingUser._id, updates);
          }

          await onAuthEvent(ctx, existingUser._id);
          return existingUser._id;
        }
      }

      // No existing user found, create a new one
      const newUserId = await ctx.db.insert("users", {
        name: args.profile.name,
        image: args.profile.image,
        email: args.profile.email,
      });

      await onAuthEvent(ctx, newUserId);
      return newUserId;
    },

    // NOTE: afterUserCreatedOrUpdated is intentionally removed.
    // The Convex Auth library skips this callback entirely when createOrUpdateUser
    // is defined (see node_modules/@convex-dev/auth/src/server/implementation/users.ts
    // lines 58-63). All post-auth logic is now in onAuthEvent() called from
    // createOrUpdateUser above.
  },
});
