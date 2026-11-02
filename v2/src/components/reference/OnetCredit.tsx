import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The credit O*NET's licence asks for, wherever its words are shown (CC BY 4.0: attribution, the licence, and
 * a statement of what was changed). `note` names what this page changed. `compact` gives one line naming the
 * source, the licence and the change, with the full statement folded under it, for a panel inside a form.
 */
export function OnetCredit({
  version,
  note,
  compact = false,
  className,
}: {
  version?: string | null;
  note: string;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <details className={cn("max-w-3xl text-sm leading-relaxed text-muted-foreground", className)}>
        <summary className="inline-flex min-h-11 cursor-pointer items-center">
          From O*NET{version ? ` ${version}` : ""} by USDOL/ETA, under CC BY 4.0, modified ({note}).
        </summary>
        <FullCredit version={version} note={note} />
      </details>
    );
  }
  return <FullCredit version={version} note={note} className={className} />;
}

function FullCredit({ version, note, className }: { version?: string | null; note: string; className?: string }) {
  return (
    <p className={cn("max-w-3xl text-sm leading-relaxed text-muted-foreground", className)}>
      This section includes information from the{" "}
      <a href="https://www.onetcenter.org/database.html" className="link" rel="noopener">
        {`O*NET${version ? ` ${version}` : ""} Database`}
      </a>{" "}
      and O*NET OnLine by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used under
      the{" "}
      <a href="https://creativecommons.org/licenses/by/4.0/" className="link" rel="noopener license">
        CC BY 4.0 license
      </a>
      . O*NET® is a trademark of USDOL/ETA. PERM Tracker has modified some of this information ({note});{" "}
      <Link href="/methodology#onet" className="link">
        what changed
      </Link>
      . USDOL/ETA has not approved, endorsed, or tested these modifications.
    </p>
  );
}
