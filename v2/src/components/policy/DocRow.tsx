import { billNumber } from "@convex/lib/billNumber";
import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import Image from "next/image";

import {
  ANNOUNCEMENT_TYPES,
  awaitsRegister,
  BALCA_TYPE,
  BILL_TYPE,
  billActionDay,
  COURT_TYPE,
  commentWindow,
  DECISION_TYPES,
  DOL_TYPE,
  effectiveState,
  OFLC_TYPE,
  PM_TYPE,
  PRESIDENTIAL_TYPE,
  STATE_TYPE,
  USCIS_TYPE,
  WH_TYPE,
  type FeedDoc,
} from "@/lib/policyFeed";
import { POLICY_SHOTS } from "@/lib/policyShots";
import type { CommentCount } from "@/lib/db/policyComments";
import type { PolicyNotice } from "@/lib/db/policyNotices";

import { dayLabel } from "./format";
import { Badge } from "@/components/ui/badge";

/**
 * One document, collapsed to what a reader decides on: the stage, the day,
 * the title and the one date that matters (when a rule takes effect, or
 * when comments close). The Register's abstract opens on demand, whole, with
 * its DATES paragraph verbatim, the citation, the links, and the first page
 * as printed. No lead sentence on the row: a Register abstract opens with
 * "The Department of Homeland Security (DHS) proposes to", which tells a
 * reader nothing the badge did not, and thirty of them were a wall. The anchor id is on the <details>, so the strip's marks land on
 * the visible row whether or not the browser opens it.
 */

export function typeLabel(type: string): string {
  if (type === "Rule") return "Final rule";
  if (type === "Proposed Rule") return "Proposed rule";
  if (type === PRESIDENTIAL_TYPE) return "Presidential";
  if (type === WH_TYPE) return "White House";
  if (type === OFLC_TYPE) return "OFLC";
  if (type === USCIS_TYPE) return "USCIS";
  if (type === PM_TYPE) return "Policy Manual";
  if (type === DOL_TYPE) return "DOL";
  if (type === STATE_TYPE) return "State";
  if (type === BILL_TYPE) return "Bill";
  if (type === COURT_TYPE) return "Court";
  if (type === BALCA_TYPE) return "BALCA";
  return "Notice";
}

/** The dot beside a document's type: a final rule is the one that binds. */
/** Each kind's fill, the strip's colours (round 3, Oct 15 2026: no black or
 *  grey): final lime, proposed soft yellow, notice soft blue, OFLC sage. */
function badgeFill(type: string): string {
  if (type === "Rule") return "border-foreground bg-primary text-black";
  if (type === "Proposed Rule") return "border-foreground bg-chart-yellow text-black";
  if (type === PRESIDENTIAL_TYPE || type === WH_TYPE) return "border-foreground bg-chart-orange text-black";
  if (ANNOUNCEMENT_TYPES.includes(type)) return "border-foreground bg-chart-green text-black";
  // Soft purple carries its own ink in each theme, so the text follows the theme.
  if (type === BILL_TYPE) return "border-foreground bg-soft-purple text-foreground";
  // Sage darkens in dark mode, so its text follows the theme too.
  if (type === COURT_TYPE || type === BALCA_TYPE) return "border-foreground bg-chart-sage text-foreground";
  return "border-foreground bg-chart-blue text-black";
}

/** Where the link goes, in words a reader can trust before clicking. */
function readOn(doc: PolicyNotice): string {
  if (doc.status === "public-inspection") return "Read the filed copy on the Federal Register";
  if (doc.type === WH_TYPE) return "Read it on whitehouse.gov";
  if (doc.type === USCIS_TYPE || doc.type === PM_TYPE) return "Read it on uscis.gov";
  if (doc.type === STATE_TYPE) return "Read it on travel.state.gov";
  if (doc.type === BILL_TYPE) return "Read it on congress.gov";
  if (doc.type === COURT_TYPE) return "Read the opinion on CourtListener";
  if (doc.type === BALCA_TYPE) return "See it on OALJ's caselist";
  if (doc.type === OFLC_TYPE || doc.type === DOL_TYPE) return "Read it on DOL's page";
  return "Read it on the Federal Register";
}

