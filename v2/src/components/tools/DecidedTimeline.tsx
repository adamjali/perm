import Link from "next/link";

import { PageSection } from "@/components/data/PageSection";
import { STAGE_VISUALS } from "@/components/status/stage-visuals";
import { decidedTimeline, type TimelineStep, type TimelineTone } from "@/lib/decidedTimeline";
import type { DecidedTimelineRead } from "@/lib/db/decidedTimeline";
import { intlLocale, localizedPath, type Lang } from "@/lib/i18n/lang";
import { dayShortLabel, intLabel } from "@/lib/i18n/format";
import { HOURS_PER_YEAR, PAY_PERIODS } from "@/lib/wageFormat";
import { cn } from "@/lib/utils";

import { DECIDED_TIMELINE, type DecidedTimelineText, type PeriodLabel, type StepKey } from "./DecidedTimeline.messages";

/** Each step's mark: the stage it belongs to (STAGE_VISUALS, the one map) and the outcome colour code. */
const MARK: Record<TimelineTone, string> = {
  pwd: STAGE_VISUALS.pwd.fill,
  recruitment: STAGE_VISUALS.recruitment.fill,
  quiet: cn("border-2 bg-hatch", STAGE_VISUALS.recruitment.border),
  filed: STAGE_VISUALS.eta9089.fill,
  certified: "bg-chart-green border-2 border-foreground",
  denied: "bg-destructive border-2 border-foreground",
  withdrawn: "bg-chart-purple border-2 border-foreground",
};

/** A wage with its pay period, in the reader's language (English's own form is built by decidedTimeline). */
function wageText(wage: number | null, unit: string | null, lang: Lang, t: DecidedTimelineText): string | null {
  if (wage === null || !Number.isFinite(wage) || wage <= 0) return null;
  const key = (unit ?? "").trim().toUpperCase();
  const period = PAY_PERIODS.find((p) => p.spellings.includes(key));
  const cents = period?.perYear === HOURS_PER_YEAR || !Number.isInteger(wage);
  const amount = new Intl.NumberFormat(intlLocale(lang), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(wage);
  if (period) return t.wage(amount, t.period[period.label as PeriodLabel] ?? period.label);
  return key ? `${amount} ${key.toLowerCase()}` : amount;
}

/**
 * One step's label and detail in the reader's language. English keeps what `decidedTimeline` built; the
 * others are chosen by the step's key, never read back out of the English.
 */
function stepWords(
  s: TimelineStep,
  read: DecidedTimelineRead,
  filedAfterQuiet: number | null,
  hasSecondAd: boolean,
  lang: Lang,
  t: DecidedTimelineText,
): { label: string; detail?: string } {
  if (lang === "en") return { label: s.label, detail: s.detail };
  if (s.key.startsWith("step-")) return { label: t.recruitment[s.key.slice("step-".length)] ?? s.label };
  if (s.key === "decided") {
    const tone = s.tone === "certified" || s.tone === "withdrawn" ? s.tone : "denied";
    return { label: t.decidedLabel(t.decided[tone], s.label) };
  }
  if (s.key === "pwd-determined") {
    const pwd = read.record.pwd;
    const level = pwd?.level ? t.level(pwd.level.replace(/^level\s*/i, "")) : null;
    const wage = pwd ? wageText(pwd.wage, pwd.unit, lang, t) : null;
    return { label: t.step["pwd-determined"], detail: [level, wage].filter(Boolean).join(", ") || undefined };
  }
  if (s.key === "quiet") return { label: t.step.quiet, detail: t.quietDetail };
  if (s.key === "filed") {
    return { label: t.step.filed, detail: s.detail && filedAfterQuiet !== null ? t.afterQuiet(filedAfterQuiet) : undefined };
  }
  const key: StepKey = s.key === "ad1" && !hasSecondAd ? "ad-only" : (s.key as StepKey);
  return { label: t.step[key] ?? s.label, detail: s.detail };
}

/**
 * A decided case from its wage request to DOL's decision, every date DOL's two files print,
 * with the quiet period's end and how soon after it the case went in. The wage request links
 * to its own page.
 */
export function DecidedTimeline({ read, lang = "en" }: { read: DecidedTimelineRead | null; lang?: Lang }) {
  if (!read) return null;
  const t = decidedTimeline(read.record);
  if (t.steps.length < 3) return null;
  const w: DecidedTimelineText = DECIDED_TIMELINE[lang];
  const day = (d: string) => dayShortLabel(d, lang) ?? d;
  const hasSecondAd = t.steps.some((s) => s.key === "ad2");
  const { employees, since } = read.employer;
  const pwd = read.record.pwd;
  const facts = [
    employees ? w.size(intLabel(employees, lang), employees) : null,
    since ? w.founded(String(since)) : null,
  ].filter((f): f is string => Boolean(f));
  return (
    <PageSection title={w.title} lede={w.lede} id="timeline">
      <ol className="relative max-w-3xl before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-border">
        {t.steps.map((s) => {
          const words = stepWords(s, read, t.filedAfterQuiet, hasSecondAd, lang, w);
          return (
          <li key={s.key} className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-4 pb-5 last:pb-0 sm:grid-cols-[1rem_9rem_minmax(0,1fr)]">
            <span aria-hidden="true" className={cn("relative mt-1 size-4", MARK[s.tone])} />{" "}
            <span className="font-mono text-sm tabular-nums text-soft max-sm:col-start-2">
              {s.until && s.until !== s.date ? w.range(day(s.date), day(s.until)) : day(s.date)}
            </span>{" "}
            <span className="min-w-0 max-sm:col-start-2">
              <span className="block font-semibold">{words.label}</span>{" "}
              {words.detail ? (
                <span className={cn("block text-sm", s.key === "filed" ? "font-semibold text-foreground" : "text-soft")}>{words.detail}</span>
              ) : null}
            </span>
          </li>
          );
        })}
      </ol>{" "}
      {pwd || facts.length > 0 ? (
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-soft">
          {pwd ? (
            <>
              {w.pwdNamed}
              <Link href={localizedPath(`/perm-case-status?case=${encodeURIComponent(pwd.number)}`, lang)} className="link font-mono">
                {pwd.number}
              </Link>
              {w.pwdNamedEnd}
            </>
          ) : null}
          {facts.length > 0 ? w.gave(facts) : null}
        </p>
      ) : null}
    </PageSection>
  );
}
