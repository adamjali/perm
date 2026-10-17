"use client";

// `convex/react` is a CLIENT-ONLY module: its hooks reach `React.createContext`,
// which exists only in React's client build. Declared here rather
// than inherited from whichever importer happened to cross a boundary first.
// Without it this module works until the chunk graph shifts, then fails with
// `TypeError: (0 , d.createContext) is not a function` naming webpack bootstrap
// and no source file. See components/layout/Footer.tsx.

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
import { api } from "@convex/_generated/api";
import { Switch } from "@/components/ui/switch";
import { SettingsCard, SettingsCardSkeleton } from "./SettingsCard";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { analytics } from "@/lib/analytics";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { handleOperationError } from "@/lib/errors";
import { Skeleton } from "@/components/ui/skeleton";

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
      analytics.capture("deadline_enforcement_toggled", { enabled: checked });
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Couldn’t save the deadline enforcement setting. Try again.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Show loading state while profile loads
  if (profile === undefined) {
    return (
      <SettingsCardSkeleton>
        <Skeleton variant="line" className="h-6 w-1/3" />
        <Skeleton variant="line" className="h-4 w-2/3" />
      </SettingsCardSkeleton>
    );
  }

  return (
    <SettingsCard
      title="Deadline enforcement"
      description="Close cases on their own when a deadline that ends them has passed."
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <Label htmlFor="deadline-enforcement-toggle" className="text-sm font-medium text-foreground">
            Auto-close cases with expired deadlines
          </Label>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEnabled
              ? "On. Cases are checked each time you sign in."
              : "Off. Cases stay open whatever their deadlines."}
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

      <div id="enforcement-description" className="text-sm text-muted-foreground">
        <p className="font-medium text-foreground">What it does</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Cases are closed when the PWD expires before ETA 9089 filing, unless recruitment began while it was valid</li>{" "}
          <li>Cases are closed when filing windows pass without action</li>{" "}
          <li>You&apos;ll see a notification when cases are auto-closed</li>{" "}
          <li>Closed cases can still be viewed but not edited</li>
        </ul>
      </div>
    </SettingsCard>
  );
}
