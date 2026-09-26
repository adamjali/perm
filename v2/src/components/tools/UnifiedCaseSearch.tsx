"use client";

import { Fragment, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { STAGE_PROGRAM_LABEL, searchStages } from "@/lib/searchStages";
import { CircleNotchIcon, WarningIcon } from "@phosphor-icons/react";

import { usePublicQuery } from "@/lib/usePublicQuery";
import { formatWage } from "@/lib/wageFormat";
import { normaliseCaseNumber } from "@/lib/caseNumberShape";
import { SortableHeader } from "@/components/tools/SortableHeader";
import { LinkPending, PendingLink } from "@/components/ui/pending-link";
import { SelectedInFull } from "@/components/tools/SelectedInFull";
import { nextSort, sortRows, type SortColumn, type SortState } from "@/lib/tableSort";
import {
  FILTER_LABEL,
  OLD_FORM_NOTE,
  ORDER_LABEL,
  OUTCOME_LABEL,
  SEARCH_ORDERS,
  availableOutcomes,
  chooseLead,
  withStageNarrow,
  filterAvailability,
  isFieldValue,
  orderToSort,
  refusalText,
  type FilterKey,
  type FilterState,
  type Lead,
  type Outcome,
  type SearchOrder,
} from "@/lib/caseSearchPlan";
// One line, deliberately: no-server-only-in-client.test.ts checks each import
// line on its own, so a type import wrapped over several lines reads as a
// runtime import of a "server-only" module.
import type { Program, UnifiedCase } from "@/lib/turso/unifiedSearch";
import type { CaseFieldKey, CaseFieldOptions, FieldOption } from "@/lib/turso/caseSearchReads";

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
 * THE ORDER CONTROL GOES TO THE SERVER; A COLUMN CLICK DOES NOT. The chosen
 * order is sent with the search, and the answer says whether it covers every
 * match or only the rows fetched (each source's newest, or oldest-decided for
 * that order). A column header reorders the rows on the page and re-queries
 * nothing. The footnote says which of the two the reader is looking at.
 *
 * THE WORKER AND JOB FILTERS READ PUBLISHED PERM ONLY. Industry, worksite city,
 * the worker's citizenship, birth country, visa and education, and the
 * education the job requires are columns of DOL's PERM file alone, and the
 * worker's fields exist only for cases filed on DOL's old form. The group says
 * both, and the answer names the filters that narrowed it to one program.
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
/** A typed NAICS code. A sector range comes only from the list. */
const NAICS_CODE_RE = /^\d{2,6}$/;
const ALL_PROGRAMS: Program[] = ["perm", "pwd", "lca"];
const WORKER_KEYS: CaseFieldKey[] = ["citizenship", "birthCountry", "visaClass", "education", "jobEducation"];
/** The route's parameter for each worker and job field. */
const WORKER_PARAM: Record<CaseFieldKey, string> = {
  citizenship: "cit",
  birthCountry: "bcountry",
  visaClass: "visa",
  education: "edu",
  jobEducation: "jobedu",
};
const WORKER_PLACEHOLDER: Record<CaseFieldKey, string> = {
  citizenship: "e.g. India",
  birthCountry: "e.g. India",
  visaClass: "e.g. H-1B",
  education: "e.g. Master's",
  jobEducation: "e.g. Bachelor's",
};
/** Countries read better in title case; a visa class or a degree is shown as DOL printed it. */
const WORKER_DISPLAY: Partial<Record<CaseFieldKey, (v: string) => string>> = {
  citizenship: (v) => titleCase(v),
  birthCountry: (v) => titleCase(v),
};

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
  /** Absent on a `needsLead` answer, which ran no search. */
  permOnly?: string[];
  order?: SearchOrder;
  orderScope?: "complete" | "fetched";
}

export interface StateOption {
  code: string;
  total: number;
}
export interface FiscalYearOption {
  fiscalYear: string;
  total: number;
}
export interface IndustryOption {
  /** A 2-digit NAICS sector, or a range such as `31-33`. */
  code: string;
  title: string;
}

const SMALL_WORDS = new Set(["and", "of", "the", "de", "du", "da"]);
/**
 * DOL prints countries and cities in capitals. Shown in title case so a list of
 * two hundred is readable; the VALUE sent to the search stays as printed.
 */
