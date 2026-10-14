import { DOL_CASE_STATUS_URL } from "@/components/queue/SourceNote";
import { cn } from "@/lib/utils";

/**
 * The source of a list of filings DOL hasn't published yet, inside the list's
 * own box, so a screenshot of the box carries it. Readers seeing pending cases
 * months before DOL's quarterly files asked where they came from: DOL's own
 * case-status service, where anyone can look the same numbers up.
 */
export function FromDolLive({ className }: { className?: string }) {
  return (
    <p className={cn("mt-4 border-t border-border pt-3 text-sm text-muted-foreground", className)}>
      Source: DOL&apos;s own case-status service,{" "}
      <a
        href={DOL_CASE_STATUS_URL}
        className="link"
      >
        flag.dol.gov
      </a>
      , where any of these numbers can be looked up. A filing shows there soon after it&apos;s made, months before
      DOL&apos;s quarterly files.
    </p>
  );
}
