"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useMutation, useConvex } from "convex/react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { NavLink } from "@/components/ui/nav-link";
import { toast } from "@/lib/toast";
import { captureError } from "@/lib/sentry";
import { handleStaleDeployment } from "@/components/error/auth-error";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { AuthField } from "@/components/auth/AuthField";
import { AuthTurnstile } from "@/components/auth/AuthTurnstile";
import { validateEmailValue, fieldMessage } from "@/lib/auth/signup-validation";
import {
  isNetworkError,
  isRateLimitError,
  isInvalidCodeError,
  isExpiredError,
} from "@/lib/auth/auth-errors";
import {
  trackTurnstileFail,
  trackLoginSucceeded,
  trackLoginFailed,
  trackAbuseEvent,
  captureTurnstileServiceError,
  authBreadcrumb,
} from "@/lib/auth/auth-telemetry";

type LoginStep = "login" | "verification";

export function LoginPageClient() {
  const { signIn } = useAuthActions();
  const convex = useConvex();
  const recordMyLogin = useMutation(api.users.recordMyLogin);
  const checkRateLimit = useMutation(api.authRateLimit.checkAuthRateLimit);
  const clearRateLimitMut = useMutation(api.authRateLimit.clearAuthRateLimit);
  const verifyTurnstile = useAction(api.turnstile.verifyTurnstileToken);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeSignOut } = useAuthContext();
  const [step, setStep] = useState<LoginStep>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showExpiredBanner, setShowExpiredBanner] = useState(false);

  // Interaction-only Turnstile: widget is invisible for low-risk users and
  // emits a token silently. A challenge appears only if Cloudflare's ML
  // flags the attempt. Token may be null briefly at mount.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const emailValidation = validateEmailValue(email, emailTouched);
  const emailInvalid = emailValidation.state === "invalid";
  const canSubmit = emailValidation.state === "valid" && password.length > 0 && !isLoading && !isGoogleLoading;

  const submitLabel = useMemo(() => {
    if (isLoading) return "SIGNING IN...";
    if (emailValidation.state !== "valid") return "ENTER YOUR EMAIL";
    if (!password) return "ENTER YOUR PASSWORD";
    return "SIGN IN";
  }, [isLoading, emailValidation.state, password]);

  const enforceRateLimit = useCallback(
    async (emailValue: string, action: "login" | "otp_verify") => {
      try {
        const result = await checkRateLimit({ email: emailValue, action });
        if (!result.allowed) {
          toast.error(result.message || "Too many attempts. Please wait and try again.");
          return false;
        }
        return true;
      } catch (error) {
        // Fail open for availability, but log for observability
        captureError(error, { operation: "enforceRateLimit" });
        return true;
      }
    },
    [checkRateLimit],
  );

  // Reset signing-out state when arriving at login (after sign-out completes)
  useEffect(() => {
    completeSignOut();
  }, [completeSignOut]);

  // Show session-expired banner when redirected from auth error
  useEffect(() => {
    if (searchParams.get("expired") === "1") {
      setShowExpiredBanner(true);
      window.history.replaceState({}, "", "/login");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    authBreadcrumb("login_submit_attempt");

    if (!canSubmit) {
      setEmailTouched(true);
      return;
    }

    setIsLoading(true);

    try {
      // Pre-flight rate limit check
      if (!(await enforceRateLimit(email, "login"))) {
        trackAbuseEvent("rate_limit_429", { surface: "login" });
        setIsLoading(false);
        return;
      }

      // Suspension gate — if this account was auto-suspended by abuse
      // detection, block login with a friendly locked message instead of
      // letting Convex Auth return a generic credential error.
      try {
        const suspension = await convex.query(
          api.abuseDetection.checkEmailSuspension,
          { email },
        );
        if (suspension.suspended) {
          trackAbuseEvent("suspended_login_blocked", {
            reason: suspension.reason ?? "unknown",
          });
          toast.error(
            "This account is temporarily locked due to unusual activity. Contact support@permtracker.app to appeal.",
          );
          setIsLoading(false);
          return;
        }
      } catch (suspensionError) {
        // Fail open — availability trumps strict enforcement here; the
        // per-email rate limit still protects from brute force.
        console.warn("[Login] suspension check failed:", suspensionError);
      }

      // Interaction-only Turnstile: if Cloudflare decided no challenge was
      // needed, token may be missing — that’s a legitimate low-risk user,
      // proceed without pre-flight verification. If a token IS present, we
      // verify it server-side (catches bot-mimic + replay attempts).
      if (turnstileToken) {
        try {
          const verifyResult = await verifyTurnstile({ token: turnstileToken });
          if (!verifyResult.success) {
            trackTurnstileFail("login", "siteverify_rejected");
            setTurnstileToken(null);
            toast.error(verifyResult.error || "Security check failed. Please try again.");
            setIsLoading(false);
            return;
          }
          authBreadcrumb("login_turnstile_verified");
        } catch (verifyError) {
          captureTurnstileServiceError(verifyError, "login");
          trackTurnstileFail("login", "service_error");
          // Fail open — login shouldn’t be blocked by a Cloudflare outage.
          console.warn("[Login] Turnstile verify threw; proceeding without check");
        }
      }

      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", password);
      formData.set("flow", "signIn");

      const result = await signIn("password", formData);
      authBreadcrumb("login_signin_completed");

      if (result.signingIn) {
        clearRateLimitMut({ email, action: "login" }).catch((err) =>
          console.warn("[clearRateLimit] failed:", err),
        );
        localStorage.setItem("perm_last_login_at", String(Date.now()));
        recordMyLogin().catch((err) => console.warn("[recordMyLogin] failed:", err));
        trackLoginSucceeded("email_password");
        router.push("/dashboard");
      } else {
        // Email not verified — provider re-sent a verification code
        setStep("verification");
        trackLoginFailed("unverified_email");
        toast.info("Your email isn’t verified yet. We’ve sent a new verification code.");
      }
    } catch (error) {
      if (handleStaleDeployment(error)) return;

      const message = error instanceof Error ? error.message : String(error);

      // Only report unexpected errors to Sentry — invalid-credentials is
      // wrapped by Convex Auth as "[Request ID: xxx] Server Error" which
      // is normal login failure, not a real server bug.
      if (isRateLimitError(message) || isNetworkError(message)) {
        captureError(error, { operation: "signIn" });
      }

      if (isRateLimitError(message)) {
        trackLoginFailed("rate_limited");
        trackAbuseEvent("rate_limit_429", { surface: "login", source: "signIn" });
        toast.error("Too many attempts. Please wait a moment and try again.");
      } else if (isNetworkError(message)) {
        trackLoginFailed("network");
        toast.error("Network error. Please check your connection and try again.");
      } else {
        trackLoginFailed("invalid_credentials");
        toast.error(
          "Invalid email or password. If you signed up with Google, use the Google sign-in button.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);

      if (!(await enforceRateLimit(email, "otp_verify"))) {
        setIsLoading(false);
        return;
      }

      await signIn("password", formData);

      toast.success("Email verified. Signing you in.");
      localStorage.setItem("perm_last_login_at", String(Date.now()));
      recordMyLogin().catch((err) => console.warn("[recordMyLogin] failed:", err));
      trackLoginSucceeded("email_password");
      router.push("/dashboard");
    } catch (error) {
      if (handleStaleDeployment(error)) return;

      const message = error instanceof Error ? error.message : String(error);
      captureError(error, { operation: "signInVerification" });

      if (isExpiredError(message)) {
        toast.error("Verification code expired. Go back and sign in again to get a new code.");
      } else if (isInvalidCodeError(message)) {
        toast.error("Invalid verification code. Please check and try again.");
      } else if (isRateLimitError(message)) {
        toast.error("Too many attempts. Please wait a moment and try again.");
      } else if (isNetworkError(message)) {
        toast.error("Network error. Please check your connection and try again.");
      } else {
        console.warn("[Login Verification] Unhandled error type:", message);
        toast.error("Verification failed. Please try again or contact support.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    authBreadcrumb("login_google_initiated");
    try {
      await signIn("google", { redirectTo: "/dashboard" });
    } catch (error) {
      if (handleStaleDeployment(error)) return;

      const message = error instanceof Error ? error.message : String(error);
      captureError(error, { operation: "googleSignIn" });

      if (/popup|closed/i.test(message)) {
        toast.error("Sign in was cancelled. Please try again.");
      } else if (isNetworkError(message)) {
        toast.error("Network error. Please check your connection and try again.");
      } else {
        console.warn("[Google Sign In] Unhandled error type:", message);
        toast.error("Failed to sign in with Google. Please try again or contact support.");
      }
      setIsGoogleLoading(false);
    }
  };

  if (step === "verification") {
    return (
      <Card className="hover:translate-y-0 hover:shadow-hard active:translate-y-0 active:shadow-hard">
        <CardHeader>
          <h1 className="font-heading text-3xl font-black uppercase leading-none tracking-tight sm:text-4xl">
            Verify Email
          </h1>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-base leading-relaxed text-foreground/70">
            Your email hasn&apos;t been verified yet. We&apos;ve sent a 12-character
            verification code to{" "}
            <span className="font-semibold text-foreground">{email}</span>
          </p>

          <form onSubmit={handleVerificationSubmit} className="space-y-5">
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="flow" value="email-verification" />

            <div className="space-y-2">
              <Label htmlFor="code" className="text-xs uppercase mono font-bold tracking-widest">
                Verification Code
              </Label>
              <Input
                id="code"
                name="code"
                type="text"
                placeholder="XXXXXXXXXXXX"
                maxLength={12}
                required
                disabled={isLoading}
                className="mono text-lg tracking-wider text-center uppercase"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              loading={isLoading}
              loadingText="VERIFYING..."
            >
              VERIFY EMAIL
            </Button>
          </form>

          <div className="pt-4 text-center border-t-2 border-border">
            <button
              onClick={() => setStep("login")}
              className="text-sm font-bold hover:text-primary hover:underline hover:underline-offset-4 transition-colors"
            >
              &larr; Back to sign in
            </button>
            <p className="mt-2 text-sm text-muted-foreground">
              Didn&apos;t get the code? Go back and sign in again to resend it.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:translate-y-0 hover:shadow-hard active:translate-y-0 active:shadow-hard">
      <CardHeader>
        <h1 className="font-heading text-3xl font-black uppercase leading-none tracking-tight sm:text-4xl">
          Sign In
        </h1>
      </CardHeader>
      <CardContent className="space-y-6">
        {showExpiredBanner && (
          <div className="flex items-center gap-2 rounded-md border-2 border-amber-500/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Your session expired. Please sign in again.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <AuthField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={setEmail}
            onBlur={() => setEmailTouched(true)}
            state={emailValidation.state}
            error={fieldMessage(emailValidation)}
            disabled={isLoading}
            required
          />

          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs uppercase mono font-bold tracking-widest">
              Password
            </Label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              disabled={isLoading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={emailInvalid && password.length === 0}
            />
          </div>

          <div className="flex items-center justify-end">
            <NavLink
              href="/reset-password"
              className="text-sm font-bold hover:text-primary hover:underline hover:underline-offset-4 transition-colors"
              spinnerSize={12}
            >
              Forgot password?
            </NavLink>
          </div>

          {/* Interaction-only: widget self-hides when not needed. Takes zero
              visual space for real users; appears inline above the button if
              Cloudflare needs a challenge. */}
          <AuthTurnstile
            disabled={isLoading}
            action="login"
            appearance="interaction-only"
            onVerify={(token) => {
              setTurnstileToken(token);
              authBreadcrumb("login_turnstile_token_received");
            }}
            onError={() => {
              setTurnstileToken(null);
              trackTurnstileFail("login", "service_error");
            }}
            onExpire={() => {
              setTurnstileToken(null);
              trackTurnstileFail("login", "expired");
            }}
          />

          <Button
            type="submit"
            className="w-full"
            loading={isLoading}
            loadingText="SIGNING IN..."
            disabled={!canSubmit}
          >
            {submitLabel}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-3 mono uppercase tracking-widest font-bold">
              Or continue with
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignIn}
          loading={isGoogleLoading}
          loadingText="CONNECTING..."
          disabled={isLoading}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          SIGN IN WITH GOOGLE
        </Button>{" "}

        {/* Passive consent — terms acceptance via sign-in wrap */}
        <p className="text-center text-sm leading-relaxed text-muted-foreground">
          By signing in, you agree to our{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
          >
            Privacy Policy
          </a>
          .
        </p>

        <div className="pt-4 text-center border-t-2 border-border">
          <p className="text-base leading-relaxed text-foreground/70">
            Don&apos;t have an account?{" "}
            <NavLink
              href="/signup"
              className="text-foreground font-bold hover:text-primary hover:underline hover:underline-offset-4 transition-colors"
              spinnerSize={12}
            >
              Sign up
            </NavLink>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