function titleCase(v: string): string {
  return v
    .toLowerCase()
    .replace(/\p{L}[\p{L}']*/gu, (w, i: number) => (i > 0 && SMALL_WORDS.has(w) ? w : w[0]!.toUpperCase() + w.slice(1)));
}

/** A worker or job filter's control: a list when the site holds one, else a text box. */
function Choice({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
  describedBy,
  placeholder,
  display = (v) => v,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: FieldOption[];
  disabled: boolean;
  describedBy: string | undefined;
  placeholder: string;
  display?: (v: string) => string;
}) {
  if (options.length === 0) {
    return (
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={60}
        autoComplete="off"
        disabled={disabled}
        aria-label={label}
        aria-describedby={describedBy}
        className={CONTROL + " min-w-0"}
      />
    );
  }
  const chosen = options.find((o) => o.value === value);
  return (
    <>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label}
        aria-describedby={describedBy}
        className={CONTROL + " min-w-0"}
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {display(o.value)}
            {o.n === null ? "" : ` (${fmt(o.n)})`}
          </option>
        ))}
      </select>
      <SelectedInFull label={chosen ? display(chosen.value) : null} />
    </>
  );
}

/**
 * What a published PERM row adds under its job title: where and in what
 * industry, and, for a case on DOL's old form, who the worker was and what the
 * job asked for. Blocks, not columns, so a phone-width table gains no width.
 */
function RowDetails({ r }: { r: UnifiedCase }) {
  const where = [r.city ? titleCase(r.city) : null, r.industryTitle ?? null].filter(Boolean) as string[];
  const who = [
    r.citizenship ? `${titleCase(r.citizenship)} citizen` : null,
    r.birthCountry && r.birthCountry !== r.citizenship ? `born in ${titleCase(r.birthCountry)}` : null,
    r.visaClass ? `${r.visaClass} at filing` : null,
    r.education ? `${r.education}${r.major ? ` in ${titleCase(r.major)}` : ""}` : null,
  ].filter(Boolean) as string[];
  if (where.length === 0 && who.length === 0 && !r.jobEducation) return null;
  return (
    <span className="mt-1 block text-sm leading-snug text-foreground/70">
      {where.length > 0 ? <span className="block">{where.join(" · ")}</span> : null}{" "}
      {who.length > 0 ? <span className="block">Worker: {who.join(", ")}</span> : null}{" "}
      {r.jobEducation ? <span className="block">Job requires: {r.jobEducation}</span> : null}
    </span>
  );
}

const NO_FIELD_OPTIONS: CaseFieldOptions = {
  citizenship: [], birthCountry: [], visaClass: [], education: [], jobEducation: [],
};

/**
 * A labelled control that can be refused.
 *
 * The reason is rendered as text under the field and wired with
 * `aria-describedby`, not as a `title` attribute: a tooltip is invisible to a
 * keyboard and to a phone, and this sentence is the whole point of the
 * control being on screen at all.
 */
/** The per-control form of the no-lead reason; the full sentence prints once. */
const NO_LEAD_SHORT = "Search by employer, case number, law firm, state or occupation first.";

function Field({
  label,
  state,
  describedBy,
  children,
}: {
  label: string;
  state: FilterState;
  describedBy: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block min-w-0">
      <span className="mb-1 block text-sm font-bold">{label}</span>{" "}
      {children}
      {state.on || !state.why ? null : state.why === "no-lead" ? (
        // Said once, under "Narrow it", rather than under all nineteen
        // controls; the control still carries it for a screen reader.
        <span id={describedBy} className="sr-only">
          {NO_LEAD_SHORT}
        </span>
      ) : (
        <span id={describedBy} className="mt-1 block text-sm leading-snug text-foreground/70">
          {refusalText(state.why)}
        </span>
      )}
    </div>
  );
}

