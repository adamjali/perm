"use client";

import { Fragment, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { CheckIcon, WarningIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui";
import {
  CATEGORIES,
  COUNTRIES,
  DATE_FIELDS,
  I140_CENTERS,
  PERM_CASE,
  RFE_FORMS,
  RFE_OUTCOMES,
  RFE_REASONS,
  ROUTES,
  validateTimeline,
  type TimelineInput,
} from "@/lib/communityTimeline";
import { cn } from "@/lib/utils";

/**
 * The case's timeline after PERM: what people report, and a form to add
 * yours. Kept under its old name so the case page did not change; it replaced
 * the one-milestone report on 2026-09-26 and still counts those 14 reports.
 *
 * WHAT IS CHECKED AND WHAT IS NOT is said above the form, not under it: the
 * PERM dates come from DOL's record by case number and are never typed here;
 * everything after PERM has no public per-case source and is self-reported.
 *
 * No account. The browser keeps a random key for this case (localStorage),
 * and whoever holds it can change or remove the timeline. Without storage the
 * key lasts the visit, and the form says nothing different: it still works.
 *
 * The `#timeline` anchor is what the "certified" alert email links to, and it
 * opens the form.
 */

interface Summary {
  timelines: number;
  stops: { id: string; label: string; count: number }[];
}
interface Mine {
  input: TimelineInput;
  permFiledOn: string | null;
  permCertifiedOn: string | null;
}

/** Convex HTTP actions live on the `.convex.site` twin of the cloud URL. */
function endpoint(path: string): string | null {
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!cloud) return null;
  return `${cloud.replace(".convex.cloud", ".convex.site")}${path}`;
}

const storageKey = (c: string) => `pt-timeline-key:${c}`;

function readKey(c: string): string | null {
  try {
    const k = window.localStorage.getItem(storageKey(c));
    return k && /^[0-9a-f]{64}$/.test(k) ? k : null;
  } catch {
    return null;
  }
}
function writeKey(c: string, k: string | null): void {
  try {
    if (k) window.localStorage.setItem(storageKey(c), k);
    else window.localStorage.removeItem(storageKey(c));
  } catch {
    // Private windows and blocked storage: the key lives for this visit only.
  }
}
function newKey(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

const monthDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

const EMPTY: TimelineInput = { route: "adjustment", public: false };

const selectCls =
  "mt-1.5 block min-h-11 w-full min-w-0 border-2 border-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function CaseMilestones({ caseNumber, className }: { caseNumber: string; className?: string }) {
  const uid = useId();
  const valid = PERM_CASE.test(caseNumber);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [mine, setMine] = useState<Mine | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [form, setForm] = useState<TimelineInput>(EMPTY);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "sending" } | { kind: "done" | "refused"; message: string }
  >({ kind: "idle" });

  const summaryUrl = valid ? endpoint(`/timeline/summary?case=${encodeURIComponent(caseNumber)}`) : null;

  const loadSummary = (fresh = false) => {
    if (!summaryUrl) return;
    fetch(summaryUrl, fresh ? { cache: "no-store" } : undefined)
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Summary | null) => {
        if (s) setSummary(s);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!valid) return;
    loadSummary();
    if (window.location.hash === "#timeline") setOpen(true);
    const k = readKey(caseNumber);
    const url = endpoint("/timeline/mine");
    if (!k || !url) return;
    setKey(k);
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseNumber, key: k }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { mine: Mine | null } | null) => {
        if (b?.mine) {
          setMine(b.mine);
          setForm({ ...EMPTY, ...b.mine.input });
          setOpen(true);
        }
      })
      .catch(() => {});
    // Runs once per case: the summary URL and key are derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseNumber, valid]);

  const route = form.route === "consular" ? "consular" : "adjustment";
  const dateFields = useMemo(() => DATE_FIELDS.filter((f) => (f.routes as readonly string[]).includes(route)), [route]);
  const check = useMemo(() => validateTimeline(form), [form]);

  if (!valid) return null;
  const saveUrl = endpoint("/timeline/save");
  const removeUrl = endpoint("/timeline/remove");
  if (!saveUrl || !removeUrl) return null;

  const set = <K extends keyof TimelineInput>(k: K, v: TimelineInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (state.kind !== "sending") setState({ kind: "idle" });
  };

  async function save(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "sending" || !saveUrl) return;
    if (!check.ok) {
      setState({ kind: "refused", message: check.message });
      return;
    }
    const k = key ?? newKey();
    setState({ kind: "sending" });
    try {
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseNumber, key: k, ...form }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (res.ok && body?.ok) {
        writeKey(caseNumber, k);
        setKey(k);
        setMine((m) => ({ input: form, permFiledOn: m?.permFiledOn ?? null, permCertifiedOn: m?.permCertifiedOn ?? null }));
        loadSummary(true);
      }
      setState({
        kind: res.ok && body?.ok ? "done" : "refused",
        message: body?.message ?? "That didn't go through. Try again in a moment.",
      });
    } catch {
      setState({ kind: "refused", message: "That didn't go through, which usually means the connection dropped." });
    }
  }

  async function remove() {
    if (!key || !removeUrl || state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      const res = await fetch(removeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseNumber, key }),
      });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (res.ok) {
        writeKey(caseNumber, null);
        setKey(null);
        setMine(null);
        setForm(EMPTY);
        loadSummary(true);
      }
      setState({ kind: res.ok ? "done" : "refused", message: body?.message ?? "That didn't go through." });
    } catch {
      setState({ kind: "refused", message: "That didn't go through, which usually means the connection dropped." });
    }
  }

  const stops = summary?.stops ?? [];
  const reported = stops.reduce((n, s) => n + s.count, 0);

  return (
    <section
      id="timeline"
      className={cn("scroll-mt-28 border-2 border-border bg-card p-5 shadow-hard sm:p-6", className)}
    >
      <h2 className="font-heading text-xl font-black sm:text-2xl">After PERM: the rest of the timeline</h2>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/80">
        USCIS doesn&apos;t publish the I-140 or the I-485 case by case, so this part comes from the people waiting.
        Dates here are self-reported. The PERM dates beside them come from DOL&apos;s own record.
      </p>{" "}

      {/* The track: one square per stop, lit when anyone has reported it for this case. */}
      {summary ? (
        <ol className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-4 lg:grid-cols-7 [&>*]:min-w-0" aria-label="Reported milestones for this case">
          {stops.map((s) => (
            <Fragment key={s.id}>
              {" "}
              <li
                className={cn(
                  "flex items-center justify-between gap-2 border-2 px-3 py-2 sm:flex-col sm:items-start",
                  s.count > 0 ? "border-border bg-primary/15" : "border-border/40 bg-background text-foreground/60",
                )}
              >
                <span className="text-sm font-bold leading-tight">{s.label}</span>{" "}
                <span className="font-mono text-sm tabular-nums">
                  {s.count > 0 ? `${s.count} reported` : "none yet"}
                </span>
              </li>
            </Fragment>
          ))}
        </ol>
      ) : null}{" "}
      {summary && reported === 0 && !mine ? (
        <p className="mt-3 text-sm text-foreground/70">Nobody has added dates for this case yet.</p>
      ) : null}

      <details
        className="group mt-6 border-t-2 border-border pt-4"
        open={open}
        onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer list-none font-heading text-lg font-black marker:content-none">
          <span className="inline-flex min-h-11 items-center gap-2 underline decoration-primary decoration-2 underline-offset-4">
            {mine ? "Your timeline for this case" : "Add your dates"}
          </span>
        </summary>

        {mine?.permCertifiedOn ? (
          <p className="mt-3 flex items-start gap-2 text-sm text-foreground/80">
            <CheckIcon size={18} weight="bold" className="mt-0.5 shrink-0 text-primary-text" aria-hidden="true" />
            <span>
              DOL&apos;s record for this case: filed{" "}
              {mine.permFiledOn ? <b translate="no">{monthDay(mine.permFiledOn)}</b> : "on a date DOL doesn't show"},
              certified <b translate="no">{monthDay(mine.permCertifiedOn)}</b>.
            </span>
          </p>
        ) : null}

        <form onSubmit={save} className="mt-4 space-y-6" noValidate>
          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <legend className="mb-2 text-base font-bold">About the case</legend>
            <div>
              <Label htmlFor={`${uid}-cat`}>Category</Label>
              <select id={`${uid}-cat`} className={selectCls} value={form.category ?? ""} onChange={(e) => set("category", e.target.value || null)}>
                <option value="">Not saying</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>{" "}
            <div>
              <Label htmlFor={`${uid}-country`}>Country of chargeability</Label>
              <select id={`${uid}-country`} className={selectCls} value={form.country ?? ""} onChange={(e) => set("country", e.target.value || null)}>
                <option value="">Not saying</option>
                {COUNTRIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>{" "}
            <div>
              <Label htmlFor={`${uid}-route`}>After the I-140</Label>
              <select id={`${uid}-route`} className={selectCls} value={route} onChange={(e) => set("route", e.target.value)}>
                {ROUTES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>{" "}
            <div>
              <Label htmlFor={`${uid}-center`}>Where the I-140 was decided</Label>
              <select id={`${uid}-center`} className={selectCls} value={form.i140Center ?? ""} onChange={(e) => set("i140Center", e.target.value || null)}>
                <option value="">Not sure</option>
                {I140_CENTERS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>{" "}
            <label className="flex min-h-11 items-center gap-3 text-base sm:col-span-2">
              <input
                type="checkbox"
                className="size-5 shrink-0 accent-primary"
                checked={form.premium === true}
                onChange={(e) => set("premium", e.target.checked ? true : null)}
              />
              <span>The I-140 was filed with premium processing</span>
            </label>
          </fieldset>{" "}

          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <legend className="mb-2 text-base font-bold">Dates, only the ones that have happened</legend>
            {dateFields.map((f) => (
              <Fragment key={f.id}>
                {" "}
                <div>
                  <Label htmlFor={`${uid}-${f.id}`}>{f.label}</Label>
                  <DateInput
                    id={`${uid}-${f.id}`}
                    value={(form[f.id] as string | null | undefined) ?? ""}
                    onChange={(e) => set(f.id, e.target.value || null)}
                    className="mt-1.5"
                  />
                </div>
              </Fragment>
            ))}
          </fieldset>{" "}

          <details className="border-2 border-border/60 p-4" open={Boolean(form.rfeForm)}>
            <summary className="cursor-pointer list-none text-base font-bold marker:content-none">
              <span className="inline-flex min-h-11 items-center">Got a request for evidence (RFE)?</span>
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
              <div>
                <Label htmlFor={`${uid}-rfe-form`}>On which form</Label>
                <select id={`${uid}-rfe-form`} className={selectCls} value={form.rfeForm ?? ""} onChange={(e) => set("rfeForm", e.target.value || null)}>
                  <option value="">No RFE</option>
                  {RFE_FORMS.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </div>{" "}
              <div>
                <Label htmlFor={`${uid}-rfe-reason`}>What it asked about</Label>
                <select id={`${uid}-rfe-reason`} className={selectCls} value={form.rfeReason ?? ""} onChange={(e) => set("rfeReason", e.target.value || null)}>
                  <option value="">Not saying</option>
                  {RFE_REASONS.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </div>{" "}
              <div>
                <Label htmlFor={`${uid}-rfe-issued`}>RFE dated</Label>
                <DateInput id={`${uid}-rfe-issued`} value={form.rfeIssuedOn ?? ""} onChange={(e) => set("rfeIssuedOn", e.target.value || null)} className="mt-1.5" />
              </div>{" "}
              <div>
                <Label htmlFor={`${uid}-rfe-resp`}>Response sent</Label>
                <DateInput id={`${uid}-rfe-resp`} value={form.rfeRespondedOn ?? ""} onChange={(e) => set("rfeRespondedOn", e.target.value || null)} className="mt-1.5" />
              </div>{" "}
              <div className="sm:col-span-2">
                <Label htmlFor={`${uid}-rfe-out`}>What happened</Label>
                <select id={`${uid}-rfe-out`} className={selectCls} value={form.rfeOutcome ?? ""} onChange={(e) => set("rfeOutcome", e.target.value || null)}>
                  <option value="">Not saying</option>
                  {RFE_OUTCOMES.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </details>{" "}

          <div className="border-2 border-border bg-background p-4">
            <label className="flex min-h-11 items-start gap-3 text-base">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0 accent-primary"
                checked={form.public === true}
                onChange={(e) => set("public", e.target.checked)}
              />
              <span>
                <b>Show my timeline on the public board.</b> The case number and employer never show there; it lists
                the filing month and how many days each step took.
              </span>
            </label>{" "}
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              Either way, your dates count toward the anonymous medians on the{" "}
              <Link href="/green-card-timelines" className="font-bold underline decoration-primary decoration-2 underline-offset-2">
                green card timelines
              </Link>{" "}
              page. This browser keeps a key for this case so you can edit or remove it later.
            </p>
          </div>{" "}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={state.kind === "sending"}
              className="min-h-11 border-2 border-border bg-primary px-5 font-bold text-primary-foreground shadow-hard transition-transform hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {state.kind === "sending" ? "Saving" : mine ? "Save changes" : "Save my timeline"}
            </button>{" "}
            {mine ? (
              <button
                type="button"
                onClick={remove}
                disabled={state.kind === "sending"}
                className="min-h-11 border-2 border-border bg-background px-5 font-bold transition-transform hover:-translate-y-[1px] disabled:opacity-60"
              >
                Remove my timeline
              </button>
            ) : null}
          </div>{" "}
          {state.kind === "done" ? (
            <p role="status" className="flex items-start gap-2 text-base">
              <CheckIcon size={18} weight="bold" className="mt-1 shrink-0 text-primary-text" aria-hidden="true" /> {state.message}
            </p>
          ) : state.kind === "refused" ? (
            <p role="alert" className="flex items-start gap-2 text-base">
              <WarningIcon size={18} weight="bold" className="mt-1 shrink-0" aria-hidden="true" /> {state.message}
            </p>
          ) : null}
        </form>
      </details>
    </section>
  );
}
