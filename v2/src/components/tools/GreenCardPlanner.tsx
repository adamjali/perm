"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowCounterClockwiseIcon, ArrowRightIcon, CaretDownIcon } from "@phosphor-icons/react";
import { Fragment, useId, useMemo, useState, type ReactNode } from "react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui/label";
import { useUrlSearchParams } from "@/hooks/useUrlSearchParams";
import { aboutMonths } from "@/lib/board";
import { bulletinCheckSentence, type BulletinCheck } from "@/lib/bulletinCheck";
import { cutoffLabel } from "@/lib/bulletinNext";
import {
  buildPlan,
  NEEDS_PRIORITY_DATE,
  RECRUITMENT_MIN_DAYS,
  WHERE,
  type FeeInput,
  type Plan,
  type PlanFigures,
  type PlanStage,
  type PlanStep,
  type StageOwner,
  type Where,
} from "@/lib/perm";
import { daysBetween, MS_PER_DAY } from "@/lib/time";
import { cn } from "@/lib/utils";
import { monthYear, shortDate } from "@convex/lib/months";

/**
 * The whole employment-based green card for one case: where it stands, its dates, and
 * every step after it, dated from the figures the site measures, with the government's
 * fees for the whole way (owner, Oct 27 2026). The case's inputs live in the address,
 * so a plan can be shared and other pages can link to one already filled in.
 */

const COUNTRIES = [
  ["worldwide", "Rest of world"],
  ["india", "India"],
  ["china", "China"],
  ["mexico", "Mexico"],
  ["philippines", "Philippines"],
] as const;
const CATEGORIES = [
  ["EB2", "EB-2 (advanced degree)", "EB-2"],
  ["EB3", "EB-3 (skilled or professional)", "EB-3"],
] as const;
type Category = (typeof CATEGORIES)[number][0];

/** Where each step's own page is. */
const STEP_HREF: Record<PlanStage, string> = {
  pwd: "/pwd-cases",
  recruitment: "/tools/perm-deadline-calculator",
  perm: "/perm-queue",
  i140: "/uscis-processing-times",
  visa: "/visa-bulletin",
  i485: "/i485-by-field-office",
};
const OWNER_LABEL: Record<StageOwner, string> = { employer: "Employer", dol: "DOL", uscis: "USCIS", state: "State Dept." };
/** The milestones the strip leads with: the day each of these steps ends. */
const MILESTONES: readonly { key: PlanStage; label: string }[] = [
  { key: "recruitment", label: "Priority date" },
  { key: "perm", label: "PERM decided" },
  { key: "i140", label: "I-140 decided" },
  { key: "i485", label: "Green card" },
];
/** Room past the last date for a step that has no end, drawn hatched to the edge. */
const OPEN_END_DAYS = 120;
const MAX_PEOPLE = 20;

const FIELD =
  "mt-1.5 min-h-11 w-full min-w-0 border-2 border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const CHECK = "size-5 accent-primary";
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const at = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const clampInt = (raw: string, lo: number, hi: number, fallback: number) => {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
};

/** The lengths a reader may change, and how each is shown. */
const ASSUMPTIONS = [
  { key: "pwdWaitDays", label: "Wage request, days" },
  { key: "recruitmentDays", label: "Recruitment, days" },
  { key: "permWaitDays", label: "PERM, days" },
  { key: "i140Months", label: "I-140, months" },
  { key: "i485Months", label: "I-485, months" },
  { key: "paceDaysPerMonth", label: "Cutoff moves, days a month" },
] as const satisfies readonly { key: keyof PlanFigures; label: string }[];
type AssumptionKey = (typeof ASSUMPTIONS)[number]["key"];

export interface GreenCardPlannerProps {
  /** The measured figures: the plan's default assumptions. */
  figures: PlanFigures;
  /** Where each step stands today, one short line each. */
  standing: Partial<Record<PlanStage, string>>;
  check: BulletinCheck | null;
  today: string;
}

