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
  /** warn: on hold or at RFI; bad: an appeal or a debarment; ink: everything else worth a look (drawn blue, round 3: no black marks). */
  tone: "warn" | "bad" | "ink";
}

const TONE: Record<ProfileTag["tone"], string> = {
  warn: "bg-data-warn-ink",
  bad: "bg-data-bad-ink",
  ink: "bg-data-info",
};

export function ProfileHeader({
  eyebrow,
  name,
  answer,
  facts = [],
  tags = [],
  aside,
  figures,
}: {
  eyebrow: string;
  name: string;
  /** The one sentence that answers why most people came: what is waiting at DOL now. */
  answer?: ReactNode;
  facts?: ProfileFact[];
  tags?: ProfileTag[];
  aside?: ReactNode;
  figures?: ReactNode;
}) {
  return (
    <header className="pt-8 sm:pt-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:items-start [&>*]:min-w-0">
        <div>
          <p className="text-sm text-muted-foreground">{eyebrow}</p>{" "}
          <h1
            translate="no"
            className="mt-2 font-heading text-4xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-5xl"
          >
            {name}
          </h1>{" "}
          {answer ? <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground">{answer}</p> : null}{" "}
          {tags.length > 0 ? (
            <ul aria-label="What stands out now" className="mt-3 flex flex-wrap gap-x-5">
              {tags.map((t) => (
                <Fragment key={t.text}>
                  {" "}
                  <li>
                    <a
                      href={t.href}
                      className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline-offset-2 hover:underline border-2 shadow-hard-sm motion-safe:hover:-translate-y-0.5 px-3 bg-card border-border transition-[color,background-color,border-color,box-shadow,transform]"
                    >
                      <span aria-hidden="true" className={cn("size-2.5 shrink-0", TONE[t.tone])} />
                      {t.text}
                    </a>
                  </li>
                </Fragment>
              ))}
            </ul>
          ) : null}{" "}
          {facts.length > 0 ? (
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              {facts.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="text-sm font-semibold">{f.label}</dt>{" "}
                  <dd className="text-base font-semibold [overflow-wrap:anywhere]">
                    {f.href ? (
                      <Link href={f.href} className="link">
                        {f.value}
                      </Link>
                    ) : (
                      f.value
                    )}
                    {f.note ? <span className="font-normal text-muted-foreground"> · {f.note}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>{" "}
        {aside ? <div>{aside}</div> : null}
      </div>{" "}
      {figures ? <div className="mt-10">{figures}</div> : null}
    </header>
  );
}
