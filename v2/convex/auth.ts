import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./ResendOTP";
import { ResendPasswordReset } from "./ResendPasswordReset";
import { DataModel, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

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

        return args.existingUserId;
      }

      // Check if a user with this email already exists
      const email = args.profile.email;
      if (email) {
        // Note: Using filter() instead of withIndex() because the auth callback
        // context has limited type information. The "email" index exists on the
        // users table but isn't visible to TypeScript in this callback context.
        const existingUser = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("email"), email))
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

          return existingUser._id;
        }
      }

      // No existing user found, create a new one
      return ctx.db.insert("users", {
        name: args.profile.name,
        image: args.profile.image,
        email: args.profile.email,
        emailVerificationTime: args.profile.emailVerified
          ? Date.now()
          : undefined,
      });
    },

    /**
     * Auto-create user profile after signup/signin (both password and Google OAuth)
     * This ensures the userProfiles table is always populated for authenticated users
     */
    async afterUserCreatedOrUpdated(ctx, { userId }) {
      // Call internal mutation to ensure user profile exists
      // This is idempotent - it does nothing if profile already exists
      await ctx.runMutation(internal.users.ensureUserProfileInternal, {
        userId: userId as Id<"users">,
      });
    },
  },
});
