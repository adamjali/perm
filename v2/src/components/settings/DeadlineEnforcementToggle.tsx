/**
 * DeadlineEnforcementToggle Component
 *
 * Settings toggle for enabling/disabling automatic deadline enforcement.
 * When enabled, cases with expired deadlines are automatically closed on login.
 *
 * @see /convex/deadlineEnforcement.ts - Backend enforcement logic
 * @see /perm_flow.md - Business rules for deadline enforcement
 */

"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Shield } from "lucide-react";
import { useState } from "react";
import { useAuthContext } from "@/lib/contexts/AuthContext";

export default function DeadlineEnforcementToggle() {
  const { isSigningOut } = useAuthContext();
  const [isUpdating, setIsUpdating] = useState(false);

  // Get current user profile for enforcement setting
  const profile = useQuery(
    api.users.currentUserProfile,
    isSigningOut ? "skip" : undefined
  );

  // Mutation to update the setting
  const updateProfile = useMutation(api.users.updateUserProfile);

  const isEnabled = profile?.autoDeadlineEnforcementEnabled ?? false;

  const handleToggle = async (checked: boolean) => {
    setIsUpdating(true);
    try {
      await updateProfile({
        autoDeadlineEnforcementEnabled: checked,
      });
    } catch (error) {
      console.error("Failed to update deadline enforcement setting:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Show loading state while profile loads
  if (profile === undefined) {
    return (
      <div className="bg-card border-2 border-black dark:border-white/20 p-6 animate-pulse" style={{ boxShadow: "4px 4px 0px #000" }}>
        <div className="h-6 bg-muted rounded w-1/3 mb-4" />
        <div className="h-4 bg-muted rounded w-2/3" />
      </div>
    );
  }

  return (
    <div
      className="bg-card border-2 border-black dark:border-white/20 p-6"
      style={{ boxShadow: "4px 4px 0px #000" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-foreground" />
        <h3 className="font-heading font-bold text-lg text-foreground">
          Deadline Enforcement
        </h3>
      </div>

      {/* Toggle row */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex-1">
          <Label
            htmlFor="deadline-enforcement-toggle"
            className="text-base font-medium text-foreground cursor-pointer"
          >
            Auto-close cases with expired deadlines
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            When enabled, cases will be automatically closed on login if critical
            deadlines have passed.
          </p>
        </div>
        <Switch
          id="deadline-enforcement-toggle"
          checked={isEnabled}
          onCheckedChange={handleToggle}
          disabled={isUpdating}
          aria-describedby="enforcement-description"
        />
      </div>

      {/* Warning message */}
      <div
        className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/50 rounded-sm"
        id="enforcement-description"
      >
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium mb-1">Important</p>
          <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-300">
            <li>Cases are closed when PWD expires before ETA 9089 filing</li>
            <li>Cases are closed when filing windows pass without action</li>
            <li>You&apos;ll see a notification when cases are auto-closed</li>
            <li>Closed cases can still be viewed but not edited</li>
          </ul>
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2 text-sm">
          <div
            className={`w-2 h-2 rounded-full ${
              isEnabled
                ? "bg-green-500 animate-pulse"
                : "bg-muted-foreground"
            }`}
          />
          <span className="text-muted-foreground">
            {isEnabled
              ? "Enforcement active - cases will be checked on login"
              : "Enforcement disabled - cases remain open regardless of deadlines"}
          </span>
        </div>
      </div>
    </div>
  );
}
