import Link from "next/link";
import { DolUnanswered } from "@/components/tools/DolUnanswered";
import { CaseAlertForm } from "@/components/tools/CaseAlertForm";
import {
  lookupSeasonalCaseOutcome,
  lookupSeasonalPosting,
  lookupSeasonalRecord,
  type SeasonalPosting,
  type SeasonalRecord,
  type SeasonalRow,
} from "@/lib/turso/seasonalCasesTypes";
import {
  h2aDecideBy,
  publishedGranted,
  publishedStatusLabel,
  wagePhrase,
  worksitePhrase,
} from "@/lib/seasonalDetails";
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

const LINK = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-sm font-bold text-foreground/70">{label}</dt>{" "}
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function workersPhrase(requested: number | null, certified: number | null): string | null {
  if (requested === null && certified === null) return null;
  const req = requested === null ? null : `${requested.toLocaleString("en-US")} requested`;
  const cert = certified === null ? null : `${certified.toLocaleString("en-US")} certified`;
  return [req, cert].filter(Boolean).join(", ");
}

function periodPhrase(begin: string | null, end: string | null): string | null {
  const a = day(begin);
  const b = day(end);
  if (a && b) return `${a} to ${b}`;
  return a ? `From ${a}` : b ? `Until ${b}` : null;
}

/**
 * What DOL published about the case (its quarterly file) and the job as DOL
 * accepted it (SeasonalJobs), the two places the wage, the workers, the work
 * period and the worksite live; the live status carries none of them.
 */
function SeasonalDetails({
  record,
  posting,
  pending,
  caseNumber,
}: {
  record: SeasonalRecord | null;
  posting: SeasonalPosting | null;
  pending: boolean;
  caseNumber: string;
}) {
  if (!record && !posting) return null;
  const firstDay = record?.beginDate ?? posting?.beginDate ?? null;
  const decideBy = pending && /^H-300-/.test(caseNumber) ? h2aDecideBy(firstDay) : null;
  return (
    <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
      <h3 className="font-heading text-xl font-black">
        {record ? "DOL's published record" : "The job, as DOL accepted it"}
      </h3>{" "}
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-base sm:grid-cols-2 [&>*]:min-w-0">
        {record ? (
          <>
            <Field label="Decision" value={publishedStatusLabel(record.status)} />{" "}
            <Field label="Decided" value={day(record.decisionDate)} />{" "}
          </>
        ) : null}
        <Field label="Wage offered" value={wagePhrase(record?.wage ?? posting?.wage ?? null, record?.wageUnit ?? posting?.wageUnit ?? null)} />{" "}
        <Field
          label="Workers"
          value={workersPhrase(record?.workers ?? posting?.workersForeign ?? null, record?.workersCertified ?? null)}
        />{" "}
        <Field label="Work period" value={periodPhrase(firstDay, record?.endDate ?? posting?.endDate ?? null)} />{" "}
        <Field
          label="Worksite"
          value={worksitePhrase(
            record?.worksiteCity ?? posting?.worksiteCity ?? null,
            record?.worksiteCounty ?? posting?.worksiteCounty ?? null,
            record?.worksiteState ?? posting?.worksiteState ?? null,
          )}
        />{" "}
        <Field label="Occupation" value={record?.socTitle ?? null} />{" "}
        <Field label="Law firm or agent" value={record?.attorneyName ?? null} />{" "}
        {!record && posting ? <Field label="Accepted by DOL" value={day(posting.acceptedDate)} /> : null}{" "}
        {posting?.jobOrderNumber ? <Field label="Job order" value={posting.jobOrderNumber} /> : null}{" "}
        {posting?.pwdNumber ? <Field label="Wage determination" value={posting.pwdNumber} /> : null}
      </dl>{" "}
      {decideBy ? (
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/85">
          By rule DOL decides an H-2A application no later than 30 days before the first day of work, so this one by{" "}
          <span className="font-bold">{day(decideBy)}</span>, unless the application was modified (
          <a href="https://www.ecfr.gov/current/title-20/chapter-V/part-655/section-655.160" className={LINK} rel="noopener">
            20 CFR 655.160
          </a>
          ).
        </p>
      ) : null}{" "}
      <p className="mt-4 text-sm text-foreground/70">
        {record
          ? `From DOL's quarterly ${record.visaClass ?? "disclosure"} file${record.sourceFile ? ` (${record.sourceFile})` : ""}.`
          : "From DOL's SeasonalJobs feed, which lists applications it has accepted. The decision comes later."}
      </p>
    </section>
  );
}

export async function SeasonalLookup({ caseNumber }: { caseNumber: string }) {
  const [outcome, record, posting] = await Promise.all([
    lookupSeasonalCaseOutcome(caseNumber).catch(() => ({ row: null, dolMiss: "records" as const })),
    lookupSeasonalRecord(caseNumber).catch(() => null),
    lookupSeasonalPosting(caseNumber).catch(() => null),
  ]);
  const { row, dolMiss } = outcome;
  const form = formOf(caseNumber);

  if (!row && record) {
    // In DOL's published file but not in the live table: the file is the
    // record. The shared lookup returns no live row for exactly this case,
    // so without this branch the page would say "no record".
    const granted = publishedGranted(record.status);
    return (
      <div className="space-y-6">
        <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
          <p className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">{form}</p>{" "}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="font-heading text-2xl font-black sm:text-3xl" translate="no">{record.caseNumber}</h2>{" "}
            <span
              className={
                "border-2 border-border px-2 py-0.5 font-mono text-sm font-bold uppercase " +
                (granted ? "bg-primary text-primary-foreground" : "bg-muted")
              }
            >
              {publishedStatusLabel(record.status)}
            </span>
          </div>{" "}
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-base sm:grid-cols-2 [&>*]:min-w-0">
            <Field label="Employer" value={record.employerName ?? "Not given"} />{" "}
            <Field label="Job title" value={record.jobTitle ?? "Not given"} />{" "}
            <Field label="Received by DOL" value={day(record.receivedDate)} />{" "}
          </dl>
        </section>{" "}
        <SeasonalDetails record={record} posting={posting} pending={false} caseNumber={record.caseNumber} />
      </div>
    );
  }

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

      <SeasonalDetails record={record} posting={posting} pending={!row.isFinal} caseNumber={row.caseNumber} />{" "}

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
