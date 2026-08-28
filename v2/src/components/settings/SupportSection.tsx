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
 *
 * Phase: 25 (Settings & Preferences)
 * Created: 2025-12-31
 * Updated: 2025-12-31 - Merged Account section (delete account functionality)
 */

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useMutation, useConvex } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAuthContext } from "@/lib/contexts/AuthContext";
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
import { ArrowSquareOut, Bug, Download, Envelope as Mail, Info, Lightbulb, Lightning as Zap, PlayCircle, Trash as Trash2, Warning as AlertTriangle } from "@phosphor-icons/react/ssr";
import { toast } from "@/lib/toast";
import { captureError } from "@/lib/sentry";
import { handleOperationError } from "@/lib/errors";
import { useOnboarding } from "@/components/onboarding/OnboardingProvider";
import DeleteNowDialog from "./DeleteNowDialog";
import {
  GITHUB_BUG_REPORT_URL,
  GITHUB_FEATURE_REQUEST_URL,
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
        userMessage: "Failed to cancel deletion",
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
      toast.success("Account data exported successfully");
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to export account data",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Help & Support Card */}
      <div
        className="bg-card border-2 border-border p-6"
        style={{ boxShadow: "var(--shadow-hard)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-5 h-5 text-foreground" />
          <h3 className="font-heading font-bold text-lg text-foreground">
            Help & Support
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Get help, report issues, or suggest new features
        </p>{" "}

        {/* Support Links Grid */}
        <div className="grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Contact Support */}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center gap-3 border-2 border-border bg-card p-4 shadow-hard-sm transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm"
          >
            <div className="p-3 bg-primary/10 border-2 border-primary/20 group-hover:bg-primary/20 transition-colors">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <span className="font-heading font-bold text-sm block flex items-center justify-center gap-1">
                Contact Support
                <ArrowSquareOut className="h-3 w-3 text-muted-foreground" />
              </span>{" "}
              <span className="text-xs text-muted-foreground">{SUPPORT_EMAIL}</span>
            </div>
          </a>{" "}

          {/* Report Bug */}
          <a
            href={GITHUB_BUG_REPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center gap-3 border-2 border-border bg-card p-4 shadow-hard-sm transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm"
          >
            <div className="p-3 bg-destructive/10 border-2 border-destructive/20 group-hover:bg-destructive/20 transition-colors">
              <Bug className="h-6 w-6 text-destructive" />
            </div>
            <div className="text-center">
              <span className="font-heading font-bold text-sm block flex items-center justify-center gap-1">
                Report a Bug
                <ArrowSquareOut className="h-3 w-3 text-muted-foreground" />
              </span>{" "}
              <span className="text-xs text-muted-foreground">
                GitHub Issues
              </span>
            </div>
          </a>{" "}

          {/* Request Feature */}
          <a
            href={GITHUB_FEATURE_REQUEST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center gap-3 border-2 border-border bg-card p-4 shadow-hard-sm transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm"
          >
            <div className="p-3 bg-yellow-500/10 border-2 border-yellow-500/20 group-hover:bg-yellow-500/20 transition-colors">
              <Lightbulb className="h-6 w-6 text-yellow-500" />
            </div>
            <div className="text-center">
              <span className="font-heading font-bold text-sm block flex items-center justify-center gap-1">
                Request Feature
                <ArrowSquareOut className="h-3 w-3 text-muted-foreground" />
              </span>{" "}
              <span className="text-xs text-muted-foreground">
                GitHub Issues
              </span>
            </div>
          </a>

          {/* Replay Tour */}
          <button
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
            className="group flex flex-col items-center gap-3 border-2 border-border bg-card p-4 shadow-hard-sm transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-hard-sm disabled:hover:translate-x-0 disabled:hover:translate-y-0"
          >
            <div className="p-3 bg-primary/10 border-2 border-primary/20 group-hover:bg-primary/20 transition-colors">
              {isRestarting ? (
                <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full" />
              ) : (
                <PlayCircle className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="text-center">
              <span className="font-heading font-bold text-sm block">
                {isRestarting ? "Starting..." : "Replay Tour"}
              </span>{" "}
              <span className="text-xs text-muted-foreground">
                Product walkthrough
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Data Export Card */}
      <div
        className="bg-card border-2 border-border p-6"
        style={{ boxShadow: "var(--shadow-hard)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Download className="w-5 h-5 text-foreground" />
          <h3 className="font-heading font-bold text-lg text-foreground">
            Your Data
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Download all your account data as a JSON file, including your profile,
          cases, conversations, notifications, and audit logs.
        </p>
        <Button
          variant="outline"
          onClick={handleExportData}
          disabled={isExporting}
          loading={isExporting}
          loadingText="Exporting..."
        >
          <Download className="w-4 h-4 mr-2" />
          Download everything (.json)
        </Button>
      </div>

      {/* Account Deletion Section */}
      <div
        className="bg-card border-2 border-destructive dark:border-destructive/50 p-6"
        style={{ boxShadow: "var(--shadow-hard)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="w-5 h-5 text-destructive" />
          <h3 className="font-heading font-bold text-lg text-destructive">
            Delete Account
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Permanently delete your account and all associated data. This action
          has a {GRACE_PERIOD_DAYS}-day grace period before becoming
          irreversible.
        </p>

        {/* Scheduled Deletion Warning */}
        <AnimatePresence>
          {isDeletionScheduled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-3 px-4 py-3 mb-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Deletion Scheduled</p>{" "}
                  <p className="text-xs">
                    Your account will be permanently deleted on {deletionDate}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelDeletion}
                >
                  Cancel Deletion
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteNowOpen(true)}
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Delete Now
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Button */}
        <Button
          variant="destructive"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={isDeletionScheduled}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {isDeletionScheduled ? "Deletion Pending" : "Delete Account"}
        </Button>
      </div>

      {/* App Info Card */}
      <div className="bg-muted/30 border border-border p-4">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span className="font-mono text-xs">PERM Tracker v{appVersion}</span>{" "}
          <span className="text-muted-foreground">|</span>{" "}
          <span className="text-xs">&copy; {currentYear} PERM Tracker</span>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Your Account
            </DialogTitle>
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
                  <span className="font-mono bg-muted px-1.5 py-0.5 border border-border">
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
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Now Dialog */}
      <DeleteNowDialog open={deleteNowOpen} onOpenChange={setDeleteNowOpen} />
    </div>
  );
}