export function UnifiedCaseSearch({
  states = [],
  fiscalYears = [],
  industries = [],
  fieldOptions = NO_FIELD_OPTIONS,
  publishedFrom = null,
}: {
  states?: StateOption[];
  fiscalYears?: FiscalYearOption[];
  industries?: IndustryOption[];
  fieldOptions?: CaseFieldOptions;
  /** The first fiscal year of published PERM cases the search reaches, once the history is loaded. */
  publishedFrom?: string | null;
}) {
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  // `?stage=<slug>` is how the stage pages hand a cohort to this search.
  const stageOptions = useMemo(() => searchStages(), []);
  const initialStage = stageOptions.some((o) => o.slug === params.get("stage")) ? (params.get("stage") ?? "") : "";
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
  const [stageInput, setStageInput] = useState<string>(initialStage);
  // The worker, job and industry fields: published PERM only.
  const [industryInput, setIndustryInput] = useState("");
  const [naicsInput, setNaicsInput] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [worker, setWorker] = useState<Record<CaseFieldKey, string>>({
    citizenship: "", birthCountry: "", visaClass: "", education: "", jobEducation: "",
  });
  const setWorkerField = (k: CaseFieldKey, v: string) => setWorker((cur) => ({ ...cur, [k]: v }));
  const [orderInput, setOrderInput] = useState<SearchOrder>("filed-desc");
  const stageOption = useMemo(() => stageOptions.find((o) => o.slug === stageInput) ?? null, [stageOptions, stageInput]);

  const [query, setQuery] = useState({ search: initial.trim() ? initial.trim() : "", n: 0 });
  // `null` means "not searched yet", which is NOT the same as "searched with
  // an empty form". An empty form submits an empty query string and the route
  // answers `needsLead`, so pressing Search with nothing filled in explains
  // itself instead of doing nothing at all.
  const [submitted, setSubmitted] = useState<string | null>(
    initial.trim() || initialStage
      ? new URLSearchParams({
          ...(initial.trim() ? { q: initial.trim() } : {}),
          ...(initialStage ? { stage: initialStage } : {}),
        }).toString()
      : null,
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
        ...(stageOption ? { stage: { status: stageOption.status, program: stageOption.program } } : {}),
      }),
    [typedCaseNumber, textInput, firmInput, stateInput, occInput, stageOption],
  );

  // An employer search narrowed to a stage loses what the live record lacks,
  // through the same rule the route applies, so the greyed controls and the
  // dropped filters are one list.
  const can = useMemo(
    () => withStageNarrow(filterAvailability(lead), Boolean(stageInput) && lead?.kind === "employer"),
    [lead, stageInput],
  );
  const outcomes = useMemo(() => availableOutcomes(lead), [lead]);

  // Narrowing applied AFTER the answer arrives: not a new request, so flipping
  // between them costs nothing and cannot re-bill a Turso read.
  const [stage, setStage] = useState<"all" | "pending" | "decided">("all");
  const [sort, setSort] = useState<SortState>(orderToSort("filed-desc"));

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
    if (stageInput && can.stage.on) s.set("stage", stageInput);
    if (wMinInput.trim()) s.set("wmin", wMinInput.trim());
    if (wMaxInput.trim()) s.set("wmax", wMaxInput.trim());
    if (programs.length && programs.length < ALL_PROGRAMS.length) {
      s.set("programs", programs.join(","));
    }
    // A typed code wins over the sector list; a malformed one is named in the
    // warning above the answer rather than sent for the route to refuse.
    const naics = naicsInput.trim() ? (NAICS_CODE_RE.test(naicsInput.trim()) ? naicsInput.trim() : "") : industryInput;
    if (naics) s.set("naics", naics);
    if (isFieldValue(cityInput)) s.set("city", cityInput.trim());
    for (const k of WORKER_KEYS) {
      if (isFieldValue(worker[k])) s.set(WORKER_PARAM[k], worker[k].trim());
    }
    if (orderInput !== "filed-desc") s.set("order", orderInput);
    return s.toString();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // The table shows the order that was asked for, whatever column a click
    // had chosen since.
    setSort(orderToSort(orderInput));
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

  /**
   * Date boxes holding something that is not a month.
   *
   * `buildParams` only sets a date when `MONTH_RE` matches, so anything else
   * is discarded without a word - and on Firefox, where `input type="month"`
   * is still a plain text box, typing a date the way a person writes one is
   * the NORMAL outcome, not an edge case. A filter that vanishes in silence is
   * the same defect as a button that does nothing.
   */
  const unreadMonths = (
    [
      ["Filed from", fromInput],
      ["Filed to", toInput],
      ["Decided from", dFromInput],
      ["Decided to", dToInput],
    ] as const
  )
    .filter(([, v]) => v.trim() !== "" && !MONTH_RE.test(v))
    .map(([label]) => label);

  /** Worker, job and industry boxes holding something the search would refuse. */
  const unreadFields = [
    ...(naicsInput.trim() && !NAICS_CODE_RE.test(naicsInput.trim()) ? ["NAICS code"] : []),
    ...(cityInput.trim() && !isFieldValue(cityInput) ? [FILTER_LABEL.city] : []),
    ...WORKER_KEYS.filter((k) => worker[k].trim() && !isFieldValue(worker[k])).map((k) => FILTER_LABEL[k]),
  ];

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
                  /* 361.8px of real Inter at 16px/500 before this, in a box
                     that is 220px wide on a 320px phone: the reader saw
                     "Start of the employer's name, or G-" and no more, so the
                     three other prefixes the field accepts were invisible on
                     every phone. The list moved to the hint below, which is
                     where it can be read. */
                  placeholder="e.g. Microsoft or G-100-…"
                  maxLength={120}
                  autoComplete="off"
                  aria-describedby={`${uid}-q-hint`}
                  className={CONTROL}
                />
              </div>{" "}
              <div className="flex items-end">
                <button type="submit" className={BUTTON} disabled={pending} aria-busy={pending}>
                  {pending ? "Searching…" : "Search"}
                </button>
              </div>
            </div>{" "}
            {/* THE HINT SITS BELOW THE GRID, NOT INSIDE THE INPUT'S CELL.
                Inside it, the cell was label + input + three lines of hint and
                the button's `items-end` pinned it to the bottom of all of
                that, so it hung level with the last line of the hint instead
                of the input and read as though it had fallen out of the row.
                Out here it spans the full width and the button lines up with
                the field it submits. */}
            <p id={`${uid}-q-hint`} className="mt-1 text-sm leading-snug text-foreground/70">
              An employer is matched from the start of the name. All four
              case-number prefixes work: G- and A- for PERM, P- for a wage
              request, I- for an H-1B LCA. Or leave this empty and search by law
              firm, worksite state or occupation instead.
            </p>{" "}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
              <Field
                label={FILTER_LABEL.firm}
                state={can.firm}
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
                describedBy={`${uid}-occ-why`}
              >
                <input
                  type="text"
                  value={occInput}
                  onChange={(e) => setOccInput(e.target.value)}
                  placeholder="e.g. software"
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
            {can.outcome.why === "no-lead" ? (
              <p className="mt-2 text-sm leading-snug text-foreground/70">{refusalText("no-lead")}</p>
            ) : null}{" "}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">{FILTER_LABEL.outcome}:</span>{" "}
              {/* THE REASON WAS ON SCREEN AND NOT WIRED TO THE CONTROLS. The
                  sentence under this row explains why the chips are off, and
                  `Field` already does `aria-describedby` for every refused
                  INPUT - but these two chip rows are not Fields, so a screen
                  reader met a disabled button with no explanation attached to
                  it and a sentence floating nearby. */}
              <button
                type="button"
                aria-pressed={outcome === ""}
                onClick={() => setOutcome("")}
                disabled={!can.outcome.on}
                aria-describedby={can.outcome.on ? undefined : `${uid}-outcome-why`}
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
                    aria-describedby={can.outcome.on ? undefined : `${uid}-outcome-why`}
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
              <p
                id={`${uid}-outcome-why`}
                className={can.outcome.why === "no-lead" ? "sr-only" : "mt-2 text-sm leading-snug text-foreground/70"}
              >
                {can.outcome.why === "no-lead" ? NO_LEAD_SHORT : refusalText(can.outcome.why ?? "no-lead")}
              </p>
            )}{" "}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
              <Field
                label={FILTER_LABEL.stage}
                state={can.stage}
                describedBy={`${uid}-stage-why`}
              >
                <select
                  value={stageInput}
                  onChange={(e) => {
                    setStageInput(e.target.value);
                    // A stage is open by definition; a decided outcome beside
                    // it would be a contradiction the route drops anyway.
                    if (e.target.value) setOutcome("");
                  }}
                  disabled={!can.stage.on}
                  aria-label={FILTER_LABEL.stage}
                  aria-describedby={can.stage.on ? undefined : `${uid}-stage-why`}
                  className={CONTROL + " min-w-0"}
                >
                  <option value="">Any stage</option>
                  {(["perm", "pwd", "lca"] as const).map((program) => (
                    <optgroup key={program} label={STAGE_PROGRAM_LABEL[program]}>
                      {stageOptions
                        .filter((o) => o.program === program)
                        .map((o) => (
                          <option key={o.slug} value={o.slug}>
                            {o.label}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </Field>{" "}
              {stageInput ? (
                <p className="text-sm leading-snug text-foreground/70 sm:self-end">
                  A review stage is a fact of DOL&apos;s live record, which carries
                  the case number, employer, job title and filing date. The wage,
                  law firm, worksite state and occupation arrive only when DOL
                  publishes the case, so those filters wait.
                </p>
              ) : null}
            </div>{" "}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
              <Field
                label="Job title contains"
                state={can.title}
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
                describedBy={`${uid}-filed-why`}
              >
                <input
                  type="month"
                  /* FIREFOX RENDERS THIS AS A PLAIN TEXT BOX. `input
                     type="month"` is still unimplemented there (caniuse
                     `input-datetime` marks Firefox partial through 157, and
                     read from `caniuse-lite` in this repo rather than from
                     memory), so it falls back to Text state - with no picker,
                     no format hint, and nothing to say what is expected. The
                     value is then matched against MONTH_RE and silently
                     dropped if it does not fit, which is the worst of both:
                     the reader types "March 2026", presses Search, and the
                     filter quietly does not exist. The placeholder and the
                     warning below are for that engine; Chrome and Safari
                     paint their own edit fields and ignore both. */
                  placeholder="YYYY-MM"
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
                describedBy={`${uid}-filed2-why`}
              >
                <input
                  type="month"
                  /* FIREFOX RENDERS THIS AS A PLAIN TEXT BOX. `input
                     type="month"` is still unimplemented there (caniuse
                     `input-datetime` marks Firefox partial through 157, and
                     read from `caniuse-lite` in this repo rather than from
                     memory), so it falls back to Text state - with no picker,
                     no format hint, and nothing to say what is expected. The
                     value is then matched against MONTH_RE and silently
                     dropped if it does not fit, which is the worst of both:
                     the reader types "March 2026", presses Search, and the
                     filter quietly does not exist. The placeholder and the
                     warning below are for that engine; Chrome and Safari
                     paint their own edit fields and ignore both. */
                  placeholder="YYYY-MM"
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
                describedBy={`${uid}-dec-why`}
              >
                <input
                  type="month"
                  /* FIREFOX RENDERS THIS AS A PLAIN TEXT BOX. `input
                     type="month"` is still unimplemented there (caniuse
                     `input-datetime` marks Firefox partial through 157, and
                     read from `caniuse-lite` in this repo rather than from
                     memory), so it falls back to Text state - with no picker,
                     no format hint, and nothing to say what is expected. The
                     value is then matched against MONTH_RE and silently
                     dropped if it does not fit, which is the worst of both:
                     the reader types "March 2026", presses Search, and the
                     filter quietly does not exist. The placeholder and the
                     warning below are for that engine; Chrome and Safari
                     paint their own edit fields and ignore both. */
                  placeholder="YYYY-MM"
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
                describedBy={`${uid}-dec2-why`}
              >
                <input
                  type="month"
                  /* FIREFOX RENDERS THIS AS A PLAIN TEXT BOX. `input
                     type="month"` is still unimplemented there (caniuse
                     `input-datetime` marks Firefox partial through 157, and
                     read from `caniuse-lite` in this repo rather than from
                     memory), so it falls back to Text state - with no picker,
                     no format hint, and nothing to say what is expected. The
                     value is then matched against MONTH_RE and silently
                     dropped if it does not fit, which is the worst of both:
                     the reader types "March 2026", presses Search, and the
                     filter quietly does not exist. The placeholder and the
                     warning below are for that engine; Chrome and Safari
                     paint their own edit fields and ignore both. */
                  placeholder="YYYY-MM"
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
                      aria-describedby={can.programs.on ? undefined : `${uid}-programs-why`}
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
                <p
                  id={`${uid}-programs-why`}
                  className={can.programs.why === "no-lead" ? "sr-only" : "mt-2 text-sm leading-snug text-foreground/70"}
                >
                  {can.programs.why === "no-lead" ? NO_LEAD_SHORT : refusalText(can.programs.why ?? "no-lead")}
                </p>
              )}
              {can.programs.on && programs.length === 0 ? (
                <p className="mt-2 text-sm text-foreground/70">Pick at least one program to search.</p>
              ) : null}
            </div>
          </fieldset>

          <fieldset className="min-w-0">
            <legend className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Worker and job
            </legend>{" "}
            <p className="mb-3 mt-1 max-w-3xl text-sm leading-relaxed text-foreground/70">
              These are fields of DOL&apos;s published PERM file alone, so setting
              one leaves out wage requests, LCAs and filings still open.{" "}
              {OLD_FORM_NOTE}
            </p>{" "}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
              <Field label={FILTER_LABEL.industry} state={can.industry} describedBy={`${uid}-ind-why`}>
                <select
                  value={industryInput}
                  onChange={(e) => setIndustryInput(e.target.value)}
                  disabled={!can.industry.on}
                  aria-label={FILTER_LABEL.industry}
                  aria-describedby={can.industry.on ? undefined : `${uid}-ind-why`}
                  className={CONTROL + " min-w-0"}
                >
                  <option value="">Any industry</option>
                  {industries.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.code} {o.title}
                    </option>
                  ))}
                </select>
                <SelectedInFull
                  label={(() => {
                    const hit = industries.find((o) => o.code === industryInput);
                    return hit ? `${hit.code} ${hit.title}` : null;
                  })()}
                />
              </Field>{" "}
              <Field label="Or a NAICS code" state={can.industry} describedBy={`${uid}-naics-why`}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={naicsInput}
                  onChange={(e) => setNaicsInput(e.target.value)}
                  placeholder="e.g. 5415"
                  maxLength={6}
                  autoComplete="off"
                  disabled={!can.industry.on}
                  aria-label="NAICS code, 2 to 6 digits"
                  aria-describedby={can.industry.on ? undefined : `${uid}-naics-why`}
                  className={CONTROL + " min-w-0"}
                />
              </Field>{" "}
              <Field label={FILTER_LABEL.city} state={can.city} describedBy={`${uid}-city-why`}>
                <input
                  type="text"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="e.g. Seattle"
                  maxLength={60}
                  autoComplete="off"
                  disabled={!can.city.on}
                  aria-label={FILTER_LABEL.city}
                  aria-describedby={can.city.on ? undefined : `${uid}-city-why`}
                  className={CONTROL + " min-w-0"}
                />
              </Field>{" "}
              {WORKER_KEYS.map((k) => (
                <Fragment key={k}>
                  <Field label={FILTER_LABEL[k]} state={can[k]} describedBy={`${uid}-${k}-why`}>
                    <Choice
                      id={`${uid}-${k}`}
                      label={FILTER_LABEL[k]}
                      value={worker[k]}
                      onChange={(v) => setWorkerField(k, v)}
                      options={fieldOptions[k]}
                      disabled={!can[k].on}
                      describedBy={can[k].on ? undefined : `${uid}-${k}-why`}
                      placeholder={WORKER_PLACEHOLDER[k]}
                      {...(WORKER_DISPLAY[k] ? { display: WORKER_DISPLAY[k] } : {})}
                    />
                  </Field>{" "}
                </Fragment>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
            <div className="block min-w-0">
              <label className="mb-1 block text-sm font-bold" htmlFor={`${uid}-order`}>
                Order the answer by
              </label>{" "}
              <select
                id={`${uid}-order`}
                value={orderInput}
                onChange={(e) => {
                  const v = e.target.value as SearchOrder;
                  setOrderInput(v);
                  // Rows already on screen take the new order at once; the
                  // next search asks the server for it.
                  setSort(orderToSort(v));
                }}
                aria-describedby={`${uid}-order-hint`}
                className={CONTROL + " min-w-0"}
              >
                {SEARCH_ORDERS.map((o) => (
                  <option key={o} value={o}>
                    {ORDER_LABEL[o]}
                  </option>
                ))}
              </select>
            </div>{" "}
            <p id={`${uid}-order-hint`} className="text-sm leading-snug text-foreground/70 sm:self-end">
              Oldest decision first reads the published PERM file from its
              first case{publishedFrom ? ` in FY${publishedFrom}` : ""}. Every
              other order arranges the newest matches the search fetched.
            </p>
          </div>
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
              className="inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-foreground px-5 font-mono text-xs font-bold uppercase tracking-wider text-background hover:bg-primary hover:text-primary-foreground"
            >
              <LinkPending />
              Check {typedCaseNumber} with DOL
            </Link>
          </p>
        </div>
      ) : null}

      {/* Warnings ABOVE the answer, the same rule the calculators follow: a
          result computed from input that was partly thrown away must not read
          as more authoritative than the doubt about the input. */}
      {unreadMonths.length > 0 ? (
        <p className="flex items-start gap-2 border-2 border-border bg-data-warn/8 p-4 text-base leading-relaxed">
          <WarningIcon className="mt-1 size-4 shrink-0 text-data-warn-ink" weight="fill" aria-hidden="true" />{" "}
          <span>
            <b className="font-bold">
              {unreadMonths.length === 1
                ? `"${unreadMonths[0]}" was not used.`
                : `${unreadMonths.join(" and ")} were not used.`}
            </b>{" "}
            Those boxes take a month written as YYYY-MM, so 2026-03 rather than
            March 2026. Anything else is left out of the search.
          </span>
        </p>
      ) : null}

      {unreadFields.length > 0 ? (
        <p className="flex items-start gap-2 border-2 border-border bg-data-warn/8 p-4 text-base leading-relaxed">
          <WarningIcon className="mt-1 size-4 shrink-0 text-data-warn-ink" weight="fill" aria-hidden="true" />{" "}
          <span>
            <b className="font-bold">
              {unreadFields.length === 1
                ? `"${unreadFields[0]}" was not used.`
                : `${unreadFields.slice(0, -1).join(", ")} and ${unreadFields.at(-1)} were not used.`}
            </b>{" "}
            A NAICS code is 2 to 6 digits. The other boxes take up to 60 letters,
            digits, spaces and the punctuation names use (. , &apos; ( ) &amp; / -).
          </span>
        </p>
      ) : null}

      {/* WHILE THE SEARCH RUNS, SOMETHING HAS TO BE HERE. Every panel below
          needs `data`, and the explainer at the foot is hidden the moment a
          search starts, so pressing Search emptied the page and left only a
          button reading "Searching…" - which on a phone is already scrolled
          off the top by the time the results would appear. */}
      {pending ? (
        <div className="border-2 border-border bg-card p-5" role="status">
          <p className="flex items-center gap-2 text-base font-bold">
            <CircleNotchIcon
              className="size-5 shrink-0 animate-spin motion-reduce:animate-none"
              weight="bold"
              aria-hidden="true"
            />{" "}
            <span>Searching DOL&apos;s records…</span>
          </p>{" "}
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/70">
            An employer or a case number answers in under a second. A law firm,
            a state or an occupation reads the published PERM file and can take
            a few seconds longer.
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
                {refusalText(filterAvailability(data?.lead ?? null)[k].why ?? "no-lead")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data && !data.needsLead && (data.skipped.live || data.skipped.published) ? (
        <div className="border-2 border-border bg-card p-4">
          <p className="text-base leading-relaxed">
            {/* ONE BRANCH, because `because` is never empty when the live half
                is out: a lead that forces the published record now names itself
                there. The old empty-list fallback also claimed the answer read
                "DOL's published PERM file", which stopped being true when a
                firm, state or occupation lead started reaching all three
                programs. */}
            {data.skipped.live ? (
              <>
                <b className="font-bold">Open filings are not in this answer.</b>{" "}
                DOL does not put the {data.skipped.because.join(", ")} on a case
                until it publishes it in a quarterly file, so searching by that
                reads the published record only.
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

      {data && !data.needsLead && (data.permOnly?.length ?? 0) > 0 ? (
        <div className="border-2 border-border bg-card p-4">
          <p className="text-base leading-relaxed">
            <b className="font-bold">Only published PERM cases are in this answer.</b>{" "}
            The {data.permOnly?.join(", ")}{" "}
            {data.permOnly?.length === 1 ? "is a field" : "are fields"} of
            DOL&apos;s PERM file alone; wage requests and LCAs don&apos;t carry{" "}
            {data.permOnly?.length === 1 ? "it" : "them"}.
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
            </p>{" "}
            {/* The same search as CSV: the route runs every guard again and
                returns these rows, never more. A plain link, so the browser's
                own session carries it and the file saves where downloads go. */}
            {submitted !== null ? (
              <a
                href={`/api/case-search?${submitted}&format=csv`}
                download="permtracker-case-search.csv"
                className="inline-flex min-h-[44px] items-center border-2 border-border bg-card px-4 font-mono text-xs font-bold uppercase tracking-wider hover:bg-tint-primary focus-visible:ring-2 focus-visible:ring-primary"
              >
                Download CSV ({fmt(data.rows.length)} rows)
              </a>
            ) : null}
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
              <tbody translate="no" className="bg-card">
                {shown.map((r) => (
                  <tr key={r.caseNumber} className="border-t-2 border-border/30 align-top">
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-base">
                      {/* PendingLink: /perm-case-status is dynamic and can
                          ask DOL live, so a bare link is seconds of silence. */}
                      <PendingLink
                        href={`/perm-case-status?case=${encodeURIComponent(r.caseNumber)}`}
                        className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                      >
                        {r.caseNumber}
                      </PendingLink>{" "}
                      {r.era === "history" ? (
                        <span className="mt-1 block font-sans text-sm text-foreground/70">FY2016 to FY2023 file</span>
                      ) : null}
                    {" "}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm">{PROGRAM_LABEL[r.program]}{" "}</td>
                    <td className="px-3 py-3">
                      <span className={"inline-block border-2 border-border px-2 py-1 text-sm font-bold " + statusTone(r.status, r.isFinal)}>
                        {r.status || "—"}
                      </span>
                    {" "}</td>
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
                    {" "}</td>
                    <td className="px-3 py-3 text-sm">
                      {r.jobTitle ?? "—"}{" "}
                      <RowDetails r={r} />
                    {" "}</td>
                    <td className="px-3 py-3 text-sm">{r.socTitle ?? "—"}{" "}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm">{r.state ?? "—"}{" "}</td>
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
                    {" "}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums">
                      {r.wage === null ? "—" : formatWage(r.wage, r.wageUnit)}
                    {" "}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums">{r.filedOn ?? "—"}{" "}</td>
                    {/* IN THIS COLUMN, BUT NEVER AS A BARE DATE. DOL's batch
                        endpoint returns no determination date, so a live row
                        that is already final has none anywhere. What we do have
                        is the day our sweep first saw it final, which is an
                        UPPER BOUND - it was decided at some point between that
                        sweep and the one before. Printed bare it would read as
                        DOL's own date, so it carries its words with it. The
                        sort key stays `decidedOn`, so these still order after
                        every genuinely dated row rather than interleaving. */}
                    <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums">
                      {r.decidedOn ? (
                        r.decidedOn
                      ) : r.seenDecidedOn ? (
                        <span className="text-foreground/70">
                          {r.seenDecidedOn}
                          {/* A MARKER, NOT A SENTENCE IN A DATE COLUMN. The
                              words read as clutter at column width, and a bare
                              date here would read as DOL's own determination
                              date, which this is not. `abbr` gives the hover
                              natively; the footnote under the table is what
                              carries it for a keyboard and a phone, where a
                              title attribute is invisible. */}
                          <abbr
                            title="Not DOL's determination date. DOL publishes none until the case reaches a quarterly file, so this is the day our daily check first saw it final: an upper bound."
                            className="ml-0.5 cursor-help align-super text-[0.65rem] font-bold text-primary no-underline"
                          >
                            *
                          </abbr>
                        </span>
                      ) : (
                        "—"
                      )}
                    {" "}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums">{r.days ?? "—"}{" "}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>{" "}

          {/* THE FOOTNOTE THE ASTERISK POINTS AT, rendered only when a row in
              this answer actually carries one. A `title` is invisible to a
              keyboard and to a phone, so the marker cannot be the only place
              the disclaimer lives. */}
          {data.rows.some((r) => !r.decidedOn && r.seenDecidedOn) ? (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/70">
              <span className="font-bold text-primary">*</span>{" "}
              Not DOL&apos;s determination date. DOL publishes none until a case
              reaches a quarterly file, so this is the day our daily check first
              saw the case final. It is an upper bound: the decision happened at
              some point between that check and the one before it.
            </p>
          ) : null}{" "}

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
              ? data.order === "decided-asc"
                ? " More matched than fit one answer: these are the oldest decisions, and a filing month, a decision month or a fiscal year brings the rest into reach."
                : " More matched than fit one answer: these are the newest, and a job title, a filing month or an outcome brings the rest into reach."
              : ""}{" "}
            {data.orderScope === "complete"
              ? `${ORDER_LABEL[data.order ?? "filed-desc"]} covers every match, because every match is here.`
              : `${ORDER_LABEL[data.order ?? "filed-desc"]} arranges the rows fetched, not every case that matched, so "highest wage" means highest among these rows.`}{" "}
            A column header reorders this page without searching again. A wage,
            a law firm, a worksite and an occupation appear once DOL has
            published the case in a quarterly file; open filings carry none of
            them.
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
