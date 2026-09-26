"use client";

import { Fragment, useId } from "react";

import {
  DECIDED_FILTER_FIELDS,
  anyDecidedFilter,
  facetOptions,
  type DecidedFilters as Filters,
} from "@/lib/decidedFilter";
// One line, deliberately: no-server-only-in-client.test.ts checks each import line on its own.
import type { DecidedCase } from "@/lib/turso/decidedDays";

const CONTROL =
  "mt-1 w-full min-w-0 min-h-[44px] border-2 border-border bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary";
const LABEL =
  "block font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground";

/** More options than this and a select stops being a way to choose. */
const MAX_OPTIONS = 250;

function money(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * The decided half's filters: every published field the loaded rows carry.
 *
 * A field no loaded row carries isn't offered at all (citizenship and
 * education exist only on cases filed on DOL's old form), and the note under
 * the panel names what's missing for these dates rather than leaving a select
 * that can only ever say "any".
 */
export function DecidedFilters({
  rows,
  value,
  onChange,
}: {
  rows: readonly DecidedCase[];
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const id = useId();
  const live = DECIDED_FILTER_FIELDS.map((f) => ({
    f,
    opts: facetOptions(rows, f),
  }));
  const shown = live.filter((x) => x.opts.length > 0);
  const missing = live
    .filter((x) => x.opts.length === 0)
    .map((x) => x.f.label.toLowerCase());

  return (
    <div className="mt-4 border-2 border-border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        {shown.map(({ f, opts }) => (
          <Fragment key={f.key}>
            {" "}
            <div>
              <label htmlFor={`${id}-${f.key}`} className={LABEL}>
                {f.label}
              </label>{" "}
              <select
                id={`${id}-${f.key}`}
                value={value[f.key] ?? ""}
                onChange={(e) =>
                  onChange({ ...value, [f.key]: e.target.value || undefined })
                }
                className={CONTROL}
              >
                <option value="">
                  Any ({opts.length.toLocaleString("en-US")})
                </option>
                {opts.slice(0, MAX_OPTIONS).map((o) => (
                  <option key={o.value} value={o.value}>
                    {`${o.value} (${o.n.toLocaleString("en-US")})`}
                  </option>
                ))}
              </select>
            </div>
          </Fragment>
        ))}{" "}
        <div>
          <label htmlFor={`${id}-wmin`} className={LABEL}>
            Wage at least
          </label>{" "}
          <input
            id={`${id}-wmin`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            value={value.wageMin ?? ""}
            onChange={(e) =>
              onChange({ ...value, wageMin: money(e.target.value) })
            }
            className={CONTROL}
          />
        </div>{" "}
        <div>
          <label htmlFor={`${id}-wmax`} className={LABEL}>
            Wage at most
          </label>{" "}
          <input
            id={`${id}-wmax`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            value={value.wageMax ?? ""}
            onChange={(e) =>
              onChange({ ...value, wageMax: money(e.target.value) })
            }
            className={CONTROL}
          />
        </div>
      </div>{" "}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-relaxed text-foreground/80">
          Filters run over the rows loaded for these dates. Wages are as filed,
          so an hourly and a yearly figure compare as numbers.
          {missing.length > 0
            ? ` Not published for any loaded case: ${missing.join(", ")}. DOL prints the worker's citizenship and education only on its old form.`
            : ""}
        </p>{" "}
        {anyDecidedFilter(value) ? (
          <button
            type="button"
            onClick={() => onChange({})}
            className="min-h-[44px] border-2 border-border bg-card px-4 font-mono text-sm font-bold uppercase tracking-wider hover:bg-tint-primary focus-visible:ring-2 focus-visible:ring-primary"
          >
            Clear these filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
