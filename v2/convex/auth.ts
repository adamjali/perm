import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth, type ConvexAuthConfig } from "@convex-dev/auth/server";
import { GenericId } from "convex/values";
import { ResendOTP } from "./ResendOTP";
import { ResendPasswordReset } from "./ResendPasswordReset";
import { DataModel } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { recordError } from "./lib/errorRecording";
import { validateUserName } from "./lib/nameValidation";
import { requireSignupPass } from "./lib/turnstilePass";

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

/**
 * The auth callbacks. Exported so tests can drive the real hook
 * (convex/__tests__/turnstilePass.test.ts); convexAuth() below uses this object.
 */
export const authCallbacks = {
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

    // A new password account needs the pass from a passed Turnstile check,
    // before it can create a user or link to one. Throws when it's missing,
    // used or expired. The library types ctx over any data model; at run
    // time it is this deployment's.
    await requireSignupPass(ctx as unknown as MutationCtx, args);

    // Check if a user with this email already exists.
    // Normalize before BOTH the lookup and the insert so Google (any casing)
    // matches the normalized stored value and we never create a duplicate.
    const email = args.profile.email?.trim().toLowerCase();
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

    // No existing user found, create a new one.
    // Insert the normalized email so the stored value matches the lookup key.
    const newUserId = await ctx.db.insert("users", {
      name: args.profile.name,
      image: args.profile.image,
      email,
    });

    await onAuthEvent(ctx, newUserId);
    return newUserId;
  },

  // NOTE: afterUserCreatedOrUpdated is intentionally removed.
  // The Convex Auth library skips this callback entirely when createOrUpdateUser
  // is defined (see node_modules/@convex-dev/auth/src/server/implementation/users.ts
  // lines 58-63). All post-auth logic is now in onAuthEvent() called from
  // createOrUpdateUser above.
} satisfies NonNullable<ConvexAuthConfig["callbacks"]>;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Password<DataModel>({
      verify: ResendOTP,
      reset: ResendPasswordReset,
      profile(params) {
        // Server-side name validation — rejects URLs, emojis, excessive length, etc.
        // Throws on violation → Convex Auth surfaces the error to the client
        // WITHOUT creating a user record or firing any emails.
        // See convex/lib/nameValidation.ts for the full rule set.
        //
        // The Turnstile check runs in convex/turnstile.ts (profile() is sync,
        // so it can't call Cloudflare). A passing check returns a one-time
        // pass; the form sends it as `turnstilePass`, it rides the profile to
        // createOrUpdateUser below, which uses it up and refuses a new
        // password account without one. It is never written to the user.
        const validatedName = validateUserName(params.name as string | undefined);
        // Normalize email at the source: the Password provider uses the returned
        // email as the account id, and createOrUpdateUser links accounts by an
        // exact email-index match. Without normalization, "Adam@X.com" (password)
        // and "adam@x.com" (Google) become two accounts, and mixed-case emails
        // dodge the suspension lookup (which lowercases). Lowercase + trim here
        // and in createOrUpdateUser so stored value, account id, and lookup agree.
        return {
          email: (params.email as string).trim().toLowerCase(),
          name: validatedName || undefined,
          ...(typeof params.turnstilePass === "string" ? { turnstilePass: params.turnstilePass } : {}),
        };
      },
      validatePasswordRequirements(password: string | undefined) {
        // Skip validation if password is undefined (happens during reset flow initial step)
        // eslint-disable-next-line security/detect-possible-timing-attacks -- not a secret comparison: this is an existence check (=== undefined) for the reset-flow initial step, no constant-time guarantee needed
        if (password === undefined) return;
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters");
        }
      },
    }),
  ],
  callbacks: authCallbacks,
});
