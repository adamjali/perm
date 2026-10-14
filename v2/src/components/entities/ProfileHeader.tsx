import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The top of an entity page: what this is, what is true of it right now, and
 * the reader's own way in, before any chapter starts.
 *
 * Most visitors to an employer page work there and came about their own case,
 * so the case-number box sits beside the name rather than under the figures;
 * the tags say in a few words what changed (a hold, an appeal, layoff
 * notices) and jump to where each is shown in full.
 */

export interface ProfileFact {
  /** What the cell answers: "Main job", "Main worksite", "Industry". */
  label: string;
  value: string;
  href?: string;
  note?: string;
}

export interface ProfileTag {
  text: string;
  /** An anchor on the same page. */
  href: string;
  /** warn: on hold or at RFI; bad: an appeal or a debarment; ink: everything else worth a look. */
  tone: "warn" | "bad" | "ink";
}

const TONE: Record<ProfileTag["tone"], string> = {
  warn: "bg-data-warn-ink",
  bad: "bg-data-bad-ink",
  ink: "bg-foreground",
};

const FACT_COLUMNS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" };

export function ProfileHeader({
  eyebrow,
  name,
  facts = [],
  tags = [],
  aside,
  figures,
}: {
  eyebrow: string;
  name: string;
  facts?: ProfileFact[];
  tags?: ProfileTag[];
  aside?: ReactNode;
  figures?: ReactNode;
}) {
  return (
    <header className="pt-10 sm:pt-12">
      <div className="grid grid-cols-1 gap-8 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)] lg:items-start">
        <div>
          <p className="text-sm font-bold text-muted-foreground">{eyebrow}</p>{" "}
          <h1
            translate="no"
            className="mt-2 font-heading text-4xl font-bold leading-[1.05] [overflow-wrap:anywhere] sm:text-5xl"
          >
            {name}
          </h1>{" "}
          {facts.length > 0 ? (
            <dl
              className={cn(
                "mt-6 grid grid-cols-1 gap-px border border-border bg-border [&>*]:min-w-0",
                FACT_COLUMNS[facts.length],
              )}
            >
              {facts.map((f) => (
                <div key={f.label} className="bg-card px-4 py-3">
                  <dt className="text-sm text-muted-foreground">{f.label}{" "}</dt>{" "}
                  <dd className="mt-0.5 font-heading text-lg font-bold leading-snug [overflow-wrap:anywhere]">
                    {f.href ? (
                      <Link
                        href={f.href}
                        className="underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
                      >
                        {f.value}
                      </Link>
                    ) : (
                      f.value
                    )}{" "}
                  </dd>
                  {f.note ? <dd className="mt-0.5 text-sm text-muted-foreground">{f.note}{" "}</dd> : null}
                </div>
              ))}
            </dl>
          ) : null}{" "}
          {tags.length > 0 ? (
            <ul aria-label="What stands out now" className="mt-5 flex flex-wrap gap-2">
              {tags.map((t) => (
                <Fragment key={t.text}>
                  {" "}
                  <li>
                    <a
                      href={t.href}
                      className="inline-flex min-h-11 items-center gap-2 border border-border bg-card px-3 text-sm font-bold transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                    >
                      <span aria-hidden="true" className={cn("size-3 shrink-0", TONE[t.tone])} />
                      {t.text}
                    </a>
                  </li>
                </Fragment>
              ))}
            </ul>
          ) : null}
        </div>{" "}
        {aside ? <div>{aside}</div> : null}
      </div>{" "}
      {figures ? <div className="mt-8">{figures}</div> : null}
    </header>
  );
}
