"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useMutation } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "@/lib/toast";
import { captureError } from "@/lib/sentry";
import { handleStaleDeployment } from "@/components/error/auth-error";
import { api } from "../../../../convex/_generated/api";
import { AuthField } from "@/components/auth/AuthField";
import { AuthTurnstile } from "@/components/auth/AuthTurnstile";
import {
  validateEmailValue,
  validatePasswordValue,
  validateConfirmPassword,
  fieldMessage,
} from "@/lib/auth/signup-validation";
import { isNetworkError, isRateLimitError, isInvalidCodeError, isExpiredError } from "@/lib/auth/auth-errors";
import {
  trackTurnstileFail,
  trackPasswordResetRequested,
  trackPasswordResetCompleted,
  trackSubmitBlocked,
  captureTurnstileServiceError,
  authBreadcrumb,
} from "@/lib/auth/auth-telemetry";

type ResetStep = "email" | "reset";

export function ResetPasswordPageClient() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const checkRateLimit = useMutation(api.authRateLimit.checkAuthRateLimit);
  const verifyTurnstile = useAction(api.turnstile.verifyTurnstileToken);

  const [step, setStep] = useState<ResetStep>("email");
  const [isLoading, setIsLoading] = useState(false);

  // Email step
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState(false);

  // Reset step
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const emailValidation = validateEmailValue(email, emailTouched);
  const newPasswordValidation = validatePasswordValue(newPassword, newPasswordTouched);
  const confirmValidation = validateConfirmPassword(confirmPassword, newPassword, confirmTouched);

  const emailFirstMissing = useMemo<null | "email" | "turnstile">(() => {
    if (emailValidation.state !== "valid") return "email";
    if (!turnstileToken) return "turnstile";
    return null;
  }, [emailValidation.state, turnstileToken]);

  const emailStepLabel = useMemo(() => {
    if (isLoading) return "SENDING...";
    switch (emailFirstMissing) {
      case "email": return "ENTER YOUR EMAIL";
      case "turnstile": return "COMPLETE SECURITY CHECK";
      default: return "SEND RESET CODE";
    }
  }, [isLoading, emailFirstMissing]);

  const resetFirstMissing = useMemo<null | "code" | "password" | "confirm">(() => {
    if (!code || code.length < 12) return "code";
    if (newPasswordValidation.state !== "valid") return "password";
    if (confirmValidation.state !== "valid") return "confirm";
    return null;
  }, [code, newPasswordValidation.state, confirmValidation.state]);

  const resetStepLabel = useMemo(() => {
    if (isLoading) return "RESETTING...";
    switch (resetFirstMissing) {
      case "code": return "ENTER THE CODE";
      case "password": return "ENTER A NEW PASSWORD";
      case "confirm": return "CONFIRM YOUR PASSWORD";
      default: return "RESET PASSWORD";
    }
  }, [isLoading, resetFirstMissing]);

  const enforceRateLimit = useCallback(
    async (emailValue: string) => {
      try {
        const result = await checkRateLimit({ email: emailValue, action: "password_reset" });
        if (!result.allowed) {
          toast.error(result.message || "Too many attempts. Please wait and try again.");
          return false;
        }
        return true;
      } catch (error) {
        // Fail open for availability
        captureError(error, { operation: "enforceRateLimit" });
        return true;
      }
    },
    [checkRateLimit],
  );

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    authBreadcrumb("reset_email_submit_attempt");

    if (emailFirstMissing) {
      setEmailTouched(true);
      trackSubmitBlocked("reset_password", emailFirstMissing);
      return;
    }

    setIsLoading(true);

    try {
      if (!(await enforceRateLimit(email))) {
        setIsLoading(false);
        return;
      }

      // Pre-flight Turnstile — same pattern as signup.
      try {
        const verifyResult = await verifyTurnstile({ token: turnstileToken! });
        if (!verifyResult.success) {
          trackTurnstileFail("reset_password", "siteverify_rejected");
          setTurnstileToken(null);
          toast.error(verifyResult.error || "Security check failed. Please try again.");
          setIsLoading(false);
          return;
        }
      } catch (verifyError) {
        captureTurnstileServiceError(verifyError, "reset_password");
        trackTurnstileFail("reset_password", "service_error");
        setTurnstileToken(null);
        toast.error("Couldn't verify the security check. Please refresh and try again.");
        setIsLoading(false);
        return;
      }

      authBreadcrumb("reset_turnstile_verified");

      const formData = new FormData();
      formData.set("email", email);
      formData.set("flow", "reset");

      await signIn("password", formData);
      trackPasswordResetRequested();
      setStep("reset");
      toast.success("If an account exists with this email, we've sent a reset code.");
    } catch (error) {
      if (handleStaleDeployment(error)) return;

      const message = error instanceof Error ? error.message : String(error);

      if (isRateLimitError(message)) {
        captureError(error, { operation: "resetPasswordRequest" });
        toast.error("Too many attempts. Please wait a moment and try again.");
      } else if (isNetworkError(message)) {
        captureError(error, { operation: "resetPasswordRequest" });
        toast.error("Network error. Please check your connection and try again.");
      } else {
        // Expected: InvalidAccountId (no password account), Convex's generic
        // "Server Error" mask. Don't capture to Sentry. Always show the same
        // success message to avoid leaking email existence.
        trackPasswordResetRequested();
        setStep("reset");
        toast.success("If an account exists with this email, we've sent a reset code.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    authBreadcrumb("reset_code_submit_attempt");

    if (resetFirstMissing) {
      setNewPasswordTouched(true);
      setConfirmTouched(true);
      trackSubmitBlocked("reset_password", `code_step_${resetFirstMissing}`);
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("code", code);
      formData.set("newPassword", newPassword);
      formData.set("flow", "reset-verification");

      await signIn("password", formData);
      trackPasswordResetCompleted();
      toast.success("Password reset successful! Please sign in.");
      router.push("/login");
    } catch (error) {
      if (handleStaleDeployment(error)) return;

      const message = error instanceof Error ? error.message : String(error);
      const lower = message.toLowerCase();

      if (isExpiredError(message)) {
        toast.error("Reset code expired. Please request a new one.");
      } else if (lower.includes("invalid password")) {
        toast.error("Password does not meet requirements. Must be at least 8 characters.");
      } else if (isInvalidCodeError(message)) {
        toast.error("Invalid reset code. Please check and try again.");
      } else if (isRateLimitError(message)) {
        toast.error("Too many attempts. Please wait a moment and try again.");
      } else if (isNetworkError(message)) {
        toast.error("Network error. Please check your connection and try again.");
      } else {
        captureError(error, { operation: "resetPassword" });
        console.warn("[Reset Password] Unhandled error type:", message);
        toast.error("Failed to reset password. Please try again or contact support.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "reset") {
    return (
      <Card>
        <CardHeader>
          <h1 className="text-3xl font-heading font-semibold uppercase tracking-tight leading-none">
            Reset Password
          </h1>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Enter the code sent to{" "}
            <span className="font-semibold text-foreground">{email}</span> and
            choose a new password.
          </p>

          <form onSubmit={handleResetSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="code" className="text-xs uppercase mono font-bold tracking-widest">
                Reset Code
              </Label>
              <Input
                id="code"
                name="code"
                type="text"
                placeholder="XXXXXXXXXXXX"
                maxLength={12}
                required
                disabled={isLoading}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mono text-lg tracking-wider text-center uppercase"
              />
            </div>

            <AuthField
              id="newPassword"
              label="New Password"
              component="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={newPassword}
              onChange={setNewPassword}
              onBlur={() => setNewPasswordTouched(true)}
              state={newPasswordValidation.state}
              error={fieldMessage(newPasswordValidation)}
              helperText="At least 8 characters"
              helperMet={newPassword.length >= 8}
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
              onBlur={() => setConfirmTouched(true)}
              state={confirmValidation.state}
              error={fieldMessage(confirmValidation)}
              disabled={isLoading}
              required
            />

            <Button
              type="submit"
              className="w-full"
              loading={isLoading}
              loadingText="RESETTING..."
              disabled={resetFirstMissing !== null && !isLoading}
            >
              {resetStepLabel}
            </Button>
          </form>

          <div className="pt-4 text-center border-t-2 border-black">
            <button
              onClick={() => setStep("email")}
              className="text-sm font-bold hover:text-primary hover:underline hover:underline-offset-4 transition-colors"
            >
              ← Back to email
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
          Reset Password
        </h1>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Enter your email address and we&apos;ll send you a code to reset your
          password.
        </p>

        <form onSubmit={handleEmailSubmit} className="space-y-5" noValidate>
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
            <AuthTurnstile
              disabled={isLoading}
              action="password-reset"
              appearance="always"
              onVerify={(token) => {
                setTurnstileToken(token);
                setTurnstileError(false);
                authBreadcrumb("reset_turnstile_token_received");
              }}
              onError={() => {
                setTurnstileToken(null);
                setTurnstileError(true);
                trackTurnstileFail("reset_password", "service_error");
              }}
              onExpire={() => {
                setTurnstileToken(null);
                trackTurnstileFail("reset_password", "expired");
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
            loadingText="SENDING..."
            disabled={emailFirstMissing !== null && !isLoading}
          >
            {emailStepLabel}
          </Button>
        </form>

        <div className="pt-4 text-center border-t-2 border-black">
          <p className="text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link
              href="/login"
              className="text-foreground font-bold hover:text-primary hover:underline hover:underline-offset-4 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
