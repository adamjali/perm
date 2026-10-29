import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import type { SocCodesDoc } from "@/lib/db/socTitles";

/** Which files the titles come from, as dates a reader can check. */
export function spanText(spans: SocCodesDoc["spans"] | undefined): string {
  const parts: string[] = [];
  if (spans?.perm) parts.push(`PERM cases decided ${spans.perm.from} to ${spans.perm.to}`);
  if (spans?.pwd) parts.push(`wage requests and LCAs of fiscal years ${spans.pwd.fyFrom} to ${spans.pwd.fyTo}`);
  return parts.length ? ` (${parts.join("; ")})` : "";
}

/**
 * Where the job code finder's titles come from, and O*NET's credit line as its licence asks
 * (CC BY 4.0: the credit, the licence, what we changed). Every page that shows the titles ends
 * with it.
 */
export function SocSources({ codes }: { codes: SocCodesDoc | null }) {
  return (
    <>
      <p className="mt-10 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        The titles employers typed come from DOL&apos;s PERM, prevailing wage and LCA disclosure files{spanText(codes?.spans)}.
        This page also includes information from the{" "}
        <a href="https://www.onetcenter.org/database.html" className="link" rel="noopener">
          {`O*NET${codes?.onetRelease ? ` ${codes.onetRelease}` : ""} Database`}
        </a>{" "}
        by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used under the{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/" className="link" rel="noopener license">
          CC BY 4.0 license
        </a>
        . O*NET® is a trademark of USDOL/ETA. PERM Tracker has modified this information (its titles are matched to the
        titles in DOL&apos;s files);{" "}
        <Link href="/methodology#onet" className="link">
          what changed
        </Link>
        . USDOL/ETA has not approved, endorsed, or tested these modifications.
      </p>{" "}
      <DataProvenance datasets={["perm-cases", "pw-disclosure", "lca-disclosure", "onet"]} />
    </>
  );
}