export function GreenCardPlanner({ figures, standing, check, today }: GreenCardPlannerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useUrlSearchParams();
  const id = useId();
  const ids = (k: string) => `${id}-${k}`;

  // The case's inputs come from the address and go back to it.
  const where: Where = WHERE.find((w) => w.key === params.get("where"))?.key ?? "start";
  const date = ISO_DAY.test(params.get("date") ?? "") ? params.get("date")! : today;
  const pd = ISO_DAY.test(params.get("pd") ?? "") ? params.get("pd")! : "";
  const category: Category = params.get("cat") === "EB3" ? "EB3" : "EB2";
  const country = COUNTRIES.find((c) => c[0] === params.get("country"))?.[0] ?? "worldwide";
  const premium = params.get("premium") === "1";
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // The fees and the assumptions are the reader's own, kept on the page.
  const [petitioner, setPetitioner] = useState<FeeInput["petitioner"]>("regular");
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);
  const [extras, setExtras] = useState(true);
  const [own, setOwn] = useState<Partial<Record<AssumptionKey, number>>>({});

  const assumed: PlanFigures = { ...figures, ...own };
  const step = WHERE.find((w) => w.key === where)!;
  const plan = useMemo(
    () =>
      ISO_DAY.test(date)
        ? buildPlan(
            {
              where,
              date,
              priorityDate: NEEDS_PRIORITY_DATE.has(where) && ISO_DAY.test(pd) ? pd : undefined,
              category,
              country,
              premium,
              fees: { petitioner, adults, children: kids, workPermits: extras ? adults : 0, travelDocuments: extras ? adults : 0 },
              today,
            },
            assumed,
          )
        : null,
    // `assumed` is rebuilt each render from `figures` and `own`, which are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [where, date, pd, category, country, premium, petitioner, adults, kids, extras, today, figures, own],
  );
  const line = `${CATEGORIES.find((c) => c[0] === category)![2]}, ${COUNTRIES.find((c) => c[0] === country)![1]}`;
  const cell = figures.pace[`${category}|${country}`] ?? null;
  // The bulletin step's line follows the reader's own category and country.
  const now = cell && figures.bulletinMonth
    ? { ...standing, visa: `Now: the ${monthYear(figures.bulletinMonth)} cutoff for ${line} is ${cutoffLabel(cell.latest)}` }
    : standing;

  return (
    <div>
      <fieldset className="object p-5 sm:p-6">
        <legend className="sr-only">Your case</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <Field id={ids("where")} label="Where your case is">
            <select id={ids("where")} value={where} onChange={(e) => set({ where: e.target.value === "start" ? null : e.target.value })} className={FIELD}>
              {WHERE.map((w) => (
                <option key={w.key} value={w.key}>
                  {w.label}
                </option>
              ))}
            </select>
          </Field>{" "}
          <Field id={ids("date")} label={step.dateLabel}>
            <DateInput id={ids("date")} value={date} onChange={(e) => set({ date: e.target.value })} className="mt-1.5" />
          </Field>{" "}
          {NEEDS_PRIORITY_DATE.has(where) ? (
            <Field id={ids("pd")} label="Priority date (PERM filed on)">
              <DateInput id={ids("pd")} value={pd} onChange={(e) => set({ pd: e.target.value })} className="mt-1.5" />
            </Field>
          ) : null}{" "}
          <Field id={ids("cat")} label="Category">
            <select id={ids("cat")} value={category} onChange={(e) => set({ cat: e.target.value === "EB2" ? null : e.target.value })} className={FIELD}>
              {CATEGORIES.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>{" "}
          <Field id={ids("country")} label="Country of birth">
            <select id={ids("country")} value={country} onChange={(e) => set({ country: e.target.value === "worldwide" ? null : e.target.value })} className={FIELD}>
              {COUNTRIES.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>{" "}
          <label htmlFor={ids("premium")} className="flex min-h-11 items-center gap-3 self-end text-base">
            <input id={ids("premium")} type="checkbox" checked={premium} onChange={(e) => set({ premium: e.target.checked ? "1" : null })} className={CHECK} /> Premium processing on the I-140
          </label>
        </div>
      </fieldset>{" "}

      {plan ? (
        <div aria-live="polite">
          <Milestones plan={plan} line={line} today={today} certifiedOn={where === "perm-certified" ? date : null} bulletinMonth={figures.bulletinMonth} kind={cell?.latest.kind ?? null} />{" "}
          <PlanChart steps={plan.steps} today={today} standing={now} />{" "}
          {plan.gapDays !== null && plan.gapDays > 0 && check ? (
            <p className="mt-6 border-l-4 border-data-info-ink pl-4 text-base leading-relaxed">
              <span className="font-semibold">The bulletin wait is the least certain step. </span>
              {bulletinCheckSentence(check, plan.gapDays)}
            </p>
          ) : null}{" "}
          <Assumptions figures={figures} own={own} setOwn={setOwn} />{" "}
          <PlanFees plan={plan}>
            <Field id={ids("pet")} label="Employer's staff">
              <select id={ids("pet")} value={petitioner} onChange={(e) => setPetitioner(e.target.value as FeeInput["petitioner"])} className={FIELD}>
                <option value="regular">26 or more</option>
                <option value="small">25 or fewer</option>
                <option value="nonprofit">A nonprofit</option>
              </select>
            </Field>{" "}
            <Field id={ids("adults")} label="People 14 and over">
              <input id={ids("adults")} type="number" inputMode="numeric" min={1} max={MAX_PEOPLE} value={adults} onChange={(e) => setAdults(clampInt(e.target.value, 1, MAX_PEOPLE, 1))} className={FIELD} />
            </Field>{" "}
            <Field id={ids("kids")} label="Children under 14">
              <input id={ids("kids")} type="number" inputMode="numeric" min={0} max={MAX_PEOPLE} value={kids} onChange={(e) => setKids(clampInt(e.target.value, 0, MAX_PEOPLE, 0))} className={FIELD} />
            </Field>{" "}
            <label htmlFor={ids("extras")} className="flex min-h-11 items-center gap-3 self-end text-base">
              <input id={ids("extras")} type="checkbox" checked={extras} onChange={(e) => setExtras(e.target.checked)} className={CHECK} /> A work permit and travel document for each
            </label>
          </PlanFees>
        </div>
      ) : (
        <p className="mt-6 text-base text-soft">Enter a date to see the plan.</p>
      )}
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label> {children}
    </div>
  );
}

const STATE_FILL: Record<PlanStep["state"], string> = {
  done: "bg-data-good-ink",
  now: "bg-primary border-2 border-foreground",
  ahead: "bg-chart-yellow border-2 border-data-warn",
};
const fillOf = (s: PlanStep) =>
  !s.end ? "bg-background bg-hatch border-2 border-input" : s.key === "visa" && s.state !== "done" ? "bg-chart-blue border-2 border-data-info-ink" : STATE_FILL[s.state];
const STATE_WORD: Record<PlanStep["state"], string> = { done: "Done", now: "Under way", ahead: "Ahead" };

function Milestones({
  plan,
  line,
  today,
  certifiedOn,
  bulletinMonth,
  kind,
}: {
  plan: Plan;
  line: string;
  today: string;
  /** The certification day, when the reader starts from a certified PERM. */
  certifiedOn: string | null;
  bulletinMonth: string | null;
  kind: string | null;
}) {
  const month = bulletinMonth ? monthYear(bulletinMonth) : null;
  const tiles = MILESTONES.map((m) => {
    const s = plan.steps.find((x) => x.key === m.key);
    // A step before the plan starts is behind the reader: done, dated when we know the day.
    const before = !s && m.key !== "recruitment";
    const day = m.key === "recruitment" ? plan.priorityDate : before ? (m.key === "perm" ? certifiedOn : null) : (s?.end ?? null);
    return { ...m, day, before, state: s?.state ?? "done" };
  });
  const why = kind === "unavailable" ? `${line} is unavailable in the ${month} bulletin.` : `${line}'s cutoff hasn't moved enough to measure.`;
  return (
    <div className="mt-8">
      <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0">
        {tiles.map((t) => {
          const last = t.key === "i485";
          return (
            <li key={t.key} className={cn("p-4 sm:p-5", last ? "bg-foreground text-background" : "bg-tint")}>
              <p className={cn("text-sm", last ? "opacity-80" : "text-soft")}>{t.label}</p>{" "}
              <p className="mt-1 font-heading text-2xl font-bold leading-tight tabular-nums sm:text-3xl">
                {t.day ? (last ? monthYear(t.day.slice(0, 7)) : shortDate(t.day)) : t.before ? "Done" : "No date yet"}
              </p>{" "}
              <p className={cn("mt-1 text-sm", last ? "opacity-80" : "text-soft")}>
                {t.before
                  ? "Before this plan starts"
                  : !t.day
                    ? "Waits on the bulletin"
                    : t.day > today
                      ? `In ${aboutMonths(daysBetween(today, t.day))}`
                      : t.day === today
                        ? "Today"
                        : t.key === "recruitment"
                          ? "Filed"
                          : STATE_WORD[t.state]}
              </p>{" "}
            </li>
          );
        })}
      </ol>{" "}
      <p className="mt-4 text-base leading-relaxed text-soft">
        {line}.{" "}
        {plan.current
          ? `Current in the ${month} bulletin, so the I-485 goes in with the I-140.`
          : plan.bulletinMonths !== null
            ? `About ${Math.round(plan.bulletinMonths)} months after the ${month} cutoff, at the pace it has kept.`
            : `${why} Every step before the bulletin is still dated.`}
      </p>
    </div>
  );
}

/** The most year labels the chart's axis carries. */
const YEAR_LABELS_MAX = 7;
const YEAR_STEPS = [1, 2, 5, 10, 20] as const;

function PlanChart({ steps, today, standing }: { steps: PlanStep[]; today: string; standing: Partial<Record<PlanStage, string>> }) {
  const known = steps.flatMap((s) => (s.end ? [s.start, s.end] : [s.start])).concat(today);
  const lo = Math.min(...known.map(at));
  const hiKnown = Math.max(...known.map(at));
  const hi = steps.some((s) => !s.end) ? hiKnown + OPEN_END_DAYS * MS_PER_DAY : hiKnown;
  const pct = (iso: string) => ((at(iso) - lo) / Math.max(hi - lo, MS_PER_DAY)) * 100;
  const every: number[] = [];
  for (let y = new Date(lo).getUTCFullYear() + 1; Date.UTC(y, 0, 1) < hi; y++) every.push(y);
  // A long wait (EB-2 India runs decades) labels every 2nd, 5th, 10th or 20th year, so labels never overlap.
  const step = YEAR_STEPS.find((n) => Math.ceil(every.length / n) <= YEAR_LABELS_MAX) ?? YEAR_STEPS[YEAR_STEPS.length - 1]!;
  const years = every.filter((y) => y % step === 0).map(String);
  const todayAt = pct(today);
  const Ticks = () => (
    <>
      {years.map((y) => (
        <span key={y} className="absolute inset-y-0 w-px bg-border" style={{ left: `${pct(`${y}-01-01`)}%` }} />
      ))}
      <span className="absolute -inset-y-1 w-0.5 bg-foreground" style={{ left: `${todayAt}%` }} />
    </>
  );

  return (
    <section aria-label="Every step, dated" className="mt-10">
      <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-[15rem_minmax(0,1fr)] [&>*]:min-w-0">
        <span className="hidden sm:block" />{" "}
        <div className="relative h-6 text-sm tabular-nums text-soft">
          {years.map((y) => (
            <Fragment key={y}>
              <span className="absolute -translate-x-1/2" style={{ left: `${pct(`${y}-01-01`)}%` }}>
                {y}
              </span>{" "}
            </Fragment>
          ))}
        </div>
      </div>{" "}
      <ol className="divide-y-2 divide-border border-y-2 border-border">
        {steps.map((s) => (
          <li key={s.key} className="grid grid-cols-1 gap-x-4 gap-y-2 py-3 sm:grid-cols-[15rem_minmax(0,1fr)] sm:items-center [&>*]:min-w-0">
            <div className="leading-snug">
              <div className="flex flex-wrap items-center gap-x-2">
                <Link href={STEP_HREF[s.key]} className="link inline-flex min-h-11 items-center gap-1 font-semibold">
                  {s.name} <ArrowRightIcon aria-hidden="true" className="size-4" weight="bold" />
                </Link>{" "}
                <span className="border-2 border-input px-1.5 text-sm">{OWNER_LABEL[s.owner]}</span>
              </div>{" "}
              <p className="text-sm tabular-nums text-soft">
                {s.end && s.end !== s.start ? `${shortDate(s.start)} to ${shortDate(s.end)}` : s.end ? shortDate(s.end) : `From ${shortDate(s.start)}`}
              </p>
            </div>{" "}
            <div>
              <div aria-hidden="true" className="relative h-8 bg-tint">
                <Ticks />
                <span className={cn("absolute inset-y-1", fillOf(s))} style={{ left: `${pct(s.start)}%`, width: `${Math.max((s.end ? pct(s.end) : 100) - pct(s.start), 0.8)}%` }} />
              </div>{" "}
              <details className="group mt-1">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm text-soft [&::-webkit-details-marker]:hidden">
                  {standing[s.key] ?? s.basis}{" "}
                  <CaretDownIcon aria-hidden="true" className="size-3.5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" weight="bold" />
                </summary>{" "}
                <p className="pb-2 text-sm leading-relaxed">
                  {s.detail} Length: {s.basis.charAt(0).toLowerCase() + s.basis.slice(1)}.
                </p>
              </details>
            </div>{" "}
          </li>
        ))}
      </ol>{" "}
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-soft">
        <Key className="bg-data-good-ink">Done</Key> <Key className="border-2 border-foreground bg-primary">Under way</Key>{" "}
        <Key className="border-2 border-data-warn bg-chart-yellow">Ahead</Key>{" "}
        <Key className="border-2 border-data-info-ink bg-chart-blue">Waiting on the bulletin</Key>{" "}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-4 w-0.5 bg-foreground" /> Today
        </span>
      </p>
    </section>
  );
}

function Key({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("size-3", className)} /> {children}
    </span>
  );
}

