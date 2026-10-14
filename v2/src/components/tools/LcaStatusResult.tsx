import Link from "next/link";
import { DolUnanswered } from "@/components/tools/DolUnanswered";
import { lookupLcaCaseOutcome, lookupLcaDisclosed, type LcaDisclosedRow } from "@/lib/turso/lcaCasesTypes";
import { formatWage } from "@/lib/wageFormat";
import { YearlyPayNote } from "@/components/data/YearlyPayNote";
import { WatchThisNumber } from "@/components/tools/WatchThisNumber";
import { AnswerPanel } from "@/components/tools/Insight";
import { PageSection } from "@/components/data/PageSection";
import { RecordList } from "@/components/data/RecordList";
import { isLookupGap } from "@/lib/dolMiss";
import { formatDay } from "@/lib/dolFormat";
import { prettyStatus } from "@/components/queue/stages";

/**
 * A labor condition application (ETA-9035) by number: DOL's own status,
 * the employer and title it names, and what an LCA status means.
 *
 * No queue panel, on purpose. DOL's stated target for an LCA is seven
 * business days, so "where does it sit in the line" is not the question;
 * "is it certified yet, and is this the employer and title I expected" is.
 */




/** What each LCA status means, in a sentence. */
function statusMeaning(status: string): string {
  const u = status.toUpperCase();
  if (u === "IN PROCESS") return "DOL is reviewing it. Its target is seven business days from filing, and most LCAs are certified within that.";
  if (u.startsWith("CERTIFIED"))
    return "DOL has certified the wage and working-condition attestations. The employer can now file the H-1B petition, which gets its own USCIS receipt number.";
  if (u === "WITHDRAWN") return "The employer withdrew it before a decision. A withdrawal isn't a denial; employers often refile with corrected details.";
  if (u === "DENIED") return "DOL found a problem with the attestations. Employers usually correct and refile; the employer or attorney knows what happens next.";
  return "DOL's status for this case, as shown on its own case status page.";
}

function employerLink(name: string | null) {
  return name ? (
    <Link href={`/lca-cases?q=${encodeURIComponent(name)}`} className="link">
      {name}
    </Link>
  ) : (
    "Not given"
  );
}

/** The decided record from DOL's quarterly LCA file: what the live endpoint never says. */
function Disclosed({ d }: { d: LcaDisclosedRow }) {
  const wage = formatWage(d.wage, d.wageUnit);
  return (
    <PageSection title="DOL's record" lede="From DOL's quarterly disclosure file: the wage and the job, which the live record never says.">
      {wage ? <p className="font-heading text-3xl font-bold sm:text-4xl">{wage}</p> : null}{" "}
      <YearlyPayNote wage={d.wage} unit={d.wageUnit} />{" "}
      <RecordList
        className="mt-6"
        rows={[
          { label: wage ? "Wage offered" : "Wage", value: wage ?? "Not in the file" },
          ...(d.socTitle || d.socCode
            ? [
                {
                  label: "Occupation",
                  value: (
                    <>
                      {d.socTitle ?? "Not given"}
                      {d.socCode ? <span className="font-mono text-sm font-normal text-muted-foreground"> · {d.socCode}</span> : null}
                    </>
                  ),
                },
              ]
            : []),
          ...(d.worksiteState ? [{ label: "Worksite state", value: d.worksiteState }] : []),
          ...(d.visaClass ? [{ label: "Visa class", value: d.visaClass }] : []),
          { label: "Received by DOL", value: formatDay(d.receivedDate) ?? "Unknown" },
          { label: "Decided", value: formatDay(d.decisionDate) ?? "Unknown" },
        ]}
      />
    </PageSection>
  );
}

