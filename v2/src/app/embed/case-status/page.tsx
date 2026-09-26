import { headers } from "next/headers";

import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import { prettyStatus } from "@/components/queue/stages";
import { embedSiteFor } from "@/lib/embeds";
import { getStatusMeaning } from "@/lib/permStatus";
import { lookupForEmbed, type EmbedCaseAnswer } from "@/lib/turso/embedLookup";

/**
 * The embeddable case lookup: one box, one answer card.
 *
 * Unlike the other embeds this is not a framed page section: the lookup page
 * carries a full federal record, a cohort and an estimate, far more than a
 * frame on somebody else's page should hold. The card is the status, the
 * dates, the employer, and where the answer came from, with a link to the
 * whole record here. `lib/turso/embedLookup.ts` owns the live-then-stored rule
 * and its caps.
 *
 * Dynamic by necessity: every render reads the query and the Referer.
 */
export const dynamic = "force-dynamic";

export const metadata = embedMetadata("case-status");

const PROGRAM: Record<EmbedCaseAnswer["program"], string> = {
  perm: "PERM",
  pwd: "Prevailing wage request",
  lca: "H-1B LCA",
};

const day = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: iso.length === 10 ? "UTC" : "America/New_York",
  });
};

function sourceLine(a: EmbedCaseAnswer): string {
  if (a.source === "dol-now") return "Read from DOL just now.";
  const when = day(a.checkedAt);
  const record = when ? `PERM Tracker's record, last checked with DOL ${when}` : "DOL's published disclosure file";
  return a.capped
    ? `Live checks from this site are used up for today, so this is ${record}.`
    : `From ${record}.`;
}

function Row({ term, value, noTranslate }: { term: string; value: string | null; noTranslate?: boolean }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 border-t border-border/40 py-2 [&>*]:min-w-0">
      <dt className="text-foreground/70">{term}</dt>{" "}
      <dd className="font-bold" translate={noTranslate ? "no" : undefined}>
        {value}
      </dd>{" "}
    </div>
  );
}

function Answer({ typed, answer }: { typed: string; answer: EmbedCaseAnswer | null }) {
  if (!answer) {
    return (
      <p className="border-2 border-border bg-card p-4 text-base">
        <b>{typed}</b> isn&apos;t a DOL case number. A PERM number looks like{" "}
        <span translate="no">G-100-26125-868956</span>.
      </p>
    );
  }
  const full = `/perm-case-status?case=${encodeURIComponent(answer.caseNumber)}`;
  if (!answer.found) {
    return (
      <div className="border-2 border-border bg-card p-4 text-base">
        <p>
          {answer.capped
            ? "PERM Tracker holds no record of this number, and live checks with DOL from this site are used up for today."
            : "Neither DOL nor PERM Tracker returned a record for this number. Check it and try again."}
        </p>{" "}
        <p className="mt-2">
          <a href={full} className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            Look it up on PERM Tracker
          </a>
        </p>
      </div>
    );
  }
  const meaning = answer.program === "perm" && answer.status ? getStatusMeaning(answer.status) : null;
  return (
    <div className="border-2 border-border bg-card p-4 shadow-hard">
      <p className="text-sm font-bold uppercase tracking-wider text-foreground/70">{PROGRAM[answer.program]}</p>{" "}
      <p className="mt-1 font-heading text-2xl font-black leading-tight" translate="no">
        {prettyStatus(answer.status ?? "")}
      </p>{" "}
      {meaning ? <p className="mt-2 text-base leading-relaxed text-foreground/80">{meaning.summary}</p> : null}{" "}
      <dl className="mt-3 text-sm">
        <Row term="Case number" value={answer.caseNumber} noTranslate />
        <Row term="Filed" value={day(answer.filingDate)} />
        <Row term="Decided" value={day(answer.decisionDate)} />
        <Row term="Employer" value={answer.employerName} noTranslate />
        <Row term="Job title" value={answer.jobTitle} />
      </dl>{" "}
      <p className="mt-3 text-sm text-foreground/70">{sourceLine(answer)}</p>{" "}
      <p className="mt-2">
        <a href={full} className="text-sm font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
          The full record on PERM Tracker
        </a>
      </p>
    </div>
  );
}

export default async function CaseStatusEmbed({
  searchParams,
}: {
  searchParams: Promise<{ case?: string; site?: string }>;
}) {
  const sp = await searchParams;
  const site = embedSiteFor((await headers()).get("referer"), sp.site);
  const typed = (sp.case ?? "").trim().slice(0, 40);
  const answer = typed ? await lookupForEmbed(typed, site).catch(() => null) : null;

  return (
    <EmbedFrame slug="case-status">
      <div data-embed="case-status" className="mx-auto w-full max-w-xl px-4">
        <form method="get" action="/embed/case-status" className="grid grid-cols-1 gap-2 [&>*]:min-w-0">
          <label htmlFor="embed-case" className="text-sm font-bold">
            DOL case number
          </label>{" "}
          <div className="flex gap-2">
            <input
              id="embed-case"
              name="case"
              defaultValue={typed}
              placeholder="G-100-26125-868956"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              className="min-h-11 min-w-0 flex-1 border-2 border-border bg-background px-3 text-base"
            />{" "}
            <button
              type="submit"
              className="min-h-11 border-2 border-border bg-primary px-4 font-bold text-primary-foreground shadow-hard-sm"
            >
              Check
            </button>
          </div>{" "}
          <input type="hidden" name="site" value={site} />{" "}
          <p className="text-sm text-foreground/70">PERM (G-), prevailing wage (P-) or H-1B LCA (I-) numbers.</p>
        </form>
        {typed ? (
          <div className="mt-4">
            <Answer typed={typed} answer={answer} />
          </div>
        ) : null}
      </div>
    </EmbedFrame>
  );
}
