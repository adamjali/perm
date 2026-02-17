"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavLink } from "@/components/ui/nav-link";
import { toast } from "@/lib/toast";
import { captureError } from "@/lib/sentry";
import { handleStaleDeployment } from "@/components/error/auth-error";
import { useAuthContext } from "@/lib/contexts/AuthContext";

type LoginStep = "login" | "verification";

function isNetworkError(message: string): boolean {
  return /network|offline|failed to fetch|load failed/i.test(message);
}

function isRateLimitError(message: string): boolean {
  return /toomanyfailedattempts|rate limit|too many/i.test(message);
}

function isServerError(message: string): boolean {
  return /server error/i.test(message);
}

export function LoginPageClient() {
  const { signIn } = useAuthActions();
  const recordMyLogin = useMutation(api.users.recordMyLogin);
  const checkRateLimit = useMutation(api.authRateLimit.checkAuthRateLimit);
  const clearRateLimitMut = useMutation(api.authRateLimit.clearAuthRateLimit);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeSignOut } = useAuthContext();
  const [step, setStep] = useState<LoginStep>("login");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showExpiredBanner, setShowExpiredBanner] = useState(false);

  const enforceRateLimit = useCallback(async (emailValue: string, action: "login" | "otp_verify") => {
    try {
      const result = await checkRateLimit({ email: emailValue, action });
      if (!result.allowed) {
        toast.error(result.message || "Too many attempts. Please wait and try again.");
        return false;
      }
      return true;
    } catch {
      // Rate limit check failed — allow the attempt (fail open for availability)
      return true;
    }
  }, [checkRateLimit]);

  // Reset signing out state when arriving at login page (after sign-out completes)
  useEffect(() => {
    completeSignOut();
  }, [completeSignOut]);

  // Show session expired banner when redirected from auth error
  useEffect(() => {
    if (searchParams.get("expired") === "1") {
      setShowExpiredBanner(true);
      // Clean the URL without triggering a navigation
      window.history.replaceState({}, "", "/login");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const emailValue = formData.get("email") as string;

      // Pre-flight rate limit check
      if (!await enforceRateLimit(emailValue, "login")) {
        setIsLoading(false);
        return;
      }

      const result = await signIn("password", formData);

      if (result.signingIn) {
        clearRateLimitMut({ email: emailValue, action: "login" }).catch(() => {});
        localStorage.setItem("perm_last_login_at", String(Date.now()));
        recordMyLogin().catch(() => {});
        router.push("/dashboard");
      } else {
        // Email not verified — provider re-sent a verification code
        setEmail(formData.get("email") as string);
        setStep("verification");
        toast.info("Your email isn't verified yet. We've sent a new verification code.");
      }
    } catch (error) {
      if (handleStaleDeployment(error)) return;

      const message = error instanceof Error ? error.message : String(error);
      console.error("[Login Error]", error);
      captureError(error, { operation: "signIn" });

      if (isRateLimitError(message)) {
        toast.error("Too many attempts. Please wait a moment and try again.");
      } else if (isNetworkError(message)) {
        toast.error("Network error. Please check your connection and try again.");
      } else if (isServerError(message)) {
        toast.error("Something went wrong on our end. Please try again or contact support.");
      } else {
        if (!/invalid/i.test(message)) {
          console.warn("[Login] Unhandled error type:", message);
        }
        toast.error("Invalid email or password. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);

      // Pre-flight rate limit check for OTP verification
      if (!await enforceRateLimit(email, "otp_verify")) {
        setIsLoading(false);
        return;
      }

      await signIn("password", formData);

      toast.success("Email verified! Signing you in.");
      localStorage.setItem("perm_last_login_at", String(Date.now()));
      recordMyLogin().catch(() => {});
      router.push("/dashboard");
    } catch (error) {
      if (handleStaleDeployment(error)) return;

      const message = error instanceof Error ? error.message : String(error);
      console.error("[Login Verification Error]", error);
      captureError(error, { operation: "signInVerification" });

      if (/expired/i.test(message)) {
        toast.error(
          "Verification code expired. Go back and sign in again to get a new code."
        );
      } else if (/invalid|incorrect|could not verify/i.test(message)) {
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
    try {
      await signIn("google", { redirectTo: "/dashboard" });
    } catch (error) {
      if (handleStaleDeployment(error)) return;

      const message = error instanceof Error ? error.message : String(error);
      console.error("[Google Sign In Error]", error);
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
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-heading uppercase tracking-tight">
            Verify Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Your email hasn&apos;t been verified yet. We&apos;ve sent a 12-character
            verification code to{" "}
            <span className="font-semibold text-foreground">{email}</span>
          </p>

          <form method="POST" onSubmit={handleVerificationSubmit} className="space-y-5">
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

          <div className="pt-4 text-center border-t-2 border-black">
            <button
              onClick={() => setStep("login")}
              className="text-sm font-bold hover:text-primary hover:underline hover:underline-offset-4 transition-colors"
            >
              &larr; Back to sign in
            </button>
            <p className="text-xs text-muted-foreground mt-2">
              Didn&apos;t get the code? Go back and sign in again to resend it.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl font-heading uppercase tracking-tight">Sign In</CardTitle>
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
        <form method="POST" onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs uppercase mono font-bold tracking-widest">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              disabled={isLoading}
            />
          </div>

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
            />
          </div>

          <input type="hidden" name="flow" value="signIn" />

          <div className="flex items-center justify-end">
            <NavLink
              href="/reset-password"
              className="text-sm font-bold hover:text-primary hover:underline hover:underline-offset-4 transition-colors"
              spinnerSize={12}
            >
              Forgot password?
            </NavLink>
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={isLoading}
            loadingText="SIGNING IN..."
            disabled={isGoogleLoading}
          >
            SIGN IN
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
          SIGN IN WITH GOOGLE
        </Button>

        <div className="pt-4 text-center border-t-2 border-black">
          <p className="text-sm text-muted-foreground">
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
