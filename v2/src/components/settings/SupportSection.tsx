"use client";

// `convex/react` is a CLIENT-ONLY module: its hooks reach `React.createContext`,
// which exists only in React's client build. Declared here rather
// than inherited from whichever importer happened to cross a boundary first.
// Without it this module works until the chunk graph shifts, then fails with
// `TypeError: (0 , d.createContext) is not a function` naming webpack bootstrap
// and no source file. See components/layout/Footer.tsx.

/**
 * SupportSection Component
 *
 * Support and help section with contact links, bug reporting,
 * feature requests, app version, and account deletion.
 *
 * Features:
 * - Contact Support - Email link to support
 * - Report a Bug - GitHub Issues link with bug label
 * - Request a Feature - GitHub Issues link with enhancement label
 * - App Version - Display version from env or fallback
 * - Delete Account - Soft delete with 30-day grace period
 * - Neobrutalist styling matching other settings sections
 */

"use client";

import { useState } from "react";
import { useMutation, useConvex } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { SettingsCard } from "./SettingsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DownloadIcon } from "@phosphor-icons/react/ssr";
import { toast } from "@/lib/toast";
import { captureError } from "@/lib/sentry";
import { handleOperationError } from "@/lib/errors";
import { LEGAL_NAME } from "@/lib/constants/about";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import DeleteNowDialog from "./DeleteNowDialog";
import AnalyticsToggle from "./AnalyticsToggle";
import {
  BUG_REPORT_URL,
  FEATURE_REQUEST_URL,
} from "@/lib/constants/externalLinks";

// ============================================================================
// CONSTANTS
// ============================================================================

const SUPPORT_EMAIL = "support@permtracker.app";
const DELETE_CONFIRMATION_TEXT = "DELETE";
const GRACE_PERIOD_DAYS = 30;

// ============================================================================
// TYPES
// ============================================================================

