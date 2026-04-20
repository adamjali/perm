"use client";

/**
 * Cloudflare Turnstile widget for signup form.
 *
 * Deployed April 2026 after the signup-spam attack that used our verified
 * sender reputation to relay phishing. Runs alongside server-side name
 * validation (see convex/lib/nameValidation.ts) and the server-side token
 * verification in convex/auth.ts's profile() callback.
 *
 * Design:
 *   - Matches the neo-brutalist auth aesthetic (2px borders, hard shadow,
 *     JetBrains Mono labels, space grotesk for structural text)
 *   - Auto theme follows prefers-color-scheme via CSS vars (works in both
 *     light + dark without extra config)
 *   - Compact size on mobile, normal on desktop
 *   - Graceful failure: exposes `onError` → parent can render a retry state
 *
 * Uses test keys in dev if live keys aren't configured — unblocks local
 * development without requiring the real Cloudflare account.
 */

import { Turnstile } from "@marsidev/react-turnstile";
import { useEffect, useState } from "react";

// .trim() guards against stray whitespace (e.g., trailing newline from Vercel
// env UI copy-paste) that Cloudflare rejects with "Invalid input for parameter
// sitekey" and renders the widget in an infinite mount/error loop.
const LIVE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
// Cloudflare's "always passes" test site-key — use in local dev when live key is missing
const TEST_SITE_KEY = "1x00000000000000000000AA";

interface SignupTurnstileProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  disabled?: boolean;
}

export function SignupTurnstile({ onVerify, onError, onExpire, disabled }: SignupTurnstileProps) {
  const siteKey = LIVE_SITE_KEY || TEST_SITE_KEY;

  // Track theme from the document.documentElement class (matches how the app
  // toggles dark mode via existing CSS vars).
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setTheme(root.classList.contains("dark") ? "dark" : "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  if (!LIVE_SITE_KEY && process.env.NODE_ENV === "production") {
    // Prod MUST have a real key — log loud error but don't block the user
    console.error("[Turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY missing in production");
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
          appearance: "always",
          retry: "auto",
          refreshExpired: "auto",
          action: "signup",
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
