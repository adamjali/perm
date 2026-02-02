"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/toast";

type ResetStep = "email" | "reset";

export function ResetPasswordPageClient() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [step, setStep] = useState<ResetStep>("email");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const emailValue = formData.get("email") as string;
      setEmail(emailValue);

      await signIn("password", formData);
      setStep("reset");
      toast.success("If an account exists with this email, we've sent a reset code.");
    } catch (error) {
      console.error("[Reset Password Request Error]", error);

      const message = error instanceof Error ? error.message : String(error);
      const lower = message.toLowerCase();

      // Security: don't reveal whether email exists — show same success message
      // and proceed to code step for non-existent emails too
      if (
        lower.includes("invalidaccountid") ||
        lower.includes("invalid") ||
        lower.includes("account")
      ) {
        setStep("reset");
        toast.success("If an account exists with this email, we've sent a reset code.");
      } else if (
        lower.includes("toomanyfailedattempts") ||
        lower.includes("rate limit") ||
        lower.includes("too many")
      ) {
        toast.error("Too many attempts. Please wait a moment and try again.");
      } else if (
        lower.includes("network") ||
        lower.includes("offline") ||
        lower.includes("failed to fetch") ||
        lower.includes("load failed")
      ) {
        toast.error("Network error. Please check your connection and try again.");
      } else {
        // In production, Convex strips error messages — treat unknown errors
        // the same as success to avoid leaking email existence
        console.warn("[Reset Password Request] Unhandled error type:", message);
        setStep("reset");
        toast.success("If an account exists with this email, we've sent a reset code.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const newPassword = formData.get("newPassword") as string;
      const confirmPassword = formData.get("confirmPassword") as string;

      // Client-side validation
      if (newPassword !== confirmPassword) {
        toast.error("Passwords do not match");
        setIsLoading(false);
        return;
      }

      if (newPassword.length < 8) {
        toast.error("Password must be at least 8 characters");
        setIsLoading(false);
        return;
      }

      // Remove confirmPassword from formData before sending
      // Keep newPassword as-is (Convex Auth expects "newPassword" for reset-verification flow)
      formData.delete("confirmPassword");

      await signIn("password", formData);
      toast.success("Password reset successful! Please sign in.");
      router.push("/login");
    } catch (error) {
      console.error("[Reset Password Error]", error);

      const message = error instanceof Error ? error.message : String(error);
      const lower = message.toLowerCase();
      if (lower.includes("expired")) {
        toast.error("Reset code expired. Please request a new one.");
      } else if (lower.includes("invalid password")) {
        toast.error("Password does not meet requirements. Must be at least 8 characters.");
      } else if (
        lower.includes("invalid") ||
        lower.includes("incorrect") ||
        lower.includes("could not verify")
      ) {
        toast.error("Invalid reset code. Please check and try again.");
      } else if (
        lower.includes("toomanyfailedattempts") ||
        lower.includes("rate limit") ||
        lower.includes("too many")
      ) {
        toast.error("Too many attempts. Please wait a moment and try again.");
      } else if (
        lower.includes("network") ||
        lower.includes("offline") ||
        lower.includes("failed to fetch") ||
        lower.includes("load failed")
      ) {
        toast.error("Network error. Please check your connection and try again.");
      } else {
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
          <CardTitle className="text-3xl font-heading uppercase tracking-tight">
            Reset Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Enter the code sent to{" "}
            <span className="font-semibold text-foreground">{email}</span> and
            choose a new password.
          </p>

          <form onSubmit={handleResetSubmit} className="space-y-5">
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="flow" value="reset-verification" />

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
                className="mono text-lg tracking-wider text-center uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-xs uppercase mono font-bold tracking-widest">
                New Password
              </Label>
              <Input
                id="newPassword"
                name="newPassword"
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

            <Button
              type="submit"
              className="w-full"
              loading={isLoading}
              loadingText="RESETTING..."
            >
              RESET PASSWORD
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
        <CardTitle className="text-3xl font-heading uppercase tracking-tight">Reset Password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Enter your email address and we&apos;ll send you a code to reset your
          password.
        </p>

        <form onSubmit={handleEmailSubmit} className="space-y-5">
          <input type="hidden" name="flow" value="reset" />

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

          <Button
            type="submit"
            className="w-full"
            loading={isLoading}
            loadingText="SENDING..."
          >
            SEND RESET CODE
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
