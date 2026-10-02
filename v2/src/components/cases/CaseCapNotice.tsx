"use client";

/**
 * Says so when an account holds more cases than one read returns.
 *
 * Every signed-in list of cases (the case list, dashboard, calendar,
 * timeline) reads the newest USER_CASES_MAX live cases (convex/lib/userCases.ts).
 * This renders nothing for an account under the
 * ceiling, which is every account today.
 */
import { useQuery } from "convex/react";
import { InfoIcon } from "@phosphor-icons/react";
import { api } from "@convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { USER_CASES_MAX } from "@convex/lib/userCases";

export function CaseCapNotice({
  className,
  truncated,
}: {
  className?: string;
  /** Pass it when the page already knows (the case list's own read says so). */
  truncated?: boolean;
}) {
  const { isSigningOut } = useAuthContext();
  const coverage = useQuery(
    api.cases.readCoverage,
    isSigningOut || truncated !== undefined ? "skip" : {}
  );
  const isTruncated = truncated ?? coverage?.truncated ?? false;
  if (!isTruncated) return null;
  const max = (coverage?.max ?? USER_CASES_MAX).toLocaleString();
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 border-2 border-border bg-card px-4 py-3 text-sm text-foreground shadow-hard-sm",
        className
      )}
    >
      <InfoIcon className="mt-0.5 size-4 shrink-0" weight="bold" aria-hidden="true" />
      <span className="min-w-0">
        Your account holds more than {max} cases, and this page shows the newest {max}. Older
        cases are saved and unchanged. To reach them, email{" "}
        <a className="font-semibold underline" href="mailto:support@permtracker.app?subject=More%20than%20the%20case%20list%20shows">
          support@permtracker.app
        </a>
        .
      </span>
    </p>
  );
}
