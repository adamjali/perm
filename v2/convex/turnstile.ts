"use node";

/**
 * Cloudflare Turnstile server-side verification.
 *
 * Called by the signup form BEFORE @convex-dev/auth's signIn. If the token
 * doesn't verify, the client refuses to proceed — no signup attempted.
 *
 * @convex-dev/auth's Password provider profile() callback is strictly
 * synchronous (verified via lib type signature at v0.0.91), so async fetch
 * to Cloudflare's siteverify API can't live there. This pre-flight action
 * is the cleanest alternative — runs in a Node.js action context with full
 * fetch support.
 *
 * Defense in depth (the attack vector was already closed by):
 *   - convex/lib/nameValidation.ts (blocks the spam name pattern)
 *   - convex/users.ts (welcome + admin emails deferred to post-verify)
 *
 * @module convex/turnstile
 */

import { action } from "./_generated/server";
import { v } from "convex/values";

const VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Cloudflare test keys — always pass/fail. Used in local dev when no real
// key is configured (e.g., first-time onboarding).
const TEST_SECRET_ALWAYS_PASS = "1x0000000000000000000000000000000AA";

export const verifyTurnstileToken = action({
  args: {
    token: v.string(),
  },
  handler: async (_ctx, args): Promise<{ success: boolean; error?: string }> => {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      // Fail open for local dev with no key; fail closed in production.
      if (process.env.NODE_ENV === "production") {
        console.error("[turnstile] TURNSTILE_SECRET_KEY missing in production");
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
        console.warn("[turnstile] siteverify HTTP error", res.status);
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

      return { success: true };
    } catch (error) {
      console.error("[turnstile] siteverify threw:", error);
      return { success: false, error: "Verification service unreachable" };
    }
  },
});
