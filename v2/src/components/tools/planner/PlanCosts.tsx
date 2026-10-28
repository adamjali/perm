"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import { useId } from "react";

import { CONSULAR_STAGE, FEE_SCHEDULE, PLAN_STAGES, STATE_FEES, type OwnCosts, type PetitionerKind, type Plan, type PlanStage } from "@/lib/perm";
import { cn } from "@/lib/utils";

import { CHECK, Field, FIELD } from "./CaseInputs";
import { dayLabel, usd } from "./format";
import { NumberBox } from "./NumberBox";

/** The most people one case files for, the fee schedule's own limit. */
export const MAX_PEOPLE = 20;
/** The most a reader may type for one cost, so a slip of the keyboard can't print a billion. */
const MAX_OWN_COST = 1_000_000;

export interface FeeChoices {
  petitioner: PetitionerKind;
  adults: number;
  kids: number;
  /** A work permit and a travel document for each adult (inside the US only). */
  extras: boolean;
  /** The forms USCIS takes online (the I-140, I-485 and I-131) filed that way. */
  online: boolean;
}
export const DEFAULT_FEES: FeeChoices = { petitioner: "regular", adults: 1, kids: 0, extras: true, online: false };

/** The costs no schedule fixes, each with where it's typed. */
const OWN_FIELDS: readonly { key: keyof OwnCosts; label: string; cpLabel?: string }[] = [
  { key: "permAttorney", label: "Attorney for the PERM" },
  { key: "recruitment", label: "Recruitment and ads" },
  { key: "i140Attorney", label: "Attorney for the I-140" },
  { key: "i485Attorney", label: "Attorney for the I-485", cpLabel: "Attorney for consular processing" },
  { key: "medicalEach", label: "Medical exam, each" },
];

/** The asylum program fee on the I-140 turns on the employer's size (G-1055). */
const PETITIONER_LABEL: Record<PetitionerKind, string> = {
  regular: "26 or more employees",
  small: "25 or fewer employees",
  nonprofit: "A nonprofit",
};

const STEP_NAME = Object.fromEntries([...PLAN_STAGES, CONSULAR_STAGE].map((s) => [s.key, s.name])) as Record<PlanStage, string>;
const PAYER_LABEL = { employer: "Employer pays", agreed: "Employer or you" } as const;

/**
 * Every cost, on the day it falls due: the government fees from USCIS's schedule (and State's,
 * through a consulate), and the reader's own
 * lines for what no schedule fixes. The PERM's costs are the employer's by law; the rest is for
 * the employer and the worker to agree.
 */
