import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The credit O*NET's licence asks for, wherever its words are shown (CC BY 4.0: attribution, the licence, and
 * a statement of what was changed). `note` names what this page changed.
 */
export function OnetCredit({ version, note, className }: { version?: string | null; note: string; className?: string }) {
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
