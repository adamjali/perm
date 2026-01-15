/**
 * TermsAcceptanceModal
 *
 * Modal displayed to new Google OAuth users who haven't accepted terms.
 * This handles the case where a user signs in with Google from the login page
 * (bypassing the signup flow with its terms checkbox).
 *
 * Features:
 * - Cannot be closed without accepting terms (no X button, no backdrop dismiss)
 * - Checkbox for terms acceptance
 * - Links to Terms of Service and Privacy Policy (open in new tab)
 * - Calls acceptTermsOfService mutation on accept
 *
 * Phase: 32 (Data Migration / Go-Live polish)
 * Created: 2026-01-15
 */

"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NavLink } from "@/components/ui/nav-link";
import { toast } from "@/lib/toast";

// Current Terms of Service version (matches effective date in /terms page)
const TERMS_VERSION = "2026-01-03";

interface TermsAcceptanceModalProps {
  open: boolean;
  onAccepted: () => void;
  onDecline?: () => void;
}

export function TermsAcceptanceModal({
  open,
  onAccepted,
  onDecline,
}: TermsAcceptanceModalProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const acceptTerms = useMutation(api.users.acceptTermsOfService);

  const handleAccept = async () => {
    if (!termsAccepted) {
      toast.error("Please accept the Terms of Service and Privacy Policy");
      return;
    }

    setIsLoading(true);
    try {
      await acceptTerms({ termsVersion: TERMS_VERSION });
      toast.success("Terms accepted. Welcome to PERM Tracker!");
      onAccepted();
    } catch (error) {
      console.error("[Terms Acceptance] Failed:", error);
      toast.error("Failed to record acceptance. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        /* Prevent closing without accepting */
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Welcome to PERM Tracker
          </DialogTitle>
          <DialogDescription>
            To continue, please accept our Terms of Service and Privacy Policy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms-modal"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              disabled={isLoading}
              className="mt-0.5"
            />
            <label
              htmlFor="terms-modal"
              className="text-sm leading-relaxed cursor-pointer text-muted-foreground"
            >
              I agree to the{" "}
              <NavLink
                href="/terms"
                target="_blank"
                className="text-foreground font-semibold hover:text-primary hover:underline hover:underline-offset-4 transition-colors"
                spinnerSize={10}
              >
                Terms of Service
              </NavLink>{" "}
              and{" "}
              <NavLink
                href="/privacy"
                target="_blank"
                className="text-foreground font-semibold hover:text-primary hover:underline hover:underline-offset-4 transition-colors"
                spinnerSize={10}
              >
                Privacy Policy
              </NavLink>
            </label>
          </div>

          <Button
            onClick={handleAccept}
            className="w-full"
            loading={isLoading}
            loadingText="ACCEPTING..."
            disabled={!termsAccepted}
          >
            ACCEPT & CONTINUE
          </Button>

          {onDecline && (
            <Button
              type="button"
              variant="ghost"
              onClick={onDecline}
              className="w-full text-muted-foreground hover:text-foreground"
              disabled={isLoading}
            >
              No, take me back
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
