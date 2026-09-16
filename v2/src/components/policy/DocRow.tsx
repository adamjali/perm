import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import Image from "next/image";

import { commentWindow, effectiveState, OFLC_TYPE, type FeedDoc } from "@/lib/policyFeed";
import { POLICY_SHOTS } from "@/lib/policyShots";
import type { PolicyNotice } from "@/lib/turso/policyNotices";

import { dayLabel } from "./format";

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
  if (type === OFLC_TYPE) return "OFLC";
  return "Notice";
}

function badgeClass(type: string): string {
  if (type === "Rule") return "bg-primary text-black";
  if (type === "Proposed Rule") return "bg-foreground text-background";
  if (type === OFLC_TYPE) return "bg-muted text-foreground";
  return "bg-background text-foreground";
}

/**
 * The date line. A rule with a future effective date is UPCOMING, one whose
 * date has passed is IN EFFECT; a comment window is open through its close
 * date. Two states each, never a bare boolean rendered as a past tense.
 */
export function dateLine(doc: PolicyNotice, today: string): string | null {
  const eff = doc.type === "Rule" ? effectiveState(doc, today) : null;
  if (eff) return eff.state === "upcoming" ? `Takes effect ${dayLabel(eff.on)}` : `In effect since ${dayLabel(eff.on)}`;
  const w = commentWindow(doc, today);
  if (!w) return null;
  if (w.state === "closed") return `Comments closed ${dayLabel(w.closesOn)}`;
  if (w.daysLeft === 0) return "Comments close today";
  return `Comments close ${dayLabel(w.closesOn)}, ${w.daysLeft} ${w.daysLeft === 1 ? "day" : "days"} left`;
}

const LINK =
  "font-semibold underline decoration-primary decoration-2 underline-offset-[3px] transition-colors hover:text-primary";

export function DocRow({ doc, today }: { doc: FeedDoc | PolicyNotice; today: string }) {
  const corrections = "corrections" in doc ? doc.corrections : [];
  const abstract = doc.abstract?.trim() ?? "";
  const line = dateLine(doc, today);
  const shot = POLICY_SHOTS[doc.documentNumber];
  const window = commentWindow(doc, today);
  const isOflc = doc.type === OFLC_TYPE;

  return (
    <details id={`doc-${doc.documentNumber}`} className="group border-b-2 border-border last:border-b-0">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className={`inline-block border-2 border-foreground px-2 py-0.5 font-mono text-sm font-bold uppercase tracking-[0.06em] ${badgeClass(doc.type)}`}>
              {typeLabel(doc.type)}
            </span>{" "}
            <span className="font-mono text-sm text-muted-foreground">{dayLabel(doc.publicationDate)}</span>{" "}
            {!isOflc ? <span className="font-mono text-sm text-muted-foreground">{doc.agencies.join(", ")}</span> : null}{" "}
            {corrections.length > 0 ? (
              <span className="font-mono text-sm font-bold text-muted-foreground">
                corrected {dayLabel(corrections[0]!.publicationDate)}
              </span>
            ) : null}
          </span>{" "}
          <h3 className="mt-2 font-heading text-lg font-black leading-snug">{doc.title}</h3>{" "}
          {line ? <span className="mt-1.5 block font-heading text-base font-bold">{line}</span> : null}
        </span>{" "}
        <CaretDownIcon
          className="mt-1 h-5 w-5 shrink-0 text-primary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>{" "}
      <div className="border-t-2 border-border/40 px-5 pb-5 pt-4 text-base leading-relaxed text-foreground/80 sm:px-6">
        {abstract ? <p>{abstract}</p> : null}{" "}
        {doc.dates ? (
          <p className="mt-3">
            <span className="font-bold text-foreground">Dates, as published: </span>
            {doc.dates}
          </p>
        ) : null}{" "}
        {doc.citation || doc.action ? (
          <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 font-mono text-sm">
            {doc.action ? (
              <>
                <dt className="text-muted-foreground">Action</dt>{" "}
                <dd>{doc.action}</dd>
              </>
            ) : null}{" "}
            {doc.citation ? (
              <>
                <dt className="text-muted-foreground">Citation</dt>{" "}
                <dd>{doc.citation}</dd>
              </>
            ) : null}{" "}
            <dt className="text-muted-foreground">Document</dt>{" "}
            <dd>{doc.documentNumber}</dd>
          </dl>
        ) : null}{" "}
        <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          <a href={doc.url} rel="noopener" target="_blank" className={LINK}>
            {isOflc ? "Read it on DOL's page" : "Read it on the Federal Register"}
          </a>{" "}
          {doc.pdfUrl ? (
            <a href={doc.pdfUrl} rel="noopener" target="_blank" className={LINK}>
              PDF
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
          <figure className="mt-5 max-w-xl border-2 border-border bg-background p-2 shadow-hard-sm">
            <Image
              src={`/images/policy/${doc.documentNumber}.webp`}
              width={shot.w}
              height={shot.h}
              sizes="(min-width: 640px) 576px, 100vw"
              alt={`The first page of "${doc.title}" as printed in the Federal Register.`}
              loading="lazy"
              className="h-auto w-full"
            />{" "}
            <figcaption className="mt-2 font-mono text-sm text-muted-foreground">
              First page as printed{doc.citation ? `, ${doc.citation}` : ""}.
            </figcaption>
          </figure>
        ) : null}
      </div>
    </details>
  );
}
