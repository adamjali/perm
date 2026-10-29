import { PageSection } from "@/components/data/PageSection";
import type { Lang } from "@/lib/i18n/lang";
import { dayShortLabel, intLabel } from "@/lib/i18n/format";
import { HISTORY_FROM, statusHistory, type StatusEvent } from "@/lib/statusHistory";
import { CASE_STATUS_FILL, caseStatusTint, prettyStatus } from "@/lib/statusTone";
import { cn } from "@/lib/utils";

import { STATUS_HISTORY } from "./StatusHistory.messages";

/**
 * Every status DOL's record showed for this case, oldest first, each with the day it changed and how long it
 * held. Nothing renders until our checks have seen the case change at least once. A translated page keeps DOL's
 * status words as DOL prints them, the rule the rest of the case page follows.
 */
export function StatusHistory({
  events,
  filedOn = null,
  lang = "en",
}: {
  events: readonly StatusEvent[] | null;
  filedOn?: string | null;
  lang?: Lang;
}) {
  const steps = events ? statusHistory(events, filedOn) : [];
  if (steps.length === 0) return null;
  const t = STATUS_HISTORY[lang];
  const day = (d: string) => dayShortLabel(d, lang) ?? d;
  const status = (s: string) => (lang === "en" ? prettyStatus(s) : s.toUpperCase());
  const now = steps.length - 1;
  return (
    <PageSection title={t.title} lede={t.lede(day(HISTORY_FROM))} id="history">
      <ol className="relative max-w-3xl before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-border">
        {steps.map((s, i) => (
          <li
            key={`${s.status}-${s.since ?? "start"}`}
            className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-4 pb-5 last:pb-0 sm:grid-cols-[1rem_9rem_minmax(0,1fr)]"
          >
            <span
              aria-hidden="true"
              className={cn("relative mt-1 size-4 border-2 border-foreground", CASE_STATUS_FILL[caseStatusTint(s.status)])}
            />{" "}
            <span className="font-mono text-sm tabular-nums text-soft max-sm:col-start-2">
              {s.since === null ? t.by(day(HISTORY_FROM)) : s.filed ? t.filed(day(s.since)) : day(s.since)}
            </span>{" "}
            <span className="min-w-0 max-sm:col-start-2">
              <span className="block font-semibold">
                {status(s.status)}
                {i === now ? <span className="font-normal text-soft">{" "}{t.now}</span> : null}
              </span>{" "}
              {s.days !== null ? <span className="block text-sm text-soft">{t.heldFor(s.days, intLabel(s.days, lang))}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </PageSection>
  );
}
