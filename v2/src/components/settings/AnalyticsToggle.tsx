"use client";

/**
 * AnalyticsToggle
 *
 * Settings switch for usage analytics. The choice is saved on the account
 * (users.setAnalyticsOff), so it follows the account to every browser it signs
 * in on: LoginTracker reads users.isPostHogExcluded, which is true for an
 * account that switched it off, and turns that browser off (analytics.optOut).
 * Off means the browser sends PostHog nothing, the same path staff accounts
 * and the Global Privacy Control signal take.
 *
 * The switch also acts on this browser at once, so nothing is sent between
 * the click and the query updating.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ChartBarIcon } from "@phosphor-icons/react/ssr";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { analytics, isGpcEnabled } from "@/lib/analytics";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { handleOperationError } from "@/lib/errors";

export default function AnalyticsToggle() {
  const { isSigningOut } = useAuthContext();
  const [isUpdating, setIsUpdating] = useState(false);
  const profile = useQuery(api.users.currentUserProfile, isSigningOut ? "skip" : undefined);
  const setAnalyticsOff = useMutation(api.users.setAnalyticsOff);

  const isOn = profile ? profile.analyticsOff !== true : true;
  const gpc = isGpcEnabled();

  const handleToggle = async (checked: boolean) => {
    setIsUpdating(true);
    // Off takes effect in this browser before the save, so no event slips out.
    if (!checked) analytics.optOut();
    try {
      await setAnalyticsOff({ off: !checked });
      if (checked) {
        analytics.optIn();
        analytics.consentForAccount();
      }
    } catch (error) {
      if (!checked) analytics.optIn();
      handleOperationError(error, {
        userMessage: "Couldn’t save the analytics setting. Try again.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (profile === undefined) {
    return (
      <div className="border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-hard)" }}>
        <Skeleton variant="line" className="mb-4 h-6 w-1/3" />
        <Skeleton variant="line" className="h-4 w-2/3" />
      </div>
    );
  }

  return (
    <div className="border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-hard)" }}>
      <div className="mb-2 flex items-center gap-2">
        <ChartBarIcon className="h-5 w-5 text-foreground" />
        <h3 className="font-heading text-lg font-bold text-foreground">Usage analytics</h3>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <Label
            htmlFor="analytics-toggle"
            className="cursor-pointer text-base font-medium text-foreground"
          >
            Share how I use the app
          </Label>
          <p id="analytics-description" className="mt-1 text-sm text-muted-foreground">
            The pages you open and what you click, linked to your account, so we
            can see what works and what doesn’t. Switch it off and your browser
            sends our analytics service (PostHog) nothing at all, on every
            device you sign in on.
          </p>
        </div>
        <Switch
          id="analytics-toggle"
          checked={isOn && !gpc}
          onCheckedChange={handleToggle}
          disabled={isUpdating || gpc}
          aria-describedby="analytics-description"
        />
      </div>
      {gpc ? (
        <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
          Your browser sends the Global Privacy Control signal, so it already
          sends no analytics, whatever this switch says.
        </p>
      ) : null}
    </div>
  );
}
