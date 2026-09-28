"use node";

/**
 * Cloudflare Turnstile server-side verification.
 *
 * Called by the sign-up, sign-in and reset forms BEFORE @convex-dev/auth's
 * signIn. If the token doesn't verify, the client refuses to proceed.
 *
 * A passing check also returns a one-time pass, and the sign-up must carry
 * it: the createOrUpdateUser hook in convex/auth.ts refuses a new password
 * account without one (convex/lib/turnstilePass.ts). Without that, a script
 * could skip this action and call signIn directly. The check itself can't
 * run inside the sign-up because Convex Auth's profile() is synchronous and
 * siteverify is a fetch.
 *
 * Also in place:
 *   - convex/lib/nameValidation.ts (blocks the spam name pattern)
 *   - convex/users.ts (welcome + admin emails deferred to post-verify)
 *
 * @module convex/turnstile
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { recordError } from "./lib/errorRecording";
import { hashPass, newPass } from "./lib/turnstilePass";

const VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Cloudflare test keys — always pass/fail. Used in local dev when no real
// key is configured (e.g., first-time onboarding).
const TEST_SECRET_ALWAYS_PASS = "1x0000000000000000000000000000000AA";

export const verifyTurnstileToken = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string; pass?: string }> => {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      // Fail open for local dev with no key; fail closed in production.
      if (process.env.NODE_ENV === "production") {
        // A dropped key in prod hard-blocks ALL signups/resets — a total
        // conversion killer. recordError so it pages instead of hiding in logs.
        console.error("[turnstile] TURNSTILE_SECRET_KEY missing in production");
        await recordError(
          ctx,
          "action",
          "turnstile.missingSecretKeyInProd",
          new Error("TURNSTILE_SECRET_KEY missing in production — all signups/resets blocked"),
        );
        return { success: false, error: "Anti-bot verification unavailable" };
      }
      console.warn("[turnstile] TURNSTILE_SECRET_KEY not set — using test key (dev only)");
    }

    if (!args.token || args.token.trim().length === 0) {
      return { success: false, error: "Missing verification token" };
    }

    const body = new URLSearchParams({
      secret: secret || TEST_SECRET_ALWAYS_PASS,
      response: args.token,
    });

    try {
      const res = await fetch(VERIFY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!res.ok) {
        // Sustained Cloudflare outage → every signup/reset blocked. Make it
        // observable so the fail (hard-block) shows up in the error dashboard.
        console.warn("[turnstile] siteverify HTTP error", res.status);
        await recordError(
          ctx,
          "action",
          "turnstile.siteverifyHttpError",
          new Error(`Turnstile siteverify HTTP ${res.status}`),
        );
        return { success: false, error: "Verification service unavailable" };
      }

      const data = (await res.json()) as {
        success: boolean;
        "error-codes"?: string[];
        action?: string;
        cdata?: string;
      };

      if (!data.success) {
        console.warn("[turnstile] verify failed:", data["error-codes"]);
        return {
          success: false,
          error: "Verification failed. Please refresh the page and try again.",
        };
      }
    } catch (error) {
      // Network throw reaching Cloudflare — same blocking impact, make it visible.
      console.error("[turnstile] siteverify threw:", error);
      await recordError(ctx, "action", "turnstile.siteverifyThrew", error);
      return { success: false, error: "Verification service unreachable" };
    }

    // Passed. The sign-up has to carry this pass; only its hash is stored.
    const pass = newPass();
    await ctx.runMutation(internal.turnstilePasses.issue, { hash: await hashPass(pass) });
    return { success: true, pass };
  },
});