/**
 * The date line. A rule with a future effective date is UPCOMING, one whose
 * date has passed is IN EFFECT; a comment window is open through its close
 * date. Two states each, never a bare boolean rendered as a past tense.
 */
export function dateLine(doc: PolicyNotice, today: string): string | null {
  if (doc.status === "public-inspection") {
    const publishes = doc.publicationDate > today ? `publishes ${dayLabel(doc.publicationDate)}` : "publication due";
    return doc.piFiled ? `Filed ${dayLabel(doc.piFiled)}, ${publishes}` : `On public inspection, ${publishes}`;
  }
  if (doc.status === "withdrawn") return "Taken off public inspection before it was published";
  // BALCA's caselist names the kind of decision ("En banc decision"); a court opinion carries none.
  if (DECISION_TYPES.includes(doc.type)) return doc.action;
  if (doc.type === BILL_TYPE) {
    const day = billActionDay(doc);
    return doc.action ? `Latest action ${dayLabel(day)}: ${doc.action.replace(/\.$/, "")}` : `Introduced ${dayLabel(doc.publicationDate)}`;
  }
  if (doc.type === WH_TYPE) {
    const signed = `Signed ${dayLabel(doc.signingDate ?? doc.publicationDate)}`;
    // Past the wait an unmatched action may never be printed (most memoranda aren't), so say only what's known.
    return awaitsRegister(doc, today) ? `${signed}, not yet in the Federal Register` : signed;
  }
  const eff = doc.type === "Rule" ? effectiveState(doc, today) : null;
  if (eff) return eff.state === "upcoming" ? `Takes effect ${dayLabel(eff.on)}` : `In effect since ${dayLabel(eff.on)}`;
  const w = commentWindow(doc, today);
  if (!w) return null;
  if (w.state === "closed") return `Comments closed ${dayLabel(w.closesOn)}`;
  if (w.daysLeft === 0) return "Comments close today";
  return `Comments close ${dayLabel(w.closesOn)}, ${w.daysLeft} ${w.daysLeft === 1 ? "day" : "days"} left`;
}

// Each a 44px tap target: on their own row they're targets, not words in a sentence.
const LINK =
  "font-semibold link inline-flex min-h-11 items-center";

/** "26,697 comments posted so far", or null when there's no count or the window is shut. */
export function commentsLine(c: CommentCount | null | undefined, open: boolean): string | null {
  if (!c || !open) return null;
  return `${c.comments.toLocaleString("en-US")} ${c.comments === 1 ? "comment" : "comments"} posted so far`;
}