export function PlanCosts({
  plan,
  fees,
  setFees,
  own,
  setOwn,
  today,
}: {
  plan: Plan;
  fees: FeeChoices;
  setFees: (f: FeeChoices) => void;
  own: OwnCosts;
  setOwn: (o: OwnCosts) => void;
  today: string;
}) {
  const id = useId();
  const ids = (k: string) => `${id}-${k}`;
  const rows = [...plan.costs].sort((a, b) => (a.due?.mid ?? "9999").localeCompare(b.due?.mid ?? "9999"));
  const { all, employer, agreed } = plan.totals;
  const share = (n: number) => (all > 0 ? (n / all) * 100 : 0);
  const people = (raw: number | null, lo: number) => Math.max(lo, Math.min(MAX_PEOPLE, Math.floor(raw ?? lo)));

  const changedFees = fees.petitioner !== DEFAULT_FEES.petitioner || fees.adults !== DEFAULT_FEES.adults || fees.kids !== DEFAULT_FEES.kids || fees.extras !== DEFAULT_FEES.extras || fees.online !== DEFAULT_FEES.online;

  return (
    <section aria-labelledby={ids("h")} className="mt-14">
      <h2 id={ids("h")} className="font-heading text-2xl font-bold">
        What it costs, and when
      </h2>{" "}
      <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] [&>*]:min-w-0">
        <div className="self-start bg-tint p-5 sm:p-6">
          <p className="text-sm text-soft">The whole way</p>{" "}
          <p className="font-heading text-5xl font-bold tabular-nums">{usd(all)}</p>{" "}
          <div aria-hidden="true" className="mt-4 flex h-3 w-full bg-background">
            <span className="h-full bg-primary" style={{ width: `${share(employer)}%` }} />
            <span className="h-full bg-chart-blue" style={{ width: `${share(agreed)}%` }} />
          </div>{" "}
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm [&>*]:min-w-0">
            <div>
              <dt className="flex items-center gap-1.5 text-soft">
                <span aria-hidden="true" className="size-3 border-2 border-foreground bg-primary" /> {PAYER_LABEL.employer}
              </dt>{" "}
              <dd className="text-base font-semibold tabular-nums">{usd(employer)}</dd>
            </div>{" "}
            <div>
              <dt className="flex items-center gap-1.5 text-soft">
                <span aria-hidden="true" className="size-3 border-2 border-data-info-ink bg-chart-blue" /> {PAYER_LABEL.agreed}
              </dt>{" "}
              <dd className="text-base font-semibold tabular-nums">{usd(agreed)}</dd>
            </div>
          </dl>{" "}
          <div className="mt-5 border-t-2 border-border pt-4">
            <Field id={ids("pet")} label="The employer" hint={`The I-140's asylum program fee: ${usd(FEE_SCHEDULE.asylumProgramFee.regular)}, ${usd(FEE_SCHEDULE.asylumProgramFee.small)} for 25 or fewer, none for a nonprofit`}>
              <select id={ids("pet")} value={fees.petitioner} onChange={(e) => setFees({ ...fees, petitioner: e.target.value as PetitionerKind })} className={FIELD}>
                {(Object.keys(PETITIONER_LABEL) as PetitionerKind[]).map((k) => (
                  <option key={k} value={k}>
                    {PETITIONER_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>{" "}
        <ol aria-label="Each cost, in the order it falls due" className="relative border-l-2 border-border pl-5">
          {rows.map((c) => (
            <li key={c.key} className="relative pb-4 last:pb-0">
              <span
                aria-hidden="true"
                className={cn("absolute -left-[1.6rem] top-1.5 size-3 border-2", c.payer === "employer" ? "border-foreground bg-primary" : "border-data-info-ink bg-chart-blue")}
              />{" "}
              <p className="text-sm tabular-nums text-soft">
                {c.due ? dayLabel(c.due.mid, today) : "When its step is dated"}, {STEP_NAME[c.step]}
              </p>{" "}
              <div className="flex items-baseline justify-between gap-4">
                <p className="min-w-0 text-base">
                  {c.form && c.source === "schedule" ? <b className="font-semibold">{c.form}</b> : null} {c.label}
                  {c.count > 1 ? `, ${c.count} × ${usd(c.each)}` : ""}
                  <span className="sr-only">. {PAYER_LABEL[c.payer]}.</span>
                </p>{" "}
                <p className="shrink-0 font-mono tabular-nums">{usd(c.amount)}</p>
              </div>{" "}
            </li>
          ))}
        </ol>
      </div>{" "}
      <details className="group mt-8 border-y-2 border-border" open={changedFees || Object.keys(own).length > 0 || undefined}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 font-semibold [&::-webkit-details-marker]:hidden">
          Your family, and your own costs{" "}
          <CaretDownIcon aria-hidden="true" className="ml-auto size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" weight="bold" />
        </summary>{" "}
        <div className="grid grid-cols-1 gap-8 pb-6 lg:grid-cols-2 [&>*]:min-w-0">
          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <legend className="mb-2 text-sm text-soft">The government fees depend on these</legend>
            <NumberBox id={ids("adults")} label="People 14 and over" value={fees.adults} min={1} max={MAX_PEOPLE} step={1} onChange={(n) => setFees({ ...fees, adults: people(n, 1) })} />{" "}
            <NumberBox id={ids("kids")} label="Children under 14" value={fees.kids} min={0} max={MAX_PEOPLE} step={1} onChange={(n) => setFees({ ...fees, kids: people(n, 0) })} />{" "}
            <div className="space-y-1 self-end sm:col-span-2">
              {plan.route === "aos" ? (
                <label htmlFor={ids("extras")} className="flex min-h-11 items-center gap-3 text-base">
                  <input id={ids("extras")} type="checkbox" checked={fees.extras} onChange={(e) => setFees({ ...fees, extras: e.target.checked })} className={CHECK} /> Work permit and travel document
                </label>
              ) : null}{" "}
              <label htmlFor={ids("online")} className="flex min-h-11 items-center gap-3 text-base">
                <input id={ids("online")} type="checkbox" checked={fees.online} onChange={(e) => setFees({ ...fees, online: e.target.checked })} className={CHECK} />{" "}
                {plan.route === "aos" ? "Filed online where USCIS allows (I-140, I-485, I-131)" : "I-140 filed online"}
              </label>
            </div>
          </fieldset>{" "}
          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <legend className="mb-2 text-sm text-soft">No schedule fixes these; each lands on its step&apos;s day</legend>
            {OWN_FIELDS.map((f) => (
              <NumberBox
                key={f.key}
                id={ids(f.key)}
                label={plan.route === "cp" ? (f.cpLabel ?? f.label) : f.label}
                prefix="$"
                value={own[f.key] ?? null}
                max={MAX_OWN_COST}
                step={1}
                placeholder="0"
                onChange={(n) => {
                  const next = { ...own };
                  if (n === null || n === 0) delete next[f.key];
                  else next[f.key] = n;
                  setOwn(next);
                }}
              />
            ))}
          </fieldset>
        </div>
      </details>{" "}
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-soft">
        USCIS&apos;s fees are from its fee schedule, Form G-1055, edition {plan.fees.edition}{" "}
        (<a href={FEE_SCHEDULE.source} target="_blank" rel="noopener noreferrer" className="link">
          read it at USCIS
        </a>
        ).{" "}
        {plan.route === "cp" ? (
          <>
            The State Department&apos;s visa fee is from its own schedule,{" "}
            <a href={STATE_FEES.source} target="_blank" rel="noopener noreferrer" className="link">
              {STATE_FEES.citation}
            </a>
            .{" "}
          </>
        ) : null}
        DOL charges nothing for the wage request or the PERM. The employer must pay the PERM&apos;s own costs, its attorney and
        recruitment included (20 CFR 656.12(b)).
      </p>
    </section>
  );
}