function Assumptions({
  figures,
  own,
  setOwn,
}: {
  figures: PlanFigures;
  own: Partial<Record<AssumptionKey, number>>;
  setOwn: (next: Partial<Record<AssumptionKey, number>>) => void;
}) {
  const id = useId();
  const changed = Object.keys(own).length > 0;
  const shown = (k: AssumptionKey) => own[k] ?? figures[k] ?? "";
  return (
    <details className="mt-8 border-2 border-border" open={changed || undefined}>
      <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold">Change the assumptions</summary>{" "}
      <div className="border-t-2 border-border p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6 [&>*]:min-w-0">
          {ASSUMPTIONS.map((a) => (
            <Field key={a.key} id={`${id}-${a.key}`} label={a.label}>
              <input
                id={`${id}-${a.key}`}
                type="number"
                inputMode="decimal"
                min={a.key === "recruitmentDays" ? RECRUITMENT_MIN_DAYS : 0}
                step="any"
                value={shown(a.key)}
                placeholder={a.key === "paceDaysPerMonth" ? "Measured" : undefined}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const next = { ...own };
                  if (e.target.value === "" || !Number.isFinite(v) || v < 0) delete next[a.key];
                  else next[a.key] = v;
                  setOwn(next);
                }}
                className={FIELD}
              />
            </Field>
          ))}
        </div>{" "}
        <button
          type="button"
          disabled={!changed}
          onClick={() => setOwn({})}
          className="mt-4 inline-flex min-h-11 items-center gap-2 border-2 border-foreground px-4 font-semibold disabled:opacity-50"
        >
          <ArrowCounterClockwiseIcon aria-hidden="true" className="size-4" /> Back to today&apos;s figures
        </button>
      </div>
    </details>
  );
}

