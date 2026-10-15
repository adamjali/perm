"use client";

import { Fragment, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { CaretRightIcon, CheckIcon, WarningIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageSection } from "@/components/data/PageSection";
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
import { convexSiteUrl } from "@/lib/convexSite";
import { shortDate } from "@convex/lib/months";

/**
 * The case's timeline after PERM: what people report, and a form to add
 * yours. It also counts the reports made through the older one-milestone
 * form.
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

const fullDay = (iso: string) => shortDate(iso) ?? iso;

const EMPTY: TimelineInput = { route: "adjustment", public: false };

const selectCls =
  "mt-1.5 block h-11 w-full min-w-0 border border-input bg-card px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

  const summaryUrl = valid ? convexSiteUrl(`/timeline/summary?case=${encodeURIComponent(caseNumber)}`) : null;

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
    const url = convexSiteUrl("/timeline/mine");
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
  const saveUrl = convexSiteUrl("/timeline/save");
  const removeUrl = convexSiteUrl("/timeline/remove");
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

  const shown = stops.filter((st) => st.count > 0);

  return (
    <PageSection
      id="timeline"
      title="After PERM"
      className={className}
      lede="USCIS doesn't publish the I-140 or the I-485 case by case, so this part comes from the people waiting. Their dates are self-reported; the PERM dates come from DOL's own record."
    >
      {summary ? (
        <p className="text-base leading-relaxed text-soft">
          {shown.length > 0 ? (
            <>
              Reported for this case:{" "}
              {shown.map((st, i) => (
                <Fragment key={st.id}>
                  {i > 0 ? ", " : ""}
                  <b className="font-semibold text-foreground">{st.label}</b> ({st.count})
                </Fragment>
              ))}
              .
            </>
          ) : !mine ? (
            "Nobody has added dates for this case yet."
          ) : null}
        </p>
      ) : null}

      <details
        className="group mt-4"
        open={open}
        onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <CaretRightIcon className="size-4 shrink-0 transition-transform group-open:rotate-90" weight="bold" aria-hidden="true" />{" "}
          {mine ? "Your timeline for this case" : "Add your dates"}
        </summary>

        {mine?.permCertifiedOn ? (
          <p className="mt-3 flex items-start gap-2 text-sm text-soft">
            <CheckIcon size={18} weight="bold" className="mt-0.5 shrink-0 text-primary-text" aria-hidden="true" />
            <span>
              DOL&apos;s record for this case: filed{" "}
              {mine.permFiledOn ? <b translate="no">{fullDay(mine.permFiledOn)}</b> : "on a date DOL doesn't show"},
              certified <b translate="no">{fullDay(mine.permCertifiedOn)}</b>.
            </span>
          </p>
        ) : null}

        <form onSubmit={save} className="mt-4 space-y-6" noValidate>
          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <legend className="mb-2 text-base font-semibold">About the case</legend>
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
            <legend className="mb-2 text-base font-semibold">Dates, only the ones that have happened</legend>
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

          <details className="border-t border-border pt-2" open={Boolean(form.rfeForm)}>
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-base font-semibold [&::-webkit-details-marker]:hidden">
              Got a request for evidence (RFE)?
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

          <div className="border-t border-border pt-4">
            <label className="flex min-h-11 items-start gap-3 text-base">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0 accent-primary"
                checked={form.public === true}
                onChange={(e) => set("public", e.target.checked)}
              />
              <span>
                <b className="font-semibold">Show my timeline on the public board.</b> The case number and employer never show there; it lists
                the filing month and how many days each step took.
              </span>
            </label>{" "}
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Either way, your dates count toward the anonymous medians on the{" "}
              <Link href="/green-card-timelines" className="link">
                green card timelines
              </Link>{" "}
              page. This browser keeps a key for this case so you can edit or remove it later.
            </p>
          </div>{" "}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="outline" loading={state.kind === "sending"}>
              {mine ? "Save changes" : "Save my timeline"}
            </Button>{" "}
            {mine ? (
              <Button type="button" variant="ghost" onClick={remove} disabled={state.kind === "sending"}>
                Remove my timeline
              </Button>
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
    </PageSection>
  );
}