export function DocRow({
  doc,
  today,
  comments,
}: {
  doc: FeedDoc | PolicyNotice;
  today: string;
  /** regulations.gov's count, while the comment period is open. */
  comments?: CommentCount | null;
}) {
  const corrections = "corrections" in doc ? doc.corrections : [];
  const abstract = doc.abstract?.trim() ?? "";
  const line = dateLine(doc, today);
  const shot = POLICY_SHOTS[doc.documentNumber];
  const window = commentWindow(doc, today);
  const isPost = ANNOUNCEMENT_TYPES.includes(doc.type);
  const isBill = doc.type === BILL_TYPE;
  const isDecision = DECISION_TYPES.includes(doc.type);
  const posted = commentsLine(comments, window?.state === "open");

  return (
    <details id={`doc-${doc.documentNumber}`} className="group border-b-2 border-border last:border-b-0">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-sage-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Badge variant="outline" className={badgeFill(doc.type)}>
              {typeLabel(doc.type)}
            </Badge>{" "}
            <span className="font-mono text-sm text-muted-foreground">
              {isBill
                ? `Introduced ${dayLabel(doc.publicationDate)}`
                : isDecision
                  ? `Decided ${dayLabel(doc.publicationDate)}`
                  : dayLabel(doc.publicationDate)}
            </span>{" "}
            {isBill && billNumber(doc.documentNumber) ? (
              <span className="font-mono text-sm font-bold text-foreground">{billNumber(doc.documentNumber)}</span>
            ) : null}{" "}
            {!isPost ? <span className="font-mono text-sm text-muted-foreground">{doc.agencies.join(", ")}</span> : null}{" "}
            {corrections.length > 0 ? (
              <span className="font-mono text-sm font-bold text-muted-foreground">
                corrected {dayLabel(corrections[0]!.publicationDate)}
              </span>
            ) : null}
          </span>{" "}
          <h3 className="mt-2 font-heading text-lg font-bold leading-snug">{doc.title}</h3>{" "}
          {line ? <span className="mt-1.5 block font-heading text-base font-bold">{line}</span> : null}{" "}
          {posted ? <span className="mt-1 block font-mono text-sm tabular-nums text-soft">{posted}</span> : null}
        </span>{" "}
        <CaretDownIcon
          className="mt-1 h-5 w-5 shrink-0 text-primary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>{" "}
      <div className="border-t-2 border-border/40 px-5 pb-5 pt-4 text-base leading-relaxed text-soft sm:px-6">
        {abstract ? <p>{abstract}</p> : null}{" "}
        {doc.dates && !isBill ? (
          <p className="mt-3">
            <span className="font-bold text-foreground">Dates, as published: </span>
            {doc.dates}
          </p>
        ) : null}{" "}
        {posted && comments ? (
          <p className="mt-3">
            {comments.countedBy === "regulations.gov"
              ? "The count is regulations.gov's: comments an agency has posted after screening them, so it trails what people have sent."
              : "The count is the Federal Register's copy of regulations.gov's, until regulations.gov answers for this rule."}
          </p>
        ) : null}{" "}
        {!isBill && (doc.citation || doc.action) ? (
          <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 font-mono text-sm">
            {doc.action && !isDecision ? (
              <>
                <dt className="text-muted-foreground">Action</dt>{" "}
                <dd>{doc.action}</dd>
              </>
            ) : null}{" "}
            {doc.citation ? (
              <>
                <dt className="text-muted-foreground">{isDecision ? "Docket" : "Citation"}</dt>{" "}
                <dd>{doc.citation}</dd>
              </>
            ) : null}{" "}
            <dt className="text-muted-foreground">Document</dt>{" "}
            <dd>{doc.documentNumber}</dd>
          </dl>
        ) : null}{" "}
        <p className="mt-3 flex flex-wrap gap-x-5">
          <a href={doc.url} rel="noopener" target="_blank" className={LINK}>
            {readOn(doc)}
          </a>{" "}
          {doc.pdfUrl ? (
            <a href={doc.pdfUrl} rel="noopener" target="_blank" className={LINK}>
              PDF
            </a>
          ) : null}{" "}
          {posted && comments?.docketUrl ? (
            <a href={comments.docketUrl} rel="noopener" target="_blank" className={LINK}>
              The posted comments
            </a>
          ) : null}{" "}
          {window?.state === "open" && doc.commentUrl ? (
            <a href={doc.commentUrl} rel="noopener" target="_blank" className={LINK}>
              Comment on regulations.gov
            </a>
          ) : null}{" "}
          {corrections.map((c) => (
            <a key={c.documentNumber} href={c.url} rel="noopener" target="_blank" className={LINK}>
              Correction of {dayLabel(c.publicationDate)}
            </a>
          ))}
        </p>{" "}
        {shot ? (
          <figure className="mt-5 max-w-xl bg-tint p-2 border-2 shadow-hard-sm border-border">
            <Image
              src={`/images/policy/${doc.documentNumber}.webp`}
              width={shot.w}
              height={shot.h}
              sizes="(min-width: 640px) 576px, 100vw"
              alt={`The first page of "${doc.title}" as printed in the Federal Register.`}
              loading="lazy"
              className="h-auto w-full"
            />{" "}
            <figcaption className="mt-2 tabular-nums text-sm text-muted-foreground">
              First page as printed{doc.citation ? `, ${doc.citation}` : ""}.
            </figcaption>
          </figure>
        ) : null}
      </div>
    </details>
  );
}
