"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useMutation } from "convex/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { NavLink } from "@/components/ui/nav-link";
import { toast } from "@/lib/toast";
import { captureError } from "@/lib/sentry";
import { handleStaleDeployment } from "@/components/error/auth-error";
import { api } from "../../../../convex/_generated/api";
import { AuthField } from "@/components/auth/AuthField";
import { AuthTurnstile } from "@/components/auth/AuthTurnstile";
import {
  validateEmailValue,
  validateNameValue,
  validatePasswordValue,
  validateConfirmPassword,
  fieldMessage,
} from "@/lib/auth/signup-validation";
import type { FieldValidation } from "@/lib/auth/signup-validation";
import { isNetworkError, isRateLimitError, isInvalidCodeError, isExpiredError } from "@/lib/auth/auth-errors";
import {
  trackTurnstileFail,
  trackSignupFieldInvalid,
  trackSubmitBlocked,
  trackSignupSucceeded,
  captureTurnstileServiceError,
  authBreadcrumb,
} from "@/lib/auth/auth-telemetry";

type SignupStep = "credentials" | "verification";

export function SignupPageClient() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const recordMyLogin = useMutation(api.users.recordMyLogin);
  const checkRateLimit = useMutation(api.authRateLimit.checkAuthRateLimit);
  const verifyTurnstile = useAction(api.turnstile.verifyTurnstileToken);

  const [step, setStep] = useState<SignupStep>("credentials");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Field values
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // "Touched" flags — a field only shows invalid state after first blur or
  // an attempted submit, so users aren't yelled at while typing.
  const [emailTouched, setEmailTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  // Track which fields have already had an "invalid" event reported, so
  // every keystroke doesn't spam PostHog. A ref (not state) — we don't
  // need to re-render when it changes.
  const reportedInvalidRef = useRef<Set<string>>(new Set());

  // Turnstile state
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState(false);

  // Verification step only needs the email
  const [verificationEmail, setVerificationEmail] = useState("");

  // Derived validation state
  const emailValidation = validateEmailValue(email, emailTouched);
  const nameValidation = validateNameValue(name, nameTouched);
  const passwordValidation = validatePasswordValue(password, passwordTouched);
  const confirmValidation = validateConfirmPassword(confirmPassword, password, confirmTouched);

  const firstMissing = useMemo<
    null | "email" | "name" | "password" | "confirm" | "turnstile"
  >(() => {
    if (emailValidation.state !== "valid") return "email";
    if (nameValidation.state === "invalid") return "name";
    if (passwordValidation.state !== "valid") return "password";
    if (confirmValidation.state !== "valid") return "confirm";
    if (!turnstileToken) return "turnstile";
    return null;
  }, [emailValidation.state, nameValidation.state, passwordValidation.state, confirmValidation.state, turnstileToken]);

  const submitLabel = useMemo(() => {
    if (isLoading) return "CREATING...";
    switch (firstMissing) {
      case "email": return "ENTER YOUR EMAIL";
      case "name": return "FIX NAME";
      case "password": return "ENTER A PASSWORD";
      case "confirm": return "CONFIRM YOUR PASSWORD";
      case "turnstile": return "COMPLETE SECURITY CHECK";
      default: return "CREATE ACCOUNT";
    }
  }, [isLoading, firstMissing]);

  const reportIfNewInvalid = useCallback(
    (field: string, reason: string | undefined) => {
      if (!reason) return;
      if (reportedInvalidRef.current.has(field)) return;
      reportedInvalidRef.current.add(field);
      trackSignupFieldInvalid(field, reason);
    },
    [],
  );

  // Field config drives blur handling so each field's touched-setter +
  // validator + telemetry key live in ONE place. The map key IS the reportKey,
  // so the confirm field can't drift between "confirm" and "confirm_password"
  // across blur / cascade / submit-blocked reporting.
  const fieldConfig = useMemo<
    Record<
      "email" | "name" | "password" | "confirm",
      { setTouched: (v: boolean) => void; validate: () => FieldValidation }
    >
  >(
    () => ({
      email: { setTouched: setEmailTouched, validate: () => validateEmailValue(email, true) },
      name: { setTouched: setNameTouched, validate: () => validateNameValue(name, true) },
      password: { setTouched: setPasswordTouched, validate: () => validatePasswordValue(password, true) },
      confirm: {
        setTouched: setConfirmTouched,
        validate: () => validateConfirmPassword(confirmPassword, password, true),
      },
    }),
    [email, name, password, confirmPassword],
  );

  const handleBlur = useCallback(
    (field: "email" | "name" | "password" | "confirm") => {
      // `field` is a closed literal union, not user input — safe record access.
      const cfg = fieldConfig[field];
      cfg.setTouched(true);
      const v = cfg.validate();
      if (v.state === "invalid") reportIfNewInvalid(field, v.reason);
    },
    [fieldConfig, reportIfNewInvalid],
  );

  const enforceRateLimit = useCallback(
    async (emailValue: string, action: "signup" | "otp_verify") => {
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

  const handleCredentialsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    authBreadcrumb("signup_submit_attempt");

    // If somehow submitted while blocked (keyboard Enter past disabled button),
    // promote everything to touched and report which gate failed.
    if (firstMissing) {
      setEmailTouched(true);
      setNameTouched(true);
      setPasswordTouched(true);
      setConfirmTouched(true);
      trackSubmitBlocked("signup", firstMissing);
      return;
    }

    setIsLoading(true);

    try {
      // Pre-flight rate limit check
      if (!(await enforceRateLimit(email, "signup"))) {
        setIsLoading(false);
        return;
      }

      // Pre-flight Turnstile verification — must pass before signIn.
      // We already know turnstileToken is non-null here (firstMissing guarded it).
      try {
        const verifyResult = await verifyTurnstile({ token: turnstileToken! });
        if (!verifyResult.success) {
          trackTurnstileFail("signup", "siteverify_rejected");
          setTurnstileToken(null);
          toast.error(verifyResult.error || "Security check failed. Please try again.");
          setIsLoading(false);
          return;
        }
      } catch (verifyError) {
        captureTurnstileServiceError(verifyError, "signup");
        trackTurnstileFail("signup", "service_error");
        setTurnstileToken(null);
        toast.error("Couldn't verify the security check. Please refresh and try again.");
        setIsLoading(false);
        return;
      }

      authBreadcrumb("signup_turnstile_verified");

      // Build FormData — Convex Auth expects these exact field names.
      const formData = new FormData();
      formData.set("email", email);
      if (name.trim()) formData.set("name", name.trim());
      formData.set("password", password);
      formData.set("flow", "signUp");

      setVerificationEmail(email);
      const result = await signIn("password", formData);
      authBreadcrumb("signup_signin_completed");

      if (result.signingIn) {
        toast.success("Welcome to PERM Tracker!");
        localStorage.setItem("perm_last_login_at", String(Date.now()));
        recordMyLogin().catch((err) => console.warn("[recordMyLogin] failed:", err));
        trackSignupSucceeded("email_password");
        router.push("/dashboard");
      } else {
        // OTP sent — move to verification step
        setStep("verification");
        toast.success("Verification code sent to your email");
      }
    } catch (error) {
      if (handleStaleDeployment(error)) return;

      const message = error instanceof Error ? error.message : String(error);
      const lower = message.toLowerCase();

      // Server-level validation rejections — surface at the right field
      if (lower.includes("names can't contain") || lower.includes("invalid characters") || lower.includes("repeated content") || (lower.includes("names must be") && lower.includes("characters"))) {
        setNameTouched(true);
        toast.error(message);
        return;
      }
      if (lower.includes("invalid email") || lower.includes("email format")) {
        setEmailTouched(true);
        toast.error("Please enter a valid email address.");
        return;
      }
      if (lower.includes("already exists") || lower.includes("duplicate")) {
        toast.error("An account with this email already exists. Try signing in instead.");
        return;
      }
      if (isRateLimitError(message)) {
        toast.error("Too many attempts. Please wait a moment and try again.");
        return;
      }
      if (isNetworkError(message)) {
        toast.error("Network error. Please check your connection and try again.");
        return;
      }

      // Genuinely unexpected — Sentry capture + user toast
      captureError(error, { operation: "signUp" });
      console.warn("[Signup] Unhandled error type:", message);
      toast.error("Failed to create account. Please try again or contact support.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);

      if (!(await enforceRateLimit(verificationEmail, "otp_verify"))) {
        setIsLoading(false);
        return;
      }

      await signIn("password", formData);

      toast.success("Account verified! Welcome to PERM Tracker.");
      localStorage.setItem("perm_last_login_at", String(Date.now()));
      recordMyLogin().catch((err) => console.warn("[recordMyLogin] failed:", err));
      trackSignupSucceeded("email_password");
      router.push("/dashboard");
    } catch (error) {
      if (handleStaleDeployment(error)) return;

      const message = error instanceof Error ? error.message : String(error);

      if (isExpiredError(message)) {
        toast.error("Verification code expired. Go back and resubmit to get a new code.");
      } else if (isInvalidCodeError(message)) {
        toast.error("Invalid verification code. Please check and try again.");
      } else if (isRateLimitError(message)) {
        toast.error("Too many attempts. Please wait a moment and try again.");
      } else if (isNetworkError(message)) {
        toast.error("Network error. Please check your connection and try again.");
      } else {
        captureError(error, { operation: "signUpVerification" });
        console.warn("[Verification] Unhandled error type:", message);
        toast.error("Verification failed. Please try again or contact support.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    authBreadcrumb("signup_google_initiated");
    try {
      await signIn("google", { redirectTo: "/dashboard" });
    } catch (error) {
      if (handleStaleDeployment(error)) return;
      const message = error instanceof Error ? error.message : String(error);
      const lower = message.toLowerCase();
      if (lower.includes("popup") || lower.includes("closed")) {
        toast.error("Sign up was cancelled. Please try again.");
      } else if (isNetworkError(message)) {
        toast.error("Network error. Please check your connection and try again.");
      } else {
        captureError(error, { operation: "googleSignUp" });
        console.warn("[Google Sign Up] Unhandled error type:", message);
        toast.error("Failed to sign up with Google. Please try again or contact support.");
      }
      setIsGoogleLoading(false);
    }
  };

  if (step === "verification") {
    return (
      <Card>
        <CardHeader>
          <h1 className="text-3xl font-heading font-semibold uppercase tracking-tight leading-none">
            Verify Email
          </h1>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent a 12-character verification code to{" "}
            <span className="font-semibold text-foreground">{verificationEmail}</span>
          </p>

          <form onSubmit={handleVerificationSubmit} className="space-y-5">
            <input type="hidden" name="email" value={verificationEmail} />
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

          <div className="pt-4 text-center border-t-2 border-black">
            <button
              onClick={() => setStep("credentials")}
              className="text-sm font-bold hover:text-primary hover:underline hover:underline-offset-4 transition-colors"
            >
              &larr; Back to signup
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h1 className="text-3xl font-heading font-semibold uppercase tracking-tight leading-none">
          Sign Up
        </h1>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleCredentialsSubmit} className="space-y-5" noValidate>
          <AuthField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={setEmail}
            onBlur={() => handleBlur("email")}
            state={emailValidation.state}
            error={fieldMessage(emailValidation)}
            disabled={isLoading}
            required
          />

          <AuthField
            id="name"
            label="Name (optional)"
            type="text"
            autoComplete="name"
            placeholder="John Doe"
            value={name}
            onChange={setName}
            onBlur={() => handleBlur("name")}
            state={nameValidation.state}
            error={fieldMessage(nameValidation)}
            helperText="Letters, numbers, and punctuation only. No web links or emojis."
            disabled={isLoading}
            maxLength={80}
          />

          <AuthField
            id="password"
            label="Password"
            component="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(v) => {
              setPassword(v);
              // Cascade: confirm field's validity depends on password.
              // If confirm was already touched, re-validate after password edit.
              if (confirmTouched) {
                const cv = validateConfirmPassword(confirmPassword, v, true);
                if (cv.state === "invalid") reportIfNewInvalid("confirm", cv.reason);
              }
            }}
            onBlur={() => handleBlur("password")}
            state={passwordValidation.state}
            error={fieldMessage(passwordValidation)}
            helperText="At least 8 characters"
            helperMet={password.length >= 8}
            disabled={isLoading}
            required
          />

          <AuthField
            id="confirmPassword"
            label="Confirm Password"
            component="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={setConfirmPassword}
            onBlur={() => handleBlur("confirm")}
            state={confirmValidation.state}
            error={fieldMessage(confirmValidation)}
            disabled={isLoading}
            required
          />

          <div className="space-y-2">
            <AuthTurnstile
              disabled={isLoading}
              action="signup"
              appearance="always"
              onVerify={(token) => {
                setTurnstileToken(token);
                setTurnstileError(false);
                authBreadcrumb("signup_turnstile_token_received");
              }}
              onError={() => {
                setTurnstileToken(null);
                setTurnstileError(true);
                trackTurnstileFail("signup", "service_error");
              }}
              onExpire={() => {
                setTurnstileToken(null);
                trackTurnstileFail("signup", "expired");
              }}
            />
            {turnstileError && (
              <p
                role="alert"
                className="text-xs mono font-bold uppercase tracking-wider text-destructive text-center"
              >
                Verification check failed. Refresh the page and try again.
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={isLoading}
            loadingText="CREATING..."
            disabled={isGoogleLoading || firstMissing !== null}
          >
            {submitLabel}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-black" />
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
          SIGN UP WITH GOOGLE
        </Button>

        {/* Passive consent — terms acceptance via sign-in wrap */}
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          By creating an account, you agree to our{" "}
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

        {/* Cloud storage disclaimer */}
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          PERM Tracker is a case management tool, not a legal service. Your data
          is stored securely on cloud infrastructure with encryption.{" "}
          <NavLink
            href="/terms#attorney-privilege"
            className="text-foreground/80 hover:text-primary hover:underline hover:underline-offset-2 transition-colors"
            spinnerSize={8}
          >
            Learn more
          </NavLink>
        </p>

        <div className="pt-4 text-center border-t-2 border-black">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <NavLink
              href="/login"
              className="text-foreground font-bold hover:text-primary hover:underline hover:underline-offset-4 transition-colors"
              spinnerSize={12}
            >
              Sign in
            </NavLink>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
