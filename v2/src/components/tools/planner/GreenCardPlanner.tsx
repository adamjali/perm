"use client";

import { usePathname, useRouter } from "next/navigation";
import { LinkSimpleIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { BulletinAlertForm } from "@/components/tools/BulletinAlertForm";
import { RequestFailed } from "@/components/tools/RequestFailed";
import { useDebounce } from "@/hooks/useDebounce";
import { usePublicQuery } from "@/hooks/usePublicQuery";
import { useUrlSearchParams } from "@/hooks/useUrlSearchParams";
import type { BulletinCheck } from "@/lib/bulletinCheck";
import { cutoffLabel } from "@/lib/bulletinNext";
import type { PlanReading } from "@/lib/db/planFigures";
import { buildPlan, type OwnCosts, type Plan, type PlanInput, type Span } from "@/lib/perm";
import { PLAN_QUEUE_FROM, planQueryHref, type PlanAnswer, type PlanQuery } from "@/lib/planQuery";
import { cn } from "@/lib/utils";
import { monthYear } from "@convex/lib/months";

import { baseSpan, changedCount, figuresFor, NO_OVERRIDES, type Overrides } from "./assumptions";
import { AnswerBand } from "./AnswerBand";
import { BulletinChoice, BulletinNote, type LineState } from "./BulletinWays";
import { CaseInputs, CATEGORY_LABEL, COUNTRY_LABEL } from "./CaseInputs";
import { ChangeFigures, type QueueChoice, type StepEditor } from "./ChangeFigures";
import { DateRail } from "./DateRail";
import { LENGTH_UNIT, type LengthKey } from "./format";
import { DEFAULT_FEES, PlanCosts, type FeeChoices } from "./PlanCosts";
import { PlanTimeline } from "./PlanTimeline";
import { readPlanUrl } from "./planUrl";

/** How long the planner waits after the last keystroke before asking the queues. */
const ASK_AFTER_MS = 400;
/** How long "Link copied" stays up. */
const COPIED_MS = 2500;

/**
 * The whole employment-based green card for one case: where it stands, the dates it has, and
 * every step after it as a range, dated from the figures the site measures; every length,
 * the bulletin's pace and the yearly issuance editable; every cost on its due day (owner,
 * Oct 27 and 28 2026). The case's dates live in the address, so a plan can be shared and the
 * case page links to one already filled in. A filed PERM or wage request is dated from the
 * cases ahead of it, by the same models its own pages use (/api/plan).
 */
export function GreenCardPlanner({ reading, check, today }: { reading: PlanReading; check: BulletinCheck | null; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useUrlSearchParams();
  const state = readPlanUrl(params, today);
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const [o, setO] = useState<Overrides>(NO_OVERRIDES);
  const [fees, setFees] = useState<FeeChoices>(DEFAULT_FEES);
  const [own, setOwn] = useState<OwnCosts>({});
  const [copied, setCopied] = useState(false);
  // The figures fold opens by itself once anything in it is changed, and from the bulletin line.
  const [figuresOpen, setFiguresOpen] = useState(false);

  // What only the server can date: a filed wage request or PERM by the cases ahead of it,
  // and the people ahead of a priority date in its line.
  const { known } = state;
  const inQueues = (d: string | undefined) => (d && d >= PLAN_QUEUE_FROM && d <= today ? d : undefined);
  const question: PlanQuery = {};
  const pwdAsk = !known.pwdIssued ? inQueues(known.pwdFiled) : undefined;
  const permAsk = !known.permCertified ? inQueues(known.permFiled) : undefined;
  if (pwdAsk) question.pwd = pwdAsk;
  if (permAsk) question.perm = permAsk;
  if (known.permFiled && known.permFiled <= today && !known.i485Filed) {
    question.line = { pd: known.permFiled, category: state.category, country: state.country };
  }
  const href = useDebounce(planQueryHref(question), ASK_AFTER_MS);
  const asked = usePublicQuery<PlanAnswer>(href ?? "skip");
  const answer = href ? (asked.data ?? null) : null;
  const waiting = !!href && !asked.data && !asked.failed;

  const figures = figuresFor(reading.figures, o, state.category, answer, check);
  const input: PlanInput = {
    known,
    startOn: state.startOn,
    category: state.category,
    country: state.country,
    premium: state.premium,
    route: state.route,
    fees: {
      petitioner: fees.petitioner,
      online: fees.online,
      adults: fees.adults,
      children: fees.kids,
      workPermits: fees.extras ? fees.adults : 0,
      travelDocuments: fees.extras ? fees.adults : 0,
    },
    own,
    today,
  };
  // Pure and quick (a few hundred date sums), so it runs every render rather than through a memo.
  const plan = buildPlan(input, figures);
  // The same plan from DOL's plain wait, to show beside a queue's date.
  const plain: Plan | null = answer?.pwd || answer?.perm ? buildPlan(input, { ...figures, pwdByQueue: null, permByQueue: null }) : null;

  const lineName = `${CATEGORY_LABEL[state.category].short}, ${COUNTRY_LABEL[state.country]}`;
  const cell = reading.figures.pace[`${state.category}|${state.country}`] ?? null;
  const standing = {
    ...reading.standing,
    ...(cell && reading.figures.bulletinMonth
      ? { visa: `Now: the ${monthYear(reading.figures.bulletinMonth)} cutoff for ${lineName} is ${cutoffLabel(cell.latest)}` }
      : {}),
  };

  const editors: Partial<Record<LengthKey, StepEditor>> = {};
  for (const k of Object.keys(LENGTH_UNIT) as LengthKey[]) {
    editors[k] = {
      base: baseSpan(reading.figures, k, state.category),
      own: o.lengths[k],
      onChange: (span: Span | null) =>
        setO((prev) => {
          const lengths = { ...prev.lengths };
          if (span) lengths[k] = span;
          else delete lengths[k];
          return { ...prev, lengths };
        }),
    };
  }
  const queues: Partial<Record<"pwd" | "perm", QueueChoice>> = {};
  for (const k of ["pwd", "perm"] as const) {
    const dating = answer?.[k];
    if (!dating) continue;
    queues[k] = {
      dating,
      on: o.byQueue[k],
      onChange: (on) => setO((prev) => ({ ...prev, byQueue: { ...prev.byQueue, [k]: on } })),
      plain: plain?.milestones[k === "pwd" ? "pwdIssued" : "permCertified"] ?? null,
    };
  }

  const firstOpen = plan.steps.find((s) => !s.end);
  const noDateWhy = !firstOpen
    ? "No date yet"
    : firstOpen.key === "visa"
      ? cell?.latest.kind === "unavailable"
        ? `Unavailable in the ${monthYear(reading.figures.bulletinMonth) ?? "newest"} bulletin`
        : "Waits on the bulletin"
      : `No measured wait for the ${firstOpen.name.toLowerCase()}`;
  const changes = changedCount(o);
  const lineState: LineState = answer?.line ? "ready" : question.line ? (asked.failed ? "failed" : waiting ? "loading" : "ready") : "not-yet";
  const openFigures = () => {
    setFiguresOpen(true);
    document.getElementById("figures")?.scrollIntoView({ block: "start" });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      <CaseInputs state={state} set={set} />{" "}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        <button type="button" onClick={copyLink} className="link inline-flex min-h-11 items-center gap-1.5">
          <LinkSimpleIcon aria-hidden="true" className="size-4" weight="bold" /> Copy a link to these dates
        </button>{" "}
        <span role="status" className="text-sm text-soft">
          {copied ? "Link copied" : ""}
        </span>
      </div>{" "}
      {plan.problems.length ? (
        <div role="alert" className="mt-6 border-l-4 border-destructive bg-soft-bad p-4">
          <p className="font-semibold">These dates can&apos;t all be right:</p>{" "}
          <ul className="mt-1 list-disc pl-5">
            {plan.problems.map((p) => (
              <li key={p}>{p} </li>
            ))}
          </ul>
        </div>
      ) : (
        <div aria-live="polite" aria-busy={waiting || undefined} className={cn("transition-opacity motion-reduce:transition-none", waiting && "opacity-60")}>
          <p role="status" className="sr-only">
            {waiting ? "Checking DOL's queues for your dates." : ""}
          </p>{" "}
          {asked.failed ? (
            <RequestFailed
              what="The queue check"
              failure={asked.failure}
              onRetry={asked.retry}
              after="The plan below uses DOL's plain wait until it loads."
              className="mt-6 bg-tint p-4 border-2 border-border"
            />
          ) : null}{" "}
          <AnswerBand plan={plan} today={today} noDateWhy={noDateWhy} />{" "}
          <DateRail plan={plan} today={today} noDateWhy={noDateWhy} />{" "}
          {answer?.permNote && known.permFiled ? <p className="mt-6 max-w-3xl text-base leading-relaxed">{answer.permNote}</p> : null}{" "}
          <PlanTimeline steps={plan.steps} sideSteps={plan.sideSteps} today={today} />{" "}
          <BulletinNote
            plan={plan}
            cell={cell}
            lineName={lineName}
            bulletinMonth={reading.figures.bulletinMonth}
            line={answer?.line ?? null}
            lineState={lineState}
            controls={{ method: o.method, setMethod: (method) => setO((prev) => ({ ...prev, method })) }}
            onMore={openFigures}
            today={today}
          />{" "}
          <PlanCosts plan={plan} fees={fees} setFees={setFees} own={own} setOwn={setOwn} today={today} />{" "}
          {/* The next step for the reader's own line: the wait the plan is least sure of, by email as it moves. */}
          <div className="mt-14 max-w-2xl">
            <BulletinAlertForm
              key={`${state.category}|${state.country}`}
              source="green-card-timeline"
              initialCategory={state.category}
              initialCountry={state.country}
              priorityDate={known.permFiled ?? null}
            />
          </div>{" "}
          <ChangeFigures
            open={figuresOpen}
            onToggle={setFiguresOpen}
            changes={changes}
            onReset={() => setO(NO_OVERRIDES)}
            steps={plan.steps}
            sideSteps={plan.sideSteps}
            standing={standing}
            sources={reading.sources}
            editors={editors}
            queues={queues}
            today={today}
            bulletin={
              <BulletinChoice
                plan={plan}
                cell={cell}
                check={check}
                line={answer?.line ?? null}
                controls={{
                  paceDaysPerMonth: o.paceDaysPerMonth,
                  setPace: (paceDaysPerMonth) => setO((prev) => ({ ...prev, paceDaysPerMonth })),
                  perYear: o.perYear,
                  setPerYear: (perYear) => setO((prev) => ({ ...prev, perYear })),
                }}
              />
            }
          />
        </div>
      )}
    </div>
  );
}