export async function LcaLookup({ caseNumber }: { caseNumber: string }) {
  const [{ row, dolMiss }, disclosed] = await Promise.all([
    // A failure to read our own table is also "could not settle it", never "no record".
    lookupLcaCaseOutcome(caseNumber).catch(() => ({ row: null, dolMiss: "records" as const })),
    lookupLcaDisclosed(caseNumber).catch(() => null),
  ]);
  const label = (n: string) => (
    <>
      H-1B LCA <span translate="no">{n}</span>
    </>
  );

  if (!row && disclosed) {
    return (
      <div>
        <AnswerPanel
          verdict="Decided"
          direction={disclosed.status.toUpperCase().startsWith("CERTIFIED") ? "good" : disclosed.status.toUpperCase() === "DENIED" ? "bad" : "flat"}
          label={label(disclosed.caseNumber)}
          source="From DOL's quarterly disclosure file, which lists decided LCAs only"
        >
          DOL decided this LCA:{" "}
          <b className="font-semibold" translate="no">
            {prettyStatus(disclosed.status)}
          </b>
          . Its live case system didn&apos;t return the number, so the record below is from the quarterly file.
        </AnswerPanel>
        <Disclosed d={disclosed} />
        <PageSection title="The record">
          <RecordList
            rows={[
              { label: "Employer", raw: true, value: employerLink(disclosed.employerName) },
              { label: "Job title", value: disclosed.jobTitle ?? "Not given", raw: !!disclosed.jobTitle },
            ]}
          />
        </PageSection>
      </div>
    );
  }

  if (!row && isLookupGap(dolMiss)) {
    return <DolUnanswered caseNumber={caseNumber} label="H-1B LCA" miss={dolMiss} watch="lca" />;
  }

  if (!row) {
    return (
      <AnswerPanel
        verdict="No record"
        direction="flat"
        label={label(caseNumber)}
        actions={
          <div className="mt-6 border-t border-foreground/10 pt-6">
            <WatchThisNumber caseNumber={caseNumber} program="lca" variant="inline" />
          </div>
        }
      >
        DOL&apos;s case system answered and holds nothing under this number. Check it on{" "}
        <a href="https://flag.dol.gov/case-status-search" className="link" rel="noopener">
          DOL&apos;s case status page
        </a>
        , or find it by employer on the{" "}
        <Link href="/lca-cases" className="link">
          LCA search
        </Link>
        .
      </AnswerPanel>
    );
  }

  const u = row.status.toUpperCase();
  const filed = formatDay(row.submittedDate) ?? formatDay(row.filingDate);
  return (
    <div>
      <AnswerPanel
        verdict={row.isFinal ? "Decided" : "Waiting"}
        direction={u.startsWith("CERTIFIED") ? "good" : u === "DENIED" ? "bad" : "flat"}
        label={label(row.caseNumber)}
        source={row.lastCheckedAt ? `DOL showed this status on ${formatDay(row.lastCheckedAt)}` : undefined}
        actions={
          // An LCA is usually decided within seven business days, so the alert
          // is offered only while it's pending: on a certified one it would be
          // a subscription to nothing.
          row.isFinal ? undefined : (
            <div className="mt-6 border-t border-foreground/10 pt-6">
              <WatchThisNumber caseNumber={row.caseNumber} program="lca" variant="inline" />
            </div>
          )
        }
      >
        DOL&apos;s status for this LCA is{" "}
        <b className="font-semibold" translate="no">
          {prettyStatus(row.status)}
        </b>
        .{filed ? ` It was filed ${filed}.` : ""} {statusMeaning(row.status)}
      </AnswerPanel>

      {disclosed ? <Disclosed d={disclosed} /> : null}

      <PageSection title="The record" lede="As DOL holds it.">
        <RecordList
          rows={[
            { label: "Employer", raw: true, value: employerLink(row.employerName) },
            { label: "Job title", value: row.jobTitle ?? "Not given", raw: !!row.jobTitle },
            { label: "Case number", value: row.caseNumber, raw: true, mono: true },
            { label: "Filed with DOL", value: filed ?? "Unknown" },
            { label: "Last checked against DOL", value: formatDay(row.lastCheckedAt) ?? "Today" },
          ]}
        />
      </PageSection>
    </div>
  );
}
