"use client";

/**
 * Cloudflare Turnstile widget, reusable across auth surfaces.
 *
 * Deployed April 2026 after the signup-spam attack that used our verified
 * sender reputation to relay phishing. Runs alongside server-side name
 * validation (see convex/lib/nameValidation.ts) and the server-side token
 * verification in convex/turnstile.ts.
 *
 * Three callsites:
 *   - signup         → appearance="always" (visible deterrent)
 *   - reset-password → appearance="always" (same abuse profile as signup)
 *   - login          → appearance="interaction-only" (invisible for most
 *                      real users; shows only when Cloudflare's risk
 *                      analysis flags the attempt)
 *
 * Design:
 *   - Matches neo-brutalist auth aesthetic (2px borders, hard shadows)
 *   - Auto theme follows document.documentElement.classList ("dark")
 *   - Compact flexible size
 *   - Graceful failure: exposes `onError` → parent can render retry state
 *
 * Uses Cloudflare test keys in dev if live key isn't configured, so local
 * development works without a real Cloudflare account.
 */

import { Turnstile } from "@marsidev/react-turnstile";
import { useEffect, useState } from "react";

// .trim() guards against stray whitespace (e.g., trailing newline from Vercel
// env UI copy-paste) that Cloudflare rejects with "Invalid input for parameter
// sitekey" and renders the widget in an infinite mount/error loop.
const LIVE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
// Cloudflare's "always passes" test site-key — use in local dev when live key is missing.
const TEST_SITE_KEY = "1x00000000000000000000AA";

export type TurnstileAppearance = "always" | "interaction-only";

interface AuthTurnstileProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  disabled?: boolean;
  /** "signup" | "login" | "password-reset" — surface tag for analytics. */
  action?: string;
  /** Widget visibility. Default "always" (visible). */
  appearance?: TurnstileAppearance;
}

export function AuthTurnstile({
  onVerify,
  onError,
  onExpire,
  disabled,
  action = "signup",
  appearance = "always",
}: AuthTurnstileProps) {
  const siteKey = LIVE_SITE_KEY || TEST_SITE_KEY;

  // Track theme from the document.documentElement class (matches how the app
  // toggles dark mode via existing CSS vars).
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const root = document.documentElement;
    const update = () =>
      setTheme(root.classList.contains("dark") ? "dark" : "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  if (!LIVE_SITE_KEY && process.env.NODE_ENV === "production") {
    // Prod MUST have a real key — log loud error but don't block the user
    console.error(
      "[Turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY missing in production",
    );
  }

  return (
    <div
      className="flex justify-center"
      data-testid="turnstile-widget"
      aria-label="Anti-spam verification"
    >
      <Turnstile
        siteKey={siteKey}
        options={{
          theme,
          size: "flexible",
          appearance,
          retry: "auto",
          refreshExpired: "auto",
          action,
        }}
        onSuccess={(token) => {
          if (!disabled) onVerify(token);
        }}
        onError={() => {
          console.warn("[Turnstile] verification error");
          onError?.();
        }}
        onExpire={() => {
          console.warn("[Turnstile] token expired");
          onExpire?.();
        }}
      />
    </div>
  );
}