function PlanFees({ plan, children }: { plan: Plan; children: ReactNode }) {
  const f = plan.fees;
  return (
    <section aria-label="Government fees" className="mt-12">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] [&>*]:min-w-0">
        <div className="bg-tint p-5 sm:p-6">
          <p className="text-sm text-soft">Government fees, the whole way</p>{" "}
          <p className="font-heading text-4xl font-bold tabular-nums">{usd(f.total)}</p>{" "}
          <p className="mt-2 text-sm leading-relaxed text-soft">
            USCIS&apos;s fee schedule, edition {f.edition}. DOL charges nothing for the wage request or the PERM.
          </p>{" "}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">{children}</div>
        </div>{" "}
        <div>
          <ul className="divide-y-2 divide-border border-y-2 border-border">
            {f.lines.map((l) => (
              <li key={`${l.form} ${l.label}`} className="flex items-baseline justify-between gap-4 py-2.5 text-base">
                <span className="min-w-0">
                  <b className="font-semibold">{l.form}</b> {l.label}
                  {l.count > 1 ? `, ${l.count} × ${usd(l.each)}` : ""}
                </span>{" "}
                <span className="shrink-0 font-mono tabular-nums">{usd(l.total)}</span>{" "}
              </li>
            ))}
          </ul>{" "}
          <p className="mt-3 text-sm leading-relaxed text-soft">
            Not in the total: the PERM&apos;s own costs (the attorney and the ads), which the employer must pay, the
            medical exam, and translations.
          </p>
        </div>
      </div>
    </section>
  );
}
