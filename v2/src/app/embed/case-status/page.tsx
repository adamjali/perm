import { headers } from "next/headers";

import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import { prettyStatus } from "@/components/queue/stages";
import { CaseNumberAnatomy } from "@/components/tools/CaseNumberAnatomy";
import { dolNow, type DolNow } from "@/lib/dolNow";
import { getProcessingTimes } from "@/lib/turso/processingTimes";
import { embedSiteFor } from "@/lib/embeds";
import { getStatusMeaning } from "@/lib/permStatus";
import { lookupForEmbed, type EmbedCaseAnswer } from "@/lib/turso/embedLookup";
import { EASTERN_TIMEZONE } from "@/lib/time";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";

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
  seasonal: "H-2A, H-2B or CW-1 filing",
};

const day = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: iso.length === 10 ? "UTC" : EASTERN_TIMEZONE,
  });
};

function sourceLine(a: EmbedCaseAnswer): string {
  if (a.source === "dol-now") return "Read from DOL just now.";
  const when = day(a.checkedAt);
  const record = when ? `PERM Tracker's record, last checked with DOL ${when}` : "DOL's published disclosure file";
  if (a.capped) return `Live checks from this site are used up for today, so this is ${record}.`;
  if (a.dolUnavailable) return `DOL didn't answer just now, so this is ${record}.`;
  return `From ${record}.`;
}

function Row({ term, value, noTranslate }: { term: string; value: string | null; noTranslate?: boolean }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 border-t border-border/40 py-2 [&>*]:min-w-0">
      <dt className="text-muted-foreground">{term}</dt>{" "}
      <dd className="font-bold" translate={noTranslate ? "no" : undefined}>
        {value}
      </dd>{" "}
    </div>
  );
}

function Answer({ typed, answer }: { typed: string; answer: EmbedCaseAnswer | null }) {
  if (!answer) {
    return (
      <p className="border border-border bg-card p-4 text-base">
        <b>{typed}</b> isn&apos;t a DOL case number. A PERM number looks like{" "}
        <span translate="no">G-100-26125-868956</span>.
      </p>
    );
  }
  const full = `/perm-case-status?case=${encodeURIComponent(answer.caseNumber)}`;
  if (!answer.found) {
    return (
      <div className="border border-border bg-card p-4 text-base">
        <p>
          {answer.capped
            ? "PERM Tracker holds no record of this number, and live checks with DOL from this site are used up for today."
            : answer.dolUnavailable
              ? "PERM Tracker holds no record of this number yet, and DOL didn't answer when we asked just now, so we can't say whether it exists. That's usually brief: try again in a moment."
              : "Neither DOL nor PERM Tracker returned a record for this number. Check it and try again."}
        </p>{" "}
        <p className="mt-2">
          <a href={full} className="link">
            Look it up on PERM Tracker
          </a>
        </p>
      </div>
    );
  }
  const meaning = answer.program === "perm" && answer.status ? getStatusMeaning(answer.status) : null;
  return (
    <div className="border border-border bg-card p-4">
      <p className="text-sm font-bold text-muted-foreground">{PROGRAM[answer.program]}</p>{" "}
      <p className="mt-1 font-heading text-2xl font-bold leading-tight" translate="no">
        {prettyStatus(answer.status ?? "")}
      </p>{" "}
      {meaning ? <p className="mt-2 text-base leading-relaxed text-soft">{meaning.summary}</p> : null}{" "}
      <dl className="mt-3 text-sm">
        <Row term="Case number" value={answer.caseNumber} noTranslate />
        <Row term="Filed" value={day(answer.filingDate)} />
        <Row term="Decided" value={day(answer.decisionDate)} />
        <Row term="Employer" value={answer.employerName} noTranslate />
        <Row term="Job title" value={answer.jobTitle} />
      </dl>{" "}
      <p className="mt-3 text-sm text-muted-foreground">{sourceLine(answer)}</p>{" "}
      <p className="mt-2">
        <a href={full} className="link text-sm">
          The full record on PERM Tracker
        </a>
      </p>
    </div>
  );
}

/** DOL's own position and average, dated, in two cells. Nothing when DOL's figures can't be read. */
function QueueNow({ now }: { now: DolNow | null }) {
  if (!now || (now.frontier === null && now.days === null)) return null;
  return (
    <div className="mt-5 border border-border bg-card">
      <dl className="grid grid-cols-2 gap-px bg-border [&>*]:min-w-0 [&>*:last-child:nth-child(odd)]:col-span-2">
        {now.frontier ? (
          <div className="bg-card p-3">
            <dt className="text-sm text-muted-foreground">DOL is deciding PERMs filed in{" "}</dt>{" "}
            <dd className="mt-0.5 font-heading text-xl font-bold">{now.frontier}</dd>
          </div>
        ) : null}{" "}
        {now.days !== null ? (
          <div className="bg-card p-3">
            <dt className="text-sm text-muted-foreground">Its average, filing to decision{" "}</dt>{" "}
            <dd className="mt-0.5 font-heading text-xl font-bold tabular-nums">{now.days} days</dd>
          </div>
        ) : null}
      </dl>{" "}
      {now.asOf ? <p className="border-t border-border px-3 py-2 text-sm text-muted-foreground">As DOL published them on {now.asOf}.</p> : null}
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
  // Before anything is typed, where DOL stands: the frame carries a live figure
  // rather than a lone box. A failed read shows nothing, never a stale guess.
  const now = typed ? null : dolNow(await getProcessingTimes().catch(() => null));

  return (
    <EmbedFrame slug="case-status">
      <div data-embed="case-status" className="mx-auto w-full max-w-xl px-4">
        <CaseLookupForm
          action="/embed/case-status"
          label="DOL case number"
          defaultValue={typed}
          help={null}
          searchHref={null}
          source="embed"
          hiddenFields={{ site }}
        />{" "}
        {typed ? (
          <div className="mt-4">
            <Answer typed={typed} answer={answer} />
          </div>
        ) : (
          <>
            <CaseNumberAnatomy id="embed-case-anatomy" employerName={false} />{" "}
            <QueueNow now={now} />
          </>
        )}
      </div>
    </EmbedFrame>
  );
}
