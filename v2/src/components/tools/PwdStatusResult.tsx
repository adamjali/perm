import Link from "next/link";
import { estimatePwdQueue } from "@/lib/perm";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import { getPwdEstimatorData } from "@/lib/turso/estimate";
import { lookupPwdCase, type PwdCaseRow } from "@/lib/turso/pwdCases";
import { currentMonthUtc } from "@/lib/dolFormat";
import { QueueAlertForm } from "@/app/(site)/(public)/perm-processing-times/QueueAlertForm";

/**
 * A prevailing wage request (ETA-9141) by number: DOL's own status for it,
 * and where its filing month sits in DOL's wage queue.
 *
 * The estimate half composes `estimatePwdQueue`, the same calculator the
 * PWD queue page uses, from the same DOL processing-times snapshot, so a
 * number here and a month picked on the calculator page cannot disagree.
 * DOL runs two wage queues (OEWS survey wages and everything else) and a
 * case record does not say which one it is in, so both frontiers are
 * printed and the arithmetic is anchored on the OEWS one, which is the
 * common case and the later of the two.
 */

function prettyStatus(s: string): string {
  const u = s.trim().toUpperCase();
  if (u === "IN PROCESS") return "In process";
  return u.charAt(0) + u.slice(1).toLowerCase();
}

function chipClass(row: PwdCaseRow): string {
  const u = row.status.toUpperCase();
  if (u === "DETERMINATION ISSUED" || u.startsWith("REDETERMINATION")) {
    return "bg-primary text-primary-foreground";
  }
  if (u === "DENIED") return "bg-foreground text-background";
  if (row.isFinal) return "bg-card";
  return "bg-tint-primary";
}

function day(iso: string | null): string | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
}

const fmt = (n: number) => n.toLocaleString("en-US");

export async function PwdLookup({ caseNumber }: { caseNumber: string }) {
  const [row, est] = await Promise.all([
    lookupPwdCase(caseNumber).catch(() => null),
    getPwdEstimatorData().catch(() => null),
  ]);

  if (!row) {
    return (
      <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Prevailing wage request
        </p>{" "}
        <h2 className="mt-2 font-heading text-2xl font-black">
          No record under {caseNumber}
        </h2>{" "}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
          DOL&apos;s case system returned nothing for this number, or didn&apos;t
          answer in time. It may be a typo, a filing from the last day, or a
          number from before DOL&apos;s current system. Check it on{" "}
          <a
            href="https://flag.dol.gov/case-status-search"
            className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            rel="noopener"
          >
            DOL&apos;s own case status page
          </a>
          , which takes P- numbers, or find it by employer on the{" "}
          <Link
            href="/pwd-cases"
            className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
          >
            wage request search
          </Link>
          .
        </p>
      </section>
    );
  }

  const month = row.filingDate?.slice(0, 7) ?? null;
  const estimate =
    month && est && est.asOf && est.backlog.length > 0
      ? estimatePwdQueue({
          requestMonth: month,
          frontierMonth: est.frontier?.oewsMonth ?? null,
          backlog: est.backlog,
          asOf: est.asOf,
          clearancePerMonth: est.clearancePerMonth,
        })
      : null;
  const notPerm = row.visaType !== null && row.visaType.toUpperCase() !== "PERM";

  return (
    <div className="space-y-6">
      <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Prevailing wage request · ETA-9141
        </p>{" "}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-black sm:text-3xl">{row.caseNumber}</h2>{" "}
          <span
            className={
              "border-2 border-border px-2 py-0.5 font-mono text-xs font-bold uppercase " + chipClass(row)
            }
          >
            {prettyStatus(row.status)}
          </span>
        </div>{" "}
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-base sm:grid-cols-2 [&>*]:min-w-0">
          <div>
            <dt className="text-sm font-bold text-foreground/70">Employer</dt>{" "}
            <dd className="font-medium">
              {row.employerName ? (
                <Link
                  href={`/pwd-cases?q=${encodeURIComponent(row.employerName)}`}
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
        </dl>{" "}
        {notPerm ? (
          <p className="mt-4 text-sm leading-relaxed text-foreground/70">
            DOL tags this request as {row.visaType}. The queue figures on this
            site cover PERM wage requests only, so none are shown for it.
          </p>
        ) : null}
      </section>

      {!row.isFinal && !notPerm ? (
        <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
          <h3 className="font-heading text-xl font-black">Where it sits in DOL&apos;s wage queue</h3>{" "}
          {est?.frontier?.oewsMonth ? (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
              As of {formatAsOf(est.asOf) ?? est.asOf}, DOL is working requests
              received in {formatMonth(est.frontier.oewsMonth)} where the wage comes
              from the OEWS survey
              {est.frontier.nonOewsMonth
                ? `, and ${formatMonth(est.frontier.nonOewsMonth)} where it doesn't`
                : ""}
              . A case record doesn&apos;t say which line this one is in.
            </p>
          ) : (
            <p className="mt-3 text-base text-foreground/80">
              DOL&apos;s current queue position didn&apos;t load. The{" "}
              <Link href="/tools/pwd-calculator" className="underline decoration-primary decoration-2 underline-offset-2">
                PWD queue calculator
              </Link>{" "}
              has it.
            </p>
          )}{" "}
          {estimate && month ? (
            <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
              <div className="border-2 border-border bg-tint-primary p-4">
                <dt className="text-sm font-bold text-foreground/70">Requests ahead of {formatMonth(month)}</dt>{" "}
                <dd className="mt-1 font-heading text-2xl font-black">{fmt(estimate.requestsAhead)}</dd>
              </div>{" "}
              <div className="border-2 border-border bg-card p-4">
                <dt className="text-sm font-bold text-foreground/70">Received the same month</dt>{" "}
                <dd className="mt-1 font-heading text-2xl font-black">{fmt(estimate.requestsSameMonth)}</dd>
              </div>{" "}
              <div className="border-2 border-border bg-card p-4">
                <dt className="text-sm font-bold text-foreground/70">Estimated determination</dt>{" "}
                <dd className="mt-1 font-heading text-2xl font-black">
                  {estimate.estimatedMonth ? formatMonth(estimate.estimatedMonth) : "Not enough history yet"}
                </dd>
              </div>
            </dl>
          ) : null}{" "}
          <p className="mt-4 text-sm leading-relaxed text-foreground/70">
            An estimate only. It assumes DOL keeps clearing requests at its
            recent rate. The{" "}
            <Link href="/tools/pwd-calculator" className="underline decoration-primary decoration-2 underline-offset-2">
              PWD queue calculator
            </Link>{" "}
            shows the same figures for any month.
          </p>
        </section>
      ) : null}

      {!row.isFinal && !notPerm ? (
        // The natural next step from reading a queue position: hear when DOL
        // reaches the month. Same machinery as the calculator page's form,
        // same PWD queues; the source tag says which page asked.
        <QueueAlertForm
          source="pwd-status"
          newestMonth={currentMonthUtc()}
          queue="pwd-oews"
          allowPwdChoice
        />
      ) : null}

      {row.isFinal ? (
        <section className="border-2 border-border bg-tint-primary p-5 sm:p-6">
          <h3 className="font-heading text-xl font-black">What comes next</h3>{" "}
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
            With the wage set, the employer recruits, then files the PERM. That
            gets its own G- case number. Once filed, the{" "}
            <Link href="/perm-cases" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              PERM case search
            </Link>{" "}
            finds it by employer, usually within a day.
          </p>
        </section>
      ) : null}
    </div>
  );
}
