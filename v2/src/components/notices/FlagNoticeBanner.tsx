"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CaretRightIcon, WarningIcon } from "@phosphor-icons/react";

import type { FlagNotice } from "@/lib/flagNotice";
import { isDataPath } from "@/lib/siteMap";
import { checkedLabel } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * DOL's own notice on FLAG, at the top of every public page while it's up
 * (a maintenance window, an outage), because every status on the site comes
 * from FLAG and a reader should know why one hasn't moved.
 *
 * Fetched after the page loads (`/api/flag-notice`, cached five minutes), so
 * no page's cached HTML carries a notice that has since ended. DOL's words
 * are kept whole, folded under a line saying what it means here.
 */
export function FlagNoticeBanner() {
  const [notice, setNotice] = useState<FlagNotice | null>(null);
  // On a data page a phone shows the data menu's tab at the left edge; leave it room.
  const dataPage = isDataPath(usePathname() ?? "");
  useEffect(() => {
    let live = true;
    fetch("/api/flag-notice")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { notice?: FlagNotice | null } | null) => {
        if (live) setNotice(j?.notice ?? null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (!notice) return null;
  return (
    <section aria-label="DOL notice on FLAG" className="border-b-2 border-data-warn bg-card">
      <div className={cn("mx-auto flex max-w-[1200px] items-start gap-3 px-4 py-3 sm:px-6", dataPage && "max-lg:pl-14")}>
        <WarningIcon size={22} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0 text-data-warn-ink" />{" "}
        <div className="min-w-0">
          <p className="text-base font-semibold">
            DOL notice on FLAG{notice.heading ? `: ${notice.heading}` : ""}{" "}
          </p>{" "}
          <p className="text-sm text-soft">
            Every status here comes from FLAG, so a change may show late. Read on flag.dol.gov{" "}
            {checkedLabel(notice.checkedAt)}.
          </p>{" "}
          {notice.body ? (
            <details className="group mt-1 text-sm">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-semibold [&::-webkit-details-marker]:hidden">
                <CaretRightIcon size={14} weight="bold" aria-hidden="true" className="transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                DOL&apos;s notice in full
              </summary>{" "}
              <p className="max-w-3xl pb-1 leading-relaxed text-soft">{notice.body}</p>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}
