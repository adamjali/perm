"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavLink } from "@/components/ui/nav-link";
import { toast } from "@/lib/toast";
import { api } from "../../../../convex/_generated/api";
import { savePendingTermsAcceptance } from "@/lib/auth/termsStorage";

// Current Terms of Service version (matches effective date in /terms page)
const TERMS_VERSION = "2026-01-03";

type SignupStep = "credentials" | "verification";

export function SignupPageClient() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const acceptTerms = useMutation(api.users.acceptTermsOfService);
  const [step, setStep] = useState<SignupStep>("credentials");
  const [email, setEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleCredentialsSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const password = formData.get("password") as string;
      const confirmPassword = formData.get("confirmPassword") as string;

      // Client-side validation
      if (!termsAccepted) {
        toast.error("Please accept the Terms of Service and Privacy Policy");
        setIsLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        setIsLoading(false);
        return;
      }

      if (password.length < 8) {
        toast.error("Password must be at least 8 characters");
        setIsLoading(false);
        return;
      }

      const emailValue = formData.get("email") as string;
      setEmail(emailValue);

      // Remove confirmPassword from formData before sending
      formData.delete("confirmPassword");

      await signIn("password", formData);
      setStep("verification");
      toast.success("Verification code sent to your email");
    } catch (error) {
      // Log full error for debugging (visible in browser console)
      console.error("[Signup Error]", error);

      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("already exists") || message.includes("duplicate")) {
        toast.error("An account with this email already exists. Try signing in.");
      } else if (message.includes("invalid email") || message.includes("email format")) {
        toast.error("Please enter a valid email address.");
      } else if (message.includes("rate limit") || message.includes("too many")) {
        toast.error("Too many attempts. Please wait a moment and try again.");
      } else {
        console.warn("[Signup] Unhandled error type:", message);
        toast.error("Failed to create account. Please try again.");
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
      await signIn("password", formData);

      // Record terms acceptance after successful verification
      try {
        await acceptTerms({ termsVersion: TERMS_VERSION });
      } catch (termsError) {
        // Log but don't block - user is already authenticated
        console.warn("[Terms Acceptance] Failed to record:", termsError);
      }

      toast.success("Account verified! Welcome to PERM Tracker.");
      router.push("/dashboard");
    } catch (error) {
      // Log full error for debugging (visible in browser console)
      console.error("[Verification Error]", error);

      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("expired")) {
        toast.error("Verification code expired. Please request a new one.");
      } else if (message.includes("invalid") || message.includes("incorrect")) {
        toast.error("Invalid verification code. Please check and try again.");
      } else if (message.includes("rate limit") || message.includes("too many")) {
        toast.error("Too many attempts. Please wait a moment and try again.");
      } else {
        console.warn("[Verification] Unhandled error type:", message);
        toast.error("Verification failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // Validate terms acceptance first
    if (!termsAccepted) {
      toast.error("Please accept the Terms of Service and Privacy Policy");
      return;
    }

    setIsGoogleLoading(true);
    try {
      // Save terms acceptance to localStorage BEFORE OAuth redirect
      // This persists the checkbox state through the Google redirect flow
      // After redirect, the dashboard will check localStorage and record acceptance
      savePendingTermsAcceptance(TERMS_VERSION);

      await signIn("google", { redirectTo: "/dashboard" });
      // Note: For Google OAuth, terms acceptance is recorded after redirect
      // The PendingTermsHandler component checks localStorage and calls acceptTermsOfService
    } catch (error) {
      // Log full error for debugging (visible in browser console)
      console.error("[Google Sign Up Error]", error);

      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("popup") || message.includes("closed")) {
        toast.error("Sign up was cancelled. Please try again.");
      } else if (message.includes("network") || message.includes("offline")) {
        toast.error("Network error. Please check your connection.");
      } else {
        console.warn("[Google Sign Up] Unhandled error type:", message);
        toast.error("Failed to sign up with Google. Please try again.");
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
            We&apos;ve sent a 12-character verification code to{" "}
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

          <div className="pt-4 text-center border-t-2 border-black">
            <button
              onClick={() => setStep("credentials")}
              className="text-sm font-bold hover:text-primary hover:underline hover:underline-offset-4 transition-colors"
            >
              ← Back to signup
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl font-heading uppercase tracking-tight">Sign Up</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleCredentialsSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs uppercase mono font-bold tracking-widest">
              Name <span className="text-muted-foreground font-normal lowercase text-[10px]">(optional)</span>
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Doe"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs uppercase mono font-bold tracking-widest">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs uppercase mono font-bold tracking-widest">
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              minLength={8}
              required
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-xs uppercase mono font-bold tracking-widest">
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              minLength={8}
              required
              disabled={isLoading}
            />
          </div>

          {/* Terms acceptance checkbox */}
          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              disabled={isLoading}
              className="mt-0.5"
            />
            <label
              htmlFor="terms"
              className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
            >
              I agree to the{" "}
              <NavLink
                href="/terms"
                className="text-foreground font-semibold hover:text-primary hover:underline hover:underline-offset-4 transition-colors"
                spinnerSize={10}
                target="_blank"
              >
                Terms of Service
              </NavLink>{" "}
              and{" "}
              <NavLink
                href="/privacy"
                className="text-foreground font-semibold hover:text-primary hover:underline hover:underline-offset-4 transition-colors"
                spinnerSize={10}
                target="_blank"
              >
                Privacy Policy
              </NavLink>
            </label>
          </div>

          <input type="hidden" name="flow" value="signUp" />

          <Button
            type="submit"
            className="w-full"
            loading={isLoading}
            loadingText="CREATING..."
            disabled={isGoogleLoading}
          >
            CREATE ACCOUNT
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
