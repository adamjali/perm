"use client";

import { Fragment, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { usePublicQuery } from "@/lib/usePublicQuery";
import { formatWage } from "@/lib/wageFormat";
import { normaliseCaseNumber } from "@/lib/caseNumberShape";
import { SortableHeader } from "@/components/tools/SortableHeader";
import { nextSort, sortRows, type SortColumn, type SortState } from "@/lib/tableSort";
import {
  FILTER_LABEL,
  OUTCOME_LABEL,
  availableOutcomes,
  chooseLead,
  filterAvailability,
  refusalText,
  type FilterKey,
  type FilterState,
  type Lead,
  type Outcome,
} from "@/lib/caseSearchPlan";
// One line, deliberately: no-server-only-in-client.test.ts checks each import
// line on its own, so a type import wrapped over several lines reads as a
// runtime import of a "server-only" module.
import type { Program, UnifiedCase } from "@/lib/turso/unifiedSearch";

/**
 * Every DOL filing this site holds, in one search, with every filter the
 * record can actually answer and none of the ones it cannot.
 *
 * WHY IT EXISTS. The corpus is three programs in six tables, and until now the
 * only way in was to already know which one you wanted. Somebody whose lawyer
 * said "the wage request is in" does not know that a wage request is a
 * different program from the PERM, and should not have to.
 *
 * ## Every control is always on screen, and a refused one says why
 *
 * This is the rule the whole component is built around. Two different things
 * can make a filter unanswerable and the reader deserves to know which:
 *
 * **The record does not have the field.** DOL's live case check returns a case
 * number, an employer, a job title, a filing date and a status. The wage, the
 * law firm, the worksite state and the occupation arrive only when the case
 * reaches a quarterly disclosure file. So "open cases paying over $200k" is not
 * an unbuilt feature; it is a question no source can answer. Setting one of
 * those filters drops the live half of every program, and the results say so.
 *
 * **The read would cost too much.** Which index a search rides depends on which
 * field LEADS it. An equality lead lets the index supply the ordering, so the
 * row cap stops the read at a hundred rows: the largest law firm in the corpus
 * answers in 0.67 s that way. A filter the index does not carry walks the whole
 * slice instead, which for California is 67,742 rows and 44.72 seconds,
 * measured. So a firm, state or occupation search takes an outcome and a
 * decided-date range and refuses the rest, in words, on the control.
 *
 * Both refusals come from `filterAvailability` in `@/lib/caseSearchPlan`, which
 * the route uses too - it DROPS what this greys out, because a greyed control
 * is a courtesy and a public endpoint needs a control.
 *
 * SORTING IS CLIENT-SIDE AND HONEST ABOUT IT. The server returns the newest
 * 300 matches; sorting reorders that set, it does not re-query. Sorting by
 * wage therefore shows the highest wage AMONG THE MATCHES SHOWN, not across
 * the whole corpus, and the footnote says so.
 */

const PROGRAM_LABEL: Record<Program, string> = {
  perm: "PERM",
  pwd: "Wage request",
  lca: "H-1B LCA",
};

const PROGRAM_BLURB: Record<Program, string> = {
  perm: "The labor certification itself (ETA-9089).",
  pwd: "The wage DOL sets before the PERM (ETA-9141).",
  lca: "The H-1B labor condition application (ETA-9035).",
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ALL_PROGRAMS: Program[] = ["perm", "pwd", "lca"];

const CONTROL =
  "w-full min-w-0 min-h-[44px] border-2 border-border bg-card px-3 text-base font-medium " +
  "focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed " +
  // `text-muted-foreground` (5.50:1) for the disabled state, not a half-opacity
  // foreground, which measures 3.94:1 in light and is on the contrast gate's
  // banned list. A disabled control here still has to be READ: it carries the
  // value somebody typed and a sentence saying why it is off, and greying that
  // below the floor turns a refusal into a dead end.
  // (The banned class is named by ratio rather than spelled out, because the
  // gate scans file TEXT and cannot tell a comment from a className.)
  "disabled:border-border/50 disabled:bg-tint-primary/40 disabled:text-muted-foreground";
const BUTTON =
  "min-h-[44px] border-2 border-border bg-foreground px-5 font-mono text-xs font-bold uppercase tracking-wider text-background hover:bg-primary hover:text-primary-foreground disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary";
const CHIP =
  "min-h-[44px] border-2 border-border px-4 font-mono text-xs font-bold uppercase tracking-wider transition-colors hover:bg-tint-primary focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card ";

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * The sortable columns. `descFirst` on the date, money and duration columns:
 * those are read newest-first and highest-first, and defaulting them to
 * ascending makes the first click on each feel like a bug.
 */
const COLUMNS: SortColumn<UnifiedCase>[] = [
  { key: "program", label: "Program", get: (r) => PROGRAM_LABEL[r.program] },
  { key: "status", label: "Status", get: (r) => r.status },
  { key: "employer", label: "Employer", get: (r) => r.employerName },
  { key: "title", label: "Job title", get: (r) => r.jobTitle },
  { key: "occupation", label: "Occupation", get: (r) => r.socTitle },
  { key: "state", label: "State", get: (r) => r.state },
  { key: "firm", label: "Law firm", get: (r) => r.firmName },
  { key: "wage", label: "Wage", descFirst: true, get: (r) => r.wage },
  { key: "filed", label: "Filed", descFirst: true, get: (r) => r.filedOn },
  { key: "decided", label: "Decided", descFirst: true, get: (r) => r.decidedOn },
  { key: "days", label: "Days", descFirst: true, get: (r) => r.days },
];

function statusTone(status: string, isFinal: boolean): string {
  const u = status.toUpperCase();
  if (u.startsWith("CERTIFIED") || u === "DETERMINATION ISSUED" || u.startsWith("REDETERMINATION")) {
    return "bg-primary text-primary-foreground";
  }
  if (u === "DENIED" || u.startsWith("WITHDRAWN")) return "bg-foreground text-background";
  return isFinal ? "bg-card" : "bg-tint-primary";
}

interface ResolvedEntity {
  key: string;
  name: string;
  total: number;
  alternatives: { key: string; name: string; total: number }[];
}

interface SearchResponse {
  rows: UnifiedCase[];
  counts: Record<Program, number>;
  truncated: boolean;
  capped: boolean;
  windowed: boolean;
  skipped: { live: boolean; published: boolean; because: string[] };
  lead: Lead | null;
  resolved: { firm: ResolvedEntity | null; occupation: ResolvedEntity | null };
  dropped: FilterKey[];
  needsLead: boolean;
}

export interface StateOption {
  code: string;
  total: number;
}
export interface FiscalYearOption {
  fiscalYear: string;
  total: number;
}

/**
 * A labelled control that can be refused.
 *
 * The reason is rendered as text under the field and wired with
 * `aria-describedby`, not as a `title` attribute: a tooltip is invisible to a
 * keyboard and to a phone, and this sentence is the whole point of the
 * control being on screen at all.
 */
function Field({
  label,
  state,
  filterKey,
  describedBy,
  children,
}: {
  label: string;
  state: FilterState;
  filterKey: FilterKey;
  describedBy: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block min-w-0">
      <span className="mb-1 block text-sm font-bold">{label}</span>{" "}
      {children}
      {state.on || !state.why ? null : (
        <span id={describedBy} className="mt-1 block text-sm leading-snug text-foreground/70">
          {refusalText(state.why, filterKey)}
        </span>
      )}
    </div>
  );
}

export function UnifiedCaseSearch({
  states = [],
  fiscalYears = [],
}: {
  states?: StateOption[];
  fiscalYears?: FiscalYearOption[];
}) {
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const uid = useId();

  // The lead fields.
  const [textInput, setTextInput] = useState(initial);
  const [firmInput, setFirmInput] = useState("");
  const [stateInput, setStateInput] = useState("");
  const [occInput, setOccInput] = useState("");

  // The narrowing fields.
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [titleInput, setTitleInput] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [dFromInput, setDFromInput] = useState("");
  const [dToInput, setDToInput] = useState("");
  const [fyInput, setFyInput] = useState("");
  const [wMinInput, setWMinInput] = useState("");
  const [wMaxInput, setWMaxInput] = useState("");
  const [programs, setPrograms] = useState<Program[]>(ALL_PROGRAMS);

  const [query, setQuery] = useState({ search: initial.trim() ? initial.trim() : "", n: 0 });
  // `null` means "not searched yet", which is NOT the same as "searched with
  // an empty form". An empty form submits an empty query string and the route
  // answers `needsLead`, so pressing Search with nothing filled in explains
  // itself instead of doing nothing at all.
  const [submitted, setSubmitted] = useState<string | null>(
    initial.trim() ? new URLSearchParams({ q: initial.trim() }).toString() : null,
  );

  // A CASE NUMBER TYPED HERE MUST NOT BE RUN AS AN EMPLOYER NAME. Shape only:
  // a wrong digit still makes a well-formed number, so this changes what is
  // asked, never what is asserted about the case existing.
  const typedCaseNumber = normaliseCaseNumber(textInput);

  /**
   * The lead the server will pick, worked out from the same function it uses.
   *
   * The firm and occupation boxes hold WORDS, and the server turns those into
   * an `attorney_slug` and a SOC code before it can lead with them. Only the
   * KIND matters for deciding which controls are live, so a placeholder key is
   * enough here and re-implementing the resolution in the browser would be a
   * second copy of a rule that must not drift.
   */
  const lead = useMemo(
    () =>
      chooseLead({
        ...(typedCaseNumber ? { caseNumber: typedCaseNumber } : {}),
        ...(!typedCaseNumber && textInput.trim().length >= 2 ? { employer: textInput.trim() } : {}),
        ...(firmInput.trim() ? { firmSlug: "resolved-on-the-server" } : {}),
        ...(stateInput ? { state: stateInput } : {}),
        ...(occInput.trim() ? { socCode: "resolved-on-the-server" } : {}),
      }),
    [typedCaseNumber, textInput, firmInput, stateInput, occInput],
  );

  const can = useMemo(() => filterAvailability(lead), [lead]);
  const outcomes = useMemo(() => availableOutcomes(lead), [lead]);

  // Narrowing applied AFTER the answer arrives: not a new request, so flipping
  // between them costs nothing and cannot re-bill a Turso read.
  const [stage, setStage] = useState<"all" | "pending" | "decided">("all");
  const [sort, setSort] = useState<SortState>({ key: "filed", dir: -1 });

  const url = useMemo(() => {
    if (submitted === null) return "skip" as const;
    return `/api/case-search?${submitted}&s=${query.n}`;
  }, [submitted, query.n]);

  const { data, failed } = usePublicQuery<SearchResponse>(url);

  const searching = submitted !== null;
  const pending = searching && data === undefined && !failed;

  const shown = useMemo(() => {
    if (!data) return [];
    const staged =
      stage === "all" ? data.rows : data.rows.filter((r) => (stage === "decided" ? r.isFinal : !r.isFinal));
    return sortRows(staged, COLUMNS, sort);
  }, [data, stage, sort]);

  const toggleProgram = (p: Program) => {
    setPrograms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  };

  /** Only what this lead can carry goes on the wire. The route drops the rest anyway. */
  const buildParams = (over: { firm?: string; occupation?: string } = {}) => {
    const s = new URLSearchParams();
    const q = textInput.trim();
    if (q) s.set("q", q);
    const firmValue = over.firm ?? firmInput.trim();
    const occValue = over.occupation ?? occInput.trim();
    if (firmValue) s.set("firm", firmValue);
    if (stateInput) s.set("state", stateInput);
    if (occValue) s.set("occupation", occValue);
    if (outcome && outcomes.includes(outcome)) s.set("outcome", outcome);
    if (titleInput.trim()) s.set("title", titleInput.trim());
    if (MONTH_RE.test(fromInput)) s.set("from", fromInput);
    if (MONTH_RE.test(toInput)) s.set("to", toInput);
    if (MONTH_RE.test(dFromInput)) s.set("dfrom", dFromInput);
    if (MONTH_RE.test(dToInput)) s.set("dto", dToInput);
    if (fyInput) s.set("fy", fyInput);
    if (wMinInput.trim()) s.set("wmin", wMinInput.trim());
    if (wMaxInput.trim()) s.set("wmax", wMaxInput.trim());
    if (programs.length && programs.length < ALL_PROGRAMS.length) {
      s.set("programs", programs.join(","));
    }
    return s.toString();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(buildParams());
    setQuery((cur) => ({ search: textInput.trim(), n: cur.n + 1 }));
  };

  /**
   * Re-run with one of DOL's other spellings of the same firm or occupation.
   *
   * NOT named `useAlternative`: a `use` prefix makes ESLint's rules-of-hooks
   * treat it as a hook, and calling it from a click handler is then an error.
   */
  const applyAlternative = (kind: "firm" | "occupation", name: string) => {
    if (kind === "firm") setFirmInput(name);
    else setOccInput(name);
    setSubmitted(buildParams(kind === "firm" ? { firm: name } : { occupation: name }));
    setQuery((cur) => ({ ...cur, n: cur.n + 1 }));
  };

  const droppedList = data?.dropped ?? [];

  return (
    <div className="space-y-8">
      <section className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <form onSubmit={submit} className="space-y-6">
          <fieldset className="min-w-0">
            <legend className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
              What to search by
            </legend>{" "}
            <p className="mb-3 mt-1 text-sm leading-relaxed text-foreground/70">
              Fill in any one of these. An employer reaches all three programs
              and both halves of each; a firm, a state or an occupation reads
              DOL&apos;s published PERM file, which is the only place those
              fields exist.
            </p>{" "}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] [&>*]:min-w-0">
              <div className="block min-w-0">
                <label className="mb-1 block text-sm font-bold" htmlFor={`${uid}-q`}>
                  Employer or case number
                </label>{" "}
                <input
                  id={`${uid}-q`}
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Start of the employer's name, or G- / A- / P- / I-"
                  maxLength={120}
                  autoComplete="off"
                  className={CONTROL}
                />
              </div>{" "}
              <div className="flex items-end">
                <button type="submit" className={BUTTON} disabled={pending} aria-busy={pending}>
                  {pending ? "Searching…" : "Search"}
                </button>
              </div>
            </div>{" "}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
              <Field
                label={FILTER_LABEL.firm}
                state={can.firm}
                filterKey="firm"
                describedBy={`${uid}-firm-why`}
              >
                <input
                  type="text"
                  value={firmInput}
                  onChange={(e) => setFirmInput(e.target.value)}
                  placeholder="e.g. Fragomen"
                  maxLength={120}
                  autoComplete="off"
                  disabled={!can.firm.on}
                  aria-describedby={can.firm.on ? undefined : `${uid}-firm-why`}
                  className={CONTROL + " min-w-0"}
                />
              </Field>{" "}
              <Field
                label={FILTER_LABEL.state}
                state={can.state}
                filterKey="state"
                describedBy={`${uid}-state-why`}
              >
                <select
                  value={stateInput}
                  onChange={(e) => setStateInput(e.target.value)}
                  disabled={!can.state.on}
                  aria-label={FILTER_LABEL.state}
                  aria-describedby={can.state.on ? undefined : `${uid}-state-why`}
                  className={CONTROL + " min-w-0"}
                >
                  <option value="">Any state</option>
                  {states.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} ({fmt(s.total)})
                    </option>
                  ))}
                </select>
              </Field>{" "}
              <Field
                label={FILTER_LABEL.occupation}
                state={can.occupation}
                filterKey="occupation"
                describedBy={`${uid}-occ-why`}
              >
                <input
                  type="text"
                  value={occInput}
                  onChange={(e) => setOccInput(e.target.value)}
                  placeholder="e.g. software developers"
                  maxLength={120}
                  autoComplete="off"
                  disabled={!can.occupation.on}
                  aria-describedby={can.occupation.on ? undefined : `${uid}-occ-why`}
                  className={CONTROL + " min-w-0"}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="min-w-0">
            <legend className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Narrow it
            </legend>{" "}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">{FILTER_LABEL.outcome}:</span>{" "}
              <button
                type="button"
                aria-pressed={outcome === ""}
                onClick={() => setOutcome("")}
                disabled={!can.outcome.on}
                className={CHIP + (outcome === "" ? "bg-foreground text-background hover:bg-foreground" : "bg-card")}
              >
                Any
              </button>{" "}
              {outcomes.map((o) => (
                <Fragment key={o}>
                  <button
                    type="button"
                    aria-pressed={outcome === o}
                    onClick={() => setOutcome(outcome === o ? "" : o)}
                    disabled={!can.outcome.on}
                    className={
                      CHIP + (outcome === o ? "bg-foreground text-background hover:bg-foreground" : "bg-card")
                    }
                  >
                    {OUTCOME_LABEL[o]}
                  </button>{" "}
                </Fragment>
              ))}
            </div>{" "}
            {can.outcome.on ? null : (
              <p className="mt-2 text-sm leading-snug text-foreground/70">
                {refusalText(can.outcome.why ?? "no-lead", "outcome")}
              </p>
            )}{" "}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
              <Field
                label="Job title contains"
                state={can.title}
                filterKey="title"
                describedBy={`${uid}-title-why`}
              >
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="e.g. engineer"
                  maxLength={80}
                  autoComplete="off"
                  disabled={!can.title.on}
                  aria-describedby={can.title.on ? undefined : `${uid}-title-why`}
                  className={CONTROL + " min-w-0"}
                />
              </Field>{" "}
              {/* `min-w-0` written out even though CONTROL already carries it:
                  `form-controls-min-width.test.ts` reads the attribute text and
                  cannot see through a constant, and a static gate that a real
                  fix does not satisfy is a gate people learn to ignore. The
                  ancestor grid is what actually stops the iOS overflow, and it
                  has `grid-cols-1` and `[&>*]:min-w-0` above. */}
              <Field
                label="Filed from"
                state={can.filed}
                filterKey="filed"
                describedBy={`${uid}-filed-why`}
              >
                <input
                  type="month"
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                  disabled={!can.filed.on}
                  aria-label="Filed from"
                  aria-describedby={can.filed.on ? undefined : `${uid}-filed-why`}
                  className={CONTROL + " min-w-0"}
                />
              </Field>{" "}
              <Field
                label="Filed to"
                state={can.filed}
                filterKey="filed"
                describedBy={`${uid}-filed2-why`}
              >
                <input
                  type="month"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  disabled={!can.filed.on}
                  aria-label="Filed to"
                  aria-describedby={can.filed.on ? undefined : `${uid}-filed2-why`}
                  className={CONTROL + " min-w-0"}
                />
              </Field>{" "}
              <Field
                label={FILTER_LABEL.fiscalYear}
                state={can.fiscalYear}
                filterKey="fiscalYear"
                describedBy={`${uid}-fy-why`}
              >
                <select
                  value={fyInput}
                  onChange={(e) => setFyInput(e.target.value)}
                  disabled={!can.fiscalYear.on}
                  aria-label={FILTER_LABEL.fiscalYear}
                  aria-describedby={can.fiscalYear.on ? undefined : `${uid}-fy-why`}
                  className={CONTROL + " min-w-0"}
                >
                  <option value="">Any year</option>
                  {fiscalYears.map((f) => (
                    <option key={f.fiscalYear} value={f.fiscalYear}>
                      FY{f.fiscalYear} ({fmt(f.total)})
                    </option>
                  ))}
                </select>
              </Field>{" "}
              <Field
                label="Decided from"
                state={can.decided}
                filterKey="decided"
                describedBy={`${uid}-dec-why`}
              >
                <input
                  type="month"
                  value={dFromInput}
                  onChange={(e) => setDFromInput(e.target.value)}
                  disabled={!can.decided.on}
                  aria-label="Decided from"
                  aria-describedby={can.decided.on ? undefined : `${uid}-dec-why`}
                  className={CONTROL + " min-w-0"}
                />
              </Field>{" "}
              <Field
                label="Decided to"
                state={can.decided}
                filterKey="decided"
                describedBy={`${uid}-dec2-why`}
              >
                <input
                  type="month"
                  value={dToInput}
                  onChange={(e) => setDToInput(e.target.value)}
                  disabled={!can.decided.on}
                  aria-label="Decided to"
                  aria-describedby={can.decided.on ? undefined : `${uid}-dec2-why`}
                  className={CONTROL + " min-w-0"}
                />
              </Field>{" "}
              <Field
                label="Wage at least"
                state={can.wage}
                filterKey="wage"
                describedBy={`${uid}-wage-why`}
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  value={wMinInput}
                  onChange={(e) => setWMinInput(e.target.value)}
                  placeholder="e.g. 120000"
                  disabled={!can.wage.on}
                  aria-label="Wage at least"
                  aria-describedby={can.wage.on ? undefined : `${uid}-wage-why`}
                  className={CONTROL + " min-w-0"}
                />
              </Field>{" "}
              <Field
                label="Wage at most"
                state={can.wage}
                filterKey="wage"
                describedBy={`${uid}-wage2-why`}
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  value={wMaxInput}
                  onChange={(e) => setWMaxInput(e.target.value)}
                  placeholder="e.g. 300000"
                  disabled={!can.wage.on}
                  aria-label="Wage at most"
                  aria-describedby={can.wage.on ? undefined : `${uid}-wage2-why`}
                  className={CONTROL + " min-w-0"}
                />
              </Field>
            </div>{" "}
            <div className="mt-4">
              <span className="mb-2 block text-sm font-bold">{FILTER_LABEL.programs}</span>{" "}
              <div className="flex flex-wrap gap-2">
                {ALL_PROGRAMS.map((p) => (
                  <Fragment key={p}>
                    <button
                      type="button"
                      aria-pressed={programs.includes(p)}
                      title={PROGRAM_BLURB[p]}
                      onClick={() => toggleProgram(p)}
                      disabled={!can.programs.on}
                      className={
                        CHIP + (programs.includes(p) ? "bg-foreground text-background hover:bg-foreground" : "bg-card")
                      }
                    >
                      {PROGRAM_LABEL[p]}
                    </button>{" "}
                  </Fragment>
                ))}
              </div>
              {can.programs.on ? null : (
                <p className="mt-2 text-sm leading-snug text-foreground/70">
                  {refusalText(can.programs.why ?? "no-lead", "programs")}
                </p>
              )}
              {can.programs.on && programs.length === 0 ? (
                <p className="mt-2 text-sm text-foreground/70">Pick at least one program to search.</p>
              ) : null}
            </div>
          </fieldset>
        </form>
      </section>

      {typedCaseNumber ? (
        <div className="border-2 border-primary bg-tint-primary p-5">
          <p className="text-base leading-relaxed">
            <b className="font-bold">{typedCaseNumber} is a case number.</b>{" "}
            The search below reads this site&apos;s own copy of DOL&apos;s
            records. If it is not there, the status lookup asks DOL live and
            answers even for a filing nothing here has seen yet.
          </p>{" "}
          <p className="mt-3">
            <Link
              href={`/perm-case-status?case=${encodeURIComponent(typedCaseNumber)}`}
              className="inline-flex min-h-[44px] items-center border-2 border-border bg-foreground px-5 font-mono text-xs font-bold uppercase tracking-wider text-background hover:bg-primary hover:text-primary-foreground"
            >
              Check {typedCaseNumber} with DOL
            </Link>
          </p>
        </div>
      ) : null}

      {searching && failed ? (
        <p className="border-2 border-border bg-tint-primary p-4 text-base">
          The search didn&apos;t load. Reloading usually clears it.
        </p>
      ) : null}

      {data?.needsLead ? (
        <div className="border-2 border-border bg-tint-primary p-5">
          <p className="text-base leading-relaxed">
            Nothing was filled in that a search can start from. Type an employer
            or a case number, or pick a worksite state, a law firm or an
            occupation. The other fields narrow one of those rather than
            standing on their own.
          </p>
        </div>
      ) : null}

      {data && !data.needsLead && data.resolved.firm ? (
        <div className="border-2 border-border bg-card p-4">
          <p className="text-base leading-relaxed">
            <b className="font-bold">Law firm:</b> {data.resolved.firm.name}{" "}
            <span className="text-foreground/70">
              ({fmt(data.resolved.firm.total)} published cases)
            </span>
          </p>{" "}
          {data.resolved.firm.alternatives.length > 0 ? (
            <div className="mt-2">
              <p className="text-sm leading-relaxed text-foreground/70">
                DOL prints one practice under several spellings, and each is a
                separate record. Other matches:
              </p>{" "}
              <div className="mt-2 flex flex-wrap gap-2">
                {data.resolved.firm.alternatives.map((a) => (
                  <Fragment key={a.key}>
                    <button
                      type="button"
                      onClick={() => applyAlternative("firm", a.name)}
                      className="min-h-[44px] border-2 border-border bg-card px-3 text-sm font-bold hover:bg-tint-primary focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {a.name} ({fmt(a.total)})
                    </button>{" "}
                  </Fragment>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {data && !data.needsLead && data.resolved.occupation ? (
        <div className="border-2 border-border bg-card p-4">
          <p className="text-base leading-relaxed">
            <b className="font-bold">Occupation:</b>{" "}
            {data.resolved.occupation.name}{" "}
            <span className="font-mono text-sm text-foreground/70">
              {data.resolved.occupation.key}
            </span>
          </p>{" "}
          {data.resolved.occupation.alternatives.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {data.resolved.occupation.alternatives.map((a) => (
                <Fragment key={a.key}>
                  <button
                    type="button"
                    onClick={() => applyAlternative("occupation", a.name)}
                    className="min-h-[44px] border-2 border-border bg-card px-3 text-sm font-bold hover:bg-tint-primary focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {a.name} ({fmt(a.total)})
                  </button>{" "}
                </Fragment>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {droppedList.length > 0 ? (
        <div className="border-2 border-border bg-tint-primary p-4">
          <p className="text-base font-bold">
            {droppedList.length === 1
              ? "One filter was not applied."
              : `${droppedList.length} filters were not applied.`}
          </p>{" "}
          <ul className="mt-2 space-y-1">
            {droppedList.map((k) => (
              <li key={k} className="text-sm leading-relaxed">
                <b className="font-bold">{FILTER_LABEL[k]}:</b>{" "}
                {refusalText(filterAvailability(data?.lead ?? null)[k].why ?? "walks-the-slice", k)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data && !data.needsLead && (data.skipped.live || data.skipped.published) ? (
        <div className="border-2 border-border bg-card p-4">
          <p className="text-base leading-relaxed">
            {data.skipped.live && data.skipped.because.length > 0 ? (
              <>
                <b className="font-bold">Open filings are not in this answer.</b>{" "}
                DOL does not put the{" "}
                {data.skipped.because.join(", ")} on a case until it publishes
                it in a quarterly file, so filtering on that reads the published
                record only.
              </>
            ) : null}
            {data.skipped.live && data.skipped.because.length === 0 ? (
              <>
                <b className="font-bold">Open filings are not in this answer.</b>{" "}
                A firm, state or occupation search reads DOL&apos;s published
                PERM file, which holds decided cases only.
              </>
            ) : null}
            {data.skipped.published ? (
              <>
                <b className="font-bold">Only open filings are in this answer.</b>{" "}
                Every row in a quarterly disclosure file has a decision on it,
                so the published half has nothing still open to contribute.
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {searching && data && !data.needsLead && data.rows.length === 0 ? (
        <div className="border-2 border-border bg-tint-primary p-5">
          <p className="text-base leading-relaxed">
            Nothing matched. Try a shorter form of the employer name: DOL spells
            one company several ways, and the search matches the start of the
            name it was filed under.
          </p>{" "}
          <p className="mt-3 text-base leading-relaxed">
            Have a case number instead?{" "}
            <Link
              href="/perm-case-status"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              The status lookup
            </Link>{" "}
            takes all three prefixes and asks DOL directly.
          </p>
        </div>
      ) : null}

      {searching && data && data.rows.length > 0 ? (
        <section>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Which stage" className="flex flex-wrap gap-2">
              {(["all", "pending", "decided"] as const).map((k) => (
                <Fragment key={k}>
                  <button
                    type="button"
                    aria-pressed={stage === k}
                    onClick={() => setStage(k)}
                    className={CHIP + (stage === k ? "bg-foreground text-background hover:bg-foreground" : "bg-card")}
                  >
                    {k === "all" ? "All" : k === "pending" ? "Still open" : "Decided"}
                  </button>{" "}
                </Fragment>
              ))}
            </div>{" "}
            <p className="ml-auto text-sm text-foreground/70">
              {/* "shown", not a total: the reads underneath are capped, so a
                  bare number here would read as this employer's whole record
                  when it is the newest slice of it. */}
              Shown:{" "}
              {ALL_PROGRAMS.filter((p) => data.counts[p] > 0)
                .map((p) => `${fmt(data.counts[p])} ${PROGRAM_LABEL[p]}`)
                .join(" · ")}
            </p>
          </div>{" "}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-left text-base">
              <caption className="sr-only">
                Every filing found across PERM, wage requests and LCAs
              </caption>
              <SortableHeader
                columns={COLUMNS}
                sort={sort}
                onSort={(k) => setSort((cur) => nextSort(cur, k, COLUMNS))}
                leading={["Case"]}
              />
              <tbody className="bg-card">
                {shown.map((r) => (
                  <tr key={r.caseNumber} className="border-t-2 border-border/30 align-top">
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-base">
                      <Link
                        href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                        className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                      >
                        {r.caseNumber}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm">{PROGRAM_LABEL[r.program]}</td>
                    <td className="px-3 py-3">
                      <span className={"inline-block border-2 border-border px-2 py-1 text-sm font-bold " + statusTone(r.status, r.isFinal)}>
                        {r.status || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {r.employerSlug && r.program === "perm" ? (
                        <Link
                          href={`/perm-employers/${r.employerSlug}`}
                          className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                        >
                          {r.employerName ?? "—"}
                        </Link>
                      ) : (
                        (r.employerName ?? "—")
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">{r.jobTitle ?? "—"}</td>
                    <td className="px-3 py-3 text-sm">{r.socTitle ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm">{r.state ?? "—"}</td>
                    <td className="px-3 py-3 text-sm">
                      {r.firmSlug && r.firmName ? (
                        <Link
                          href={`/perm-attorneys/${r.firmSlug}`}
                          className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                        >
                          {r.firmName}
                        </Link>
                      ) : (
                        (r.firmName ?? "—")
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums">
                      {r.wage === null ? "—" : formatWage(r.wage, r.wageUnit)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums">{r.filedOn ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums">{r.decidedOn ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums">{r.days ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>{" "}

          {data.windowed ? (
            <p className="mt-4 max-w-3xl border-2 border-border bg-tint-primary p-4 text-base leading-relaxed">
              <b className="font-bold">These filters were applied to the newest
              part of this employer&apos;s record, not all of it.</b>{" "}
              An employer name is matched as a prefix, and no index can hand
              those rows back in date order, so each program is narrowed within
              its most recent filings rather than by reading the whole slice on
              every search. Give the employer&apos;s full name, or add a filing
              month, to move the window.
            </p>
          ) : null}{" "}
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-foreground/70">
            Showing {fmt(shown.length)} of {fmt(data.rows.length)} filings.
            {data.truncated || data.capped
              ? " More matched than fit one answer: these are the newest, and a job title, a filing month or an outcome brings the rest into reach."
              : ""}{" "}
            Sorting reorders what is on this page rather than re-running the
            search, so &ldquo;highest wage&rdquo; means highest among these rows,
            not across the whole corpus. A wage, a law firm, a worksite and an
            occupation appear once DOL has published the case in a quarterly
            file; open filings carry none of them.
          </p>
        </section>
      ) : null}

      {!searching ? (
        <div className="border-2 border-border bg-tint-primary p-5">
          <h2 className="font-heading text-lg font-black">What one search covers</h2>{" "}
          <dl className="mt-3 space-y-2 text-base leading-relaxed">
            {ALL_PROGRAMS.map((p) => (
              <Fragment key={p}>
                {/* The `{" "}` is load-bearing, not cosmetic: JSX drops the
                    newline between two tags, so `</dt><dd>` reaches every
                    extractor as "PERM:The labor certification". Google has
                    reproduced that shape verbatim in a search listing. */}
                <div>
                  <dt className="inline font-bold">{PROGRAM_LABEL[p]}:</dt>{" "}
                  <dd className="inline text-foreground/80">{PROGRAM_BLURB[p]}</dd>
                </div>{" "}
              </Fragment>
            ))}
          </dl>{" "}
          <p className="mt-3 text-base leading-relaxed text-foreground/80">
            Each one is shown twice over: what DOL&apos;s daily check confirms
            while it is open, and what DOL publishes with the wage once it is
            decided. One row per case, whichever half it came from.
          </p>
        </div>
      ) : null}
    </div>
  );
}
