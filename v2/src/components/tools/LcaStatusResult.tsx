import Link from "next/link";
import { lookupLcaCase, lookupLcaDisclosed, type LcaDisclosedRow, type LcaRow } from "@/lib/turso/lcaCasesTypes";
import { formatWage } from "@/lib/wageFormat";

/**
 * A labor condition application (ETA-9035) by number: DOL's own status,
 * the employer and title it names, and what an LCA status means.
 *
 * No queue panel, on purpose. DOL's stated target for an LCA is seven
 * business days, so "where does it sit in the line" is not the question;
 * "is it certified yet, and is this the employer and title I expected" is.
 */

function prettyStatus(s: string): string {
  const u = s.trim().toUpperCase();
  if (u === "IN PROCESS") return "In process";
  return u.charAt(0) + u.slice(1).toLowerCase();
}

function chipClass(row: LcaRow): string {
  const u = row.status.toUpperCase();
  if (u.startsWith("CERTIFIED")) return "bg-primary text-primary-foreground";
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

/** The decided record from DOL's quarterly LCA file: what the live endpoint never says. */
function Disclosed({ d }: { d: LcaDisclosedRow }) {
  const wage = formatWage(d.wage, d.wageUnit);
  return (
    <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
      <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
        DOL&apos;s record · from the quarterly disclosure file
      </p>{" "}
      {wage ? <p className="mt-2 font-heading text-3xl font-black sm:text-4xl">{wage}</p> : null}{" "}
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-base sm:grid-cols-2 [&>*]:min-w-0">
        <div>
          <dt className="text-sm font-bold text-foreground/70">{wage ? "Wage offered" : "Wage"}</dt>{" "}
          <dd className="font-medium">{wage ?? "Not in the file"}</dd>
        </div>{" "}
        {d.socTitle || d.socCode ? (
          <div>
            <dt className="text-sm font-bold text-foreground/70">Occupation</dt>{" "}
            <dd className="font-medium">
              {d.socTitle ?? "Not given"}
              {d.socCode ? <span className="font-mono text-sm text-foreground/70"> · {d.socCode}</span> : null}
            </dd>
          </div>
        ) : null}{" "}
        {d.worksiteState ? (
          <div>
            <dt className="text-sm font-bold text-foreground/70">Worksite state</dt>{" "}
            <dd className="font-medium">{d.worksiteState}</dd>
          </div>
        ) : null}{" "}
        {d.visaClass ? (
          <div>
            <dt className="text-sm font-bold text-foreground/70">Visa class</dt>{" "}
            <dd className="font-medium">{d.visaClass}</dd>
          </div>
        ) : null}{" "}
        <div>
          <dt className="text-sm font-bold text-foreground/70">Received by DOL</dt>{" "}
          <dd className="font-medium">{day(d.receivedDate) ?? "Unknown"}</dd>
        </div>{" "}
        <div>
          <dt className="text-sm font-bold text-foreground/70">Decided</dt>{" "}
          <dd className="font-medium">{day(d.decisionDate) ?? "Unknown"}</dd>
        </div>
      </dl>
    </section>
  );
}

export async function LcaLookup({ caseNumber }: { caseNumber: string }) {
  const [row, disclosed] = await Promise.all([
    lookupLcaCase(caseNumber).catch(() => null),
    lookupLcaDisclosed(caseNumber).catch(() => null),
  ]);

  if (!row && disclosed) {
    return (
      <div className="space-y-6">
        <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Labor condition application · ETA-9035
          </p>{" "}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="font-heading text-2xl font-black sm:text-3xl">{disclosed.caseNumber}</h2>{" "}
            <span className="border-2 border-border bg-primary px-2 py-0.5 font-mono text-xs font-bold uppercase text-primary-foreground">
              {prettyStatus(disclosed.status)}
            </span>
          </div>{" "}
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-base sm:grid-cols-2 [&>*]:min-w-0">
            <div>
              <dt className="text-sm font-bold text-foreground/70">Employer</dt>{" "}
              <dd className="font-medium">
                {disclosed.employerName ? (
                  <Link href={`/lca-cases?q=${encodeURIComponent(disclosed.employerName)}`} className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                    {disclosed.employerName}
                  </Link>
                ) : (
                  "Not given"
                )}
              </dd>
            </div>{" "}
            <div>
              <dt className="text-sm font-bold text-foreground/70">Job title</dt>{" "}
              <dd className="font-medium">{disclosed.jobTitle ?? "Not given"}</dd>
            </div>
          </dl>{" "}
          <p className="mt-4 text-sm leading-relaxed text-foreground/70">
            DOL&apos;s live case system didn&apos;t return this number; the record
            above is from its quarterly disclosure file, which lists decided
            LCAs only.
          </p>
        </section>
        <Disclosed d={disclosed} />
      </div>
    );
  }

  if (!row) {
    return (
      <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Labor condition application
        </p>{" "}
        <h2 className="mt-2 font-heading text-2xl font-black">No record under {caseNumber}</h2>{" "}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
          DOL&apos;s case system returned nothing for this number, or didn&apos;t
          answer in time. Check it on{" "}
          <a
            href="https://flag.dol.gov/case-status-search"
            className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            rel="noopener"
          >
            DOL&apos;s case status page
          </a>
          , or find it by employer on the{" "}
          <Link href="/lca-cases" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            LCA search
          </Link>
          .
        </p>
      </section>
    );
  }

  const u = row.status.toUpperCase();
  return (
    <div className="space-y-6">
      <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Labor condition application · ETA-9035
        </p>{" "}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-black sm:text-3xl">{row.caseNumber}</h2>{" "}
          <span className={"border-2 border-border px-2 py-0.5 font-mono text-xs font-bold uppercase " + chipClass(row)}>
            {prettyStatus(row.status)}
          </span>
        </div>{" "}
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-base sm:grid-cols-2 [&>*]:min-w-0">
          <div>
            <dt className="text-sm font-bold text-foreground/70">Employer</dt>{" "}
            <dd className="font-medium">
              {row.employerName ? (
                <Link
                  href={`/lca-cases?q=${encodeURIComponent(row.employerName)}`}
                  className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  {row.employerName}
                </Link>
              ) : (
                "Not given"
              )}
            </dd>
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

      {disclosed ? <Disclosed d={disclosed} /> : null}

      <section className="border-2 border-border bg-tint-primary p-5 sm:p-6">
        <h3 className="font-heading text-xl font-black">What this status means</h3>{" "}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
          {u === "IN PROCESS"
            ? "DOL is reviewing it. Its target is seven business days from filing, and most LCAs are certified within that."
            : u.startsWith("CERTIFIED")
              ? "DOL has certified the wage and working-condition attestations. The employer can now file the H-1B petition, which gets its own USCIS receipt number."
              : u === "WITHDRAWN"
                ? "The employer withdrew it before a decision. A withdrawal isn't a denial. Employers often refile with corrected details."
                : u === "DENIED"
                  ? "DOL found a problem with the attestations. Employers usually correct and refile. Ask the employer or attorney what happens next."
                  : "DOL's status for this case, as shown on its own case status page."}
        </p>
      </section>
    </div>
  );
}
