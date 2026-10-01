import { DolUnanswered } from "@/components/tools/DolUnanswered";
import { CaseAlertForm } from "@/components/tools/CaseAlertForm";
import { lookupSeasonalCaseOutcome, type SeasonalRow } from "@/lib/turso/seasonalCasesTypes";
import { isLookupGap } from "@/lib/dolMiss";

/**
 * An H-2A application (`H-300-`), an H-2B application (`H-400-`) or an H-2B
 * prevailing wage request (`P-400-`) by number: DOL's own status, the
 * employer and title it names, and what the status means.
 *
 * Found on FLAG's counter on Oct 1 2026. Before that, these numbers reached
 * the PERM or PWD lookup and came back "no record", or worse, an H-2B wage
 * request was filed under the ETA-9141 queue PERM waits in.
 */

const FORM: Record<string, string> = {
  "H-300-": "H-2A application · ETA-9142A",
  "H-400-": "H-2B application · ETA-9142B",
  "P-400-": "H-2B prevailing wage request",
};

function formOf(caseNumber: string): string {
  return FORM[caseNumber.slice(0, 6)] ?? "H-2A or H-2B filing";
}

function prettyStatus(s: string): string {
  const u = s.trim().toUpperCase();
  // DOL's acronyms stay capitals; everything else reads as a sentence.
  const lower = u.charAt(0) + u.slice(1).toLowerCase();
  return lower.replace(/\b(nod|nor|nrm|rfi)\b/gi, (m) => m.toUpperCase());
}

function chipClass(row: SeasonalRow): string {
  const u = row.status.toUpperCase();
  if (u === "FULL CERTIFICATION" || u === "PARTIAL CERTIFICATION" || u === "DETERMINATION ISSUED") {
    return "bg-primary text-primary-foreground";
  }
  if (u === "DENIED") return "bg-foreground text-background";
  return row.isFinal ? "bg-card" : "bg-tint-primary";
}

function day(iso: string | null): string | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;
}

/**
 * What a status means, in one sentence. Only statuses whose meaning is in
 * DOL's own rules get one (a Notice of Deficiency is 20 CFR 655.141 for H-2A
 * and 655.31 for H-2B); NRM and NOR fall to the neutral line until read
 * from DOL's own text.
 */
function meaning(status: string): string {
  const u = status.trim().toUpperCase();
  if (u === "IN PROCESS") return "DOL is reviewing it.";
  if (u === "ACCEPTED - PENDING RECRUITMENT")
    return "DOL accepted the application for processing; the employer is recruiting U.S. workers before a decision.";
  if (u === "NOD ISSUED") return "DOL sent a Notice of Deficiency: the employer has to correct the application before it can go on.";
  if (u === "RFI ISSUED") return "DOL asked the employer for more information.";
  if (u.startsWith("PENDING")) return "The case is under review at a later stage, an appeal or a Center Director review.";
  if (u === "FULL CERTIFICATION") return "DOL certified every position the employer asked for. The employer can now petition USCIS.";
  if (u === "PARTIAL CERTIFICATION") return "DOL certified some of the positions asked for, not all.";
  if (u.endsWith("- EXPIRED")) return "The certification was granted and its validity has since run out.";
  if (u.endsWith("- WITHDRAWN") || u === "WITHDRAWN") return "The employer withdrew it. A withdrawal isn't a denial.";
  if (u === "DETERMINATION ISSUED") return "DOL issued the prevailing wage the employer must offer.";
  if (u === "DENIED") return "DOL denied it. Ask the employer or its attorney what happens next.";
  if (u === "RETURNED UNPROCESSED") return "DOL returned it without a decision, usually for a missing piece.";
  return "DOL's status for this case, as shown on its own case status page.";
}

export async function SeasonalLookup({ caseNumber }: { caseNumber: string }) {
  const { row, dolMiss } = await lookupSeasonalCaseOutcome(caseNumber).catch(() => ({
    row: null,
    dolMiss: "records" as const,
  }));
  const form = formOf(caseNumber);

  if (!row && isLookupGap(dolMiss)) {
    return <DolUnanswered caseNumber={caseNumber} label={form} miss={dolMiss} />;
  }

  if (!row) {
    return (
      <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">{form}</p>{" "}
        <h2 className="mt-2 font-heading text-2xl font-black">No record under {caseNumber}</h2>{" "}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
          DOL&apos;s case system answered and holds nothing under this number. Check it on{" "}
          <a
            href="https://flag.dol.gov/case-status-search"
            className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            rel="noopener"
          >
            DOL&apos;s case status page
          </a>
          .
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">{form}</p>{" "}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-black sm:text-3xl" translate="no">{row.caseNumber}</h2>{" "}
          <span className={"border-2 border-border px-2 py-0.5 font-mono text-xs font-bold uppercase " + chipClass(row)}>
            {prettyStatus(row.status)}
          </span>
        </div>{" "}
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-base sm:grid-cols-2 [&>*]:min-w-0">
          <div>
            <dt className="text-sm font-bold text-foreground/70">Employer</dt>{" "}
            <dd className="font-medium" translate="no">{row.employerName ?? "Not given"}</dd>
          </div>{" "}
          <div>
            <dt className="text-sm font-bold text-foreground/70">Job title</dt>{" "}
            <dd className="font-medium">{row.jobTitle ?? "Not given"}</dd>
          </div>{" "}
          <div>
            <dt className="text-sm font-bold text-foreground/70">Filed with DOL</dt>{" "}
            <dd className="font-medium">{day(row.submittedDate) ?? day(row.filingDate) ?? "Unknown"}</dd>
          </div>{" "}
          <div>
            <dt className="text-sm font-bold text-foreground/70">Last checked against DOL</dt>{" "}
            <dd className="font-medium">{day(row.lastCheckedAt) ?? "Today"}</dd>
          </div>
        </dl>
      </section>

      {!row.isFinal ? <CaseAlertForm caseNumber={row.caseNumber} program="seasonal" /> : null}

      <section className="border-2 border-border bg-tint-primary p-5 sm:p-6">
        <h3 className="font-heading text-xl font-black">What this status means</h3>{" "}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">{meaning(row.status)}</p>
      </section>
    </div>
  );
}
