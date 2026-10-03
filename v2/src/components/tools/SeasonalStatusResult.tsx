import Link from "next/link";
import { DolUnanswered } from "@/components/tools/DolUnanswered";
import { CaseAlertForm } from "@/components/tools/CaseAlertForm";
import { lookupSeasonalCaseOutcome, type SeasonalRow } from "@/lib/turso/seasonalCasesTypes";
import { isLookupGap } from "@/lib/dolMiss";
import { SEASONAL_STATUSES, statusAnchor } from "@/lib/statusDictionary";
import { seasonalForm } from "@/lib/seasonalForms";

/**
 * An H-2A application (`H-300-`), an H-2B application (`H-400-`) or an H-2B
 * prevailing wage request (`P-400-`) by number: DOL's own status, the
 * employer and title it names, and what the status means.
 *
 * Routed here by prefix, so these numbers never reach the PERM or PWD lookup,
 * where they would come back "no record" or, worse, an H-2B wage request
 * would be filed under the ETA-9141 queue PERM waits in.
 */

/** The form, named from the one list every seasonal surface reads (src/lib/seasonalForms.ts). */
function formOf(caseNumber: string): string {
  const f = seasonalForm(caseNumber);
  return f ? `${f.label} · ${f.form}` : "H-2A, H-2B or CW-1 filing";
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
 * What a status means: the status dictionary's own entry, so the lookup and
 * /perm-case-statuses cannot say two things about one word. Each entry there
 * carries a 20 CFR 655 cite or says DOL publishes no definition.
 */
function entryFor(status: string) {
  const u = status.trim().toUpperCase();
  return SEASONAL_STATUSES.find((e) => e.status.toUpperCase() === u) ?? null;
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
        <p className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">{form}</p>{" "}
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

  const entry = entryFor(row.status);
  return (
    <div className="space-y-6">
      <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <p className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">{form}</p>{" "}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-black sm:text-3xl" translate="no">{row.caseNumber}</h2>{" "}
          <span className={"border-2 border-border px-2 py-0.5 font-mono text-sm font-bold uppercase " + chipClass(row)}>
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
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
          {entry?.summary ?? "DOL's status for this case, as shown on its own case status page."}
        </p>{" "}
        {entry ? (
          <p className="mt-2 text-sm text-foreground/70">
            <Link
              href={`/perm-case-statuses#h2-${statusAnchor(entry.status)}`}
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              The rule behind it, and how many cases carry it
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