export interface SupportSectionProps {
  profile: {
    deletedAt?: number;
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SupportSection({ profile }: SupportSectionProps) {
  // Version from env or fallback
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "2.0.0";
  const currentYear = new Date().getFullYear();
  const { restartTour } = useOnboarding();
  const [isRestarting, setIsRestarting] = useState(false);

  // Delete account state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteNowOpen, setDeleteNowOpen] = useState(false);

  // Data export state
  const [isExporting, setIsExporting] = useState(false);
  const convex = useConvex();

  // Auth for sign out
  const { signOut } = useAuthActions();
  const { beginSignOut, cancelSignOut } = useAuthContext();
  const router = useRouter();

  // Mutations
  const requestDeletion = useMutation(api.users.requestAccountDeletion);
  const cancelDeletion = useMutation(api.users.cancelAccountDeletion);

  // Snapshot "now" once at mount via a lazy state initializer. Date.now() is
  // impure and the React Compiler forbids calling it during render (incl. inside
  // useMemo); reading it in the initializer keeps it out of the render path while
  // preserving behavior (the scheduled-deletion check used a single now() read).
  const [nowMs] = useState(() => Date.now());

  // Check if deletion is scheduled
  const isDeletionScheduled =
    profile.deletedAt !== undefined && profile.deletedAt > nowMs;
  const deletionDate = profile.deletedAt
    ? new Date(profile.deletedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // Handle account deletion request
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== DELETE_CONFIRMATION_TEXT) {
      toast.error(`Please type "${DELETE_CONFIRMATION_TEXT}" to confirm`);
      return;
    }

    setIsDeleting(true);
    try {
      await requestDeletion({});
      toast.success(
        `Account deletion scheduled. You have ${GRACE_PERIOD_DAYS} days to cancel. Sign in and go to Settings to cancel.`
      );
      setConfirmDeleteOpen(false);
      setDeleteConfirmation("");

      // Begin sign-out process to prevent query errors and show overlay
      beginSignOut();
      try {
        await signOut();
        router.push("/login");
      } catch (signOutError) {
        console.error("Failed to sign out after deletion:", signOutError);
        captureError(signOutError);
        cancelSignOut();
        // Still redirect since account is deleted
        router.push("/login");
      }
    } catch (error) {
      console.error("Failed to request account deletion:", error);
      captureError(error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to request account deletion";
      toast.error(message);
      // Note: Don’t call cancelSignOut() here - beginSignOut() hasn’t been called yet
      // because we only reach this catch if requestDeletion() fails
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle cancel deletion
  const handleCancelDeletion = async () => {
    try {
      await cancelDeletion({});
      toast.success("Account deletion cancelled");
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Couldn’t cancel the deletion. Try again.",
      });
    }
  };

  // Reset confirmation when dialog closes
  const handleDialogOpenChange = (open: boolean) => {
    setConfirmDeleteOpen(open);
    if (!open) {
      setDeleteConfirmation("");
    }
  };

  // Handle full account data export (DSAR)
  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await convex.query(api.dataExport.getFullAccountData, {});
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `perm-tracker-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Account data exported");
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Couldn’t export your account data. Try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const helpRow =
    "flex min-h-11 items-center justify-between gap-4 border-b border-border py-3 text-sm last:border-b-0 hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-8">
      <SettingsCard title="Help and support" description="Get help, report issues, or suggest new features">
        <ul className="border-y border-border">
          <li>
            <a href={`mailto:${SUPPORT_EMAIL}`} target="_blank" rel="noopener noreferrer" className={helpRow}>
              <span className="font-medium">Contact support</span>{" "}
              <span className="text-muted-foreground">{SUPPORT_EMAIL}</span>
            </a>
          </li>{" "}
          <li>
            <a href={BUG_REPORT_URL} target="_blank" rel="noopener noreferrer" className={helpRow}>
              <span className="font-medium">Report a bug</span>{" "}
              <span className="text-muted-foreground">By email</span>
            </a>
          </li>{" "}
          <li>
            <a href={FEATURE_REQUEST_URL} target="_blank" rel="noopener noreferrer" className={helpRow}>
              <span className="font-medium">Request feature</span>{" "}
              <span className="text-muted-foreground">By email</span>
            </a>
          </li>{" "}
          <li>
            <button
              type="button"
              onClick={async () => {
                setIsRestarting(true);
                try {
                  await restartTour();
                  router.push("/dashboard");
                } finally {
                  setIsRestarting(false);
                }
              }}
              disabled={isRestarting}
              className={`${helpRow} w-full text-left disabled:cursor-not-allowed disabled:text-muted-foreground`}
            >
              <span className="font-medium">{isRestarting ? "Starting..." : "Replay tour"}</span>{" "}
              <span className="text-muted-foreground">Product walkthrough</span>
            </button>
          </li>
        </ul>
      </SettingsCard>

      <SettingsCard
        title="Your data"
        description="Download all your account data as a JSON file, including your profile, cases, conversations, notifications, and audit logs."
      >
        <Button
          variant="outline"
          onClick={handleExportData}
          disabled={isExporting}
          loading={isExporting}
          loadingText="Exporting..."
        >
          <DownloadIcon className="size-4" aria-hidden="true" />
          Download everything (.json)
        </Button>
      </SettingsCard>

      <AnalyticsToggle />

      <SettingsCard
        title="Delete account"
        tone="danger"
        description={`Permanently delete your account and all associated data. This action has a ${GRACE_PERIOD_DAYS}-day grace period before becoming irreversible.`}
      >
        {isDeletionScheduled && (
          <div className="space-y-3 border border-data-warn p-4 text-data-warn-ink">
            <div>
              <p className="text-sm font-medium">Deletion scheduled</p>{" "}
              <p className="text-sm">Your account will be permanently deleted on {deletionDate}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleCancelDeletion}>
                Cancel deletion
              </Button>
              <Button variant="destructive" onClick={() => setDeleteNowOpen(true)}>
                Delete now
              </Button>
            </div>
          </div>
        )}

        <Button
          variant="destructive"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={isDeletionScheduled}
        >
          {isDeletionScheduled ? "Deletion pending" : "Delete account"}
        </Button>
      </SettingsCard>

      <p className="border-t border-border pt-6 text-sm text-muted-foreground">
        PERM Tracker v{appVersion}. &copy; {`${currentYear} ${LEGAL_NAME}`}
      </p>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive-text">Delete your account</DialogTitle>
            <DialogDescription asChild>
              <div className="text-muted-foreground text-sm space-y-3 pt-2">
                <p>
                  This will schedule your account for permanent deletion. You’ll
                  have <strong>{GRACE_PERIOD_DAYS} days</strong> to cancel this
                  action.
                </p>{" "}
                <p>After the grace period, the following will be permanently deleted:</p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  <li>All your PERM cases and related data</li>{" "}
                  <li>Notification preferences and history</li>{" "}
                  <li>Calendar sync settings</li>{" "}
                  <li>Your user profile</li>
                </ul>
                <p className="font-medium">
                  To confirm, type{" "}
                  <span className="bg-muted px-1.5 py-0.5 font-medium text-foreground">
                    {DELETE_CONFIRMATION_TEXT}
                  </span>{" "}
                  below:
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Input
              id="delete-confirmation"
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={`Type ${DELETE_CONFIRMATION_TEXT} to confirm`}
              className={
                deleteConfirmation === DELETE_CONFIRMATION_TEXT
                  ? "border-destructive focus:ring-destructive"
                  : ""
              }
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={
                deleteConfirmation !== DELETE_CONFIRMATION_TEXT || isDeleting
              }
              loading={isDeleting}
              loadingText="Deleting..."
            >
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Now Dialog */}
      <DeleteNowDialog open={deleteNowOpen} onOpenChange={setDeleteNowOpen} />
    </div>
  );
}
