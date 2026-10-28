"use client";

import { useId, type ReactNode } from "react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui/label";
import { MILESTONES, type Milestone } from "@/lib/perm";
import { PLAN_CATEGORIES, PLAN_COUNTRIES, type PlanCategory, type PlanCountry } from "@/lib/planQuery";

import { milestonesUpTo, planPatch, requiredMilestones, WHERE, type PlanUrlState, type WhereKey } from "./planUrl";

export const FIELD =
  "mt-1.5 min-h-11 w-full min-w-0 border-2 border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
export const CHECK = "size-5 accent-primary";

export const CATEGORY_LABEL: Record<PlanCategory, { long: string; short: string }> = {
  EB2: { long: "EB-2 (advanced degree)", short: "EB-2" },
  EB3: { long: "EB-3 (skilled or professional)", short: "EB-3" },
};
export const COUNTRY_LABEL: Record<PlanCountry, string> = {
  worldwide: "Rest of world",
  india: "India",
  china: "China",
  mexico: "Mexico",
  philippines: "Philippines",
};
const MILESTONE_LABEL = Object.fromEntries(MILESTONES.map((m) => [m.key, m.label])) as Record<Milestone, string>;

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label> {children}
      {hint ? <p className="mt-1 text-sm text-soft">{hint}</p> : null}
    </div>
  );
}

/**
 * Where the case is and the dates it has. Where it stands sets which dates are asked for;
 * the dates before it that the reader also knows open under "I know more dates", and each
 * one pins its step on the plan.
 */
export function CaseInputs({ state, set }: { state: PlanUrlState; set: (patch: Record<string, string | null>) => void }) {
  const id = useId();
  const ids = (k: string) => `${id}-${k}`;
  const required = requiredMilestones(state.where);
  const more = milestonesUpTo(state.where).filter((m) => !required.includes(m));
  const knownMore = more.some((m) => state.known[m]);

  const dateBox = (m: Milestone) => (
    <Field key={m} id={ids(m)} label={MILESTONE_LABEL[m]}>
      <DateInput id={ids(m)} value={state.known[m] ?? ""} onChange={(e) => set(planPatch({ [m]: e.target.value || null }))} className="mt-1.5" />
    </Field>
  );

  return (
    <fieldset className="object p-5 sm:p-6">
      <legend className="sr-only">Your case</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        <Field id={ids("where")} label="Where your case is">
          <select id={ids("where")} value={state.where} onChange={(e) => set(planPatch({ where: e.target.value as WhereKey }))} className={FIELD}>
            {WHERE.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </Field>{" "}
        {state.where === "start" ? (
          <Field id={ids("on")} label="Wage request filed on" hint="Or the day it will be">
            <DateInput id={ids("on")} value={state.startOn} onChange={(e) => set(planPatch({ startOn: e.target.value || null }))} className="mt-1.5" />
          </Field>
        ) : (
          required.map(dateBox)
        )}{" "}
        <Field id={ids("cat")} label="Category">
          <select id={ids("cat")} value={state.category} onChange={(e) => set(planPatch({ category: e.target.value as PlanCategory }))} className={FIELD}>
            {PLAN_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c].long}
              </option>
            ))}
          </select>
        </Field>{" "}
        <Field id={ids("country")} label="Country of birth">
          <select id={ids("country")} value={state.country} onChange={(e) => set(planPatch({ country: e.target.value as PlanCountry }))} className={FIELD}>
            {PLAN_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>{" "}
        <label htmlFor={ids("premium")} className="flex min-h-11 items-center gap-3 text-base sm:col-span-2 lg:col-span-4">
          <input id={ids("premium")} type="checkbox" checked={state.premium} onChange={(e) => set(planPatch({ premium: e.target.checked }))} className={CHECK} />{" "}
          Premium processing on the I-140
        </label>
      </div>{" "}
      {more.length > 0 ? (
        <details className="group mt-5 border-t-2 border-border pt-3" open={knownMore || undefined}>
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold">I know more dates</summary>{" "}
          <p className="text-sm text-soft">Each one replaces its estimate on the plan.</p>{" "}
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">{more.map(dateBox)}</div>
        </details>
      ) : null}
    </fieldset>
  );
}
