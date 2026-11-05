"use client";

import { Fragment, useEffect, useId, useMemo, useState } from "react";
import { CaretRightIcon, CheckIcon, WarningIcon } from "@phosphor-icons/react";

import { DateInput } from "@/components/forms/DateInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  APPROVED_OUTCOMES,
  MIN_REPORTS,
  POST_SLUG,
  REFUSAL_GROUNDS,
  REPORT_CATEGORIES,
  REPORT_MODES,
  REPORT_OUTCOMES,
  REPORT_SECTIONS,
  RESOLVED_OUTCOMES,
  SLIP_COLORS,
  YES_NO_UNSURE,
  isoToday,
  takesNonimmigrant,
  takesNvc,
  validateReport,
  type ReportInput,
} from "@/lib/consularReport";
import { convexSiteUrl } from "@/lib/convexSite";
import { MONTH_NAMES } from "@convex/lib/months";
import { cn } from "@/lib/utils";

/**
 * "Share your interview": one report for one consulate, no account (convex/consularReports.ts).
 *
 * No name, no case number and no free-text box: a kind of visa, NVC's month, the appointment dates and what
 * happened, each from a fixed list. It's for anyone interviewing at the post, whatever the visa (owner, Nov 5
 * 2026: everyone goes through the same posts), with employment and the work visas listed first. A question
 * shows only where it applies (NVC's month for an immigrant visa or a K-1; the drop box, the 221(g) slip and
 * the emailed documents for a nonimmigrant visa), and an answer is dropped when the one it depends on
 * changes, so a hidden field never travels. The browser keeps a random key for this consulate
 * (localStorage), and whoever holds it can update the outcome or remove the report. Without storage the key
 * lasts the visit, and the form still works.
 *
 * The `#share` anchor opens the form.
 */

const storageKey = (post: string) => `pt-consular-key:${post}`;

function readKey(post: string): string | null {
  try {
    const k = window.localStorage.getItem(storageKey(post));
    return k && /^[0-9a-f]{64}$/.test(k) ? k : null;
  } catch {
    return null;
  }
}
function writeKey(post: string, k: string | null): void {
  try {
    if (k) window.localStorage.setItem(storageKey(post), k);
    else window.localStorage.removeItem(storageKey(post));
  } catch {
    // Private windows and blocked storage: the key lives for this visit only.
  }
}
function newKey(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

type Form = Omit<ReportInput, "post">;
const EMPTY: Form = {};

const selectCls =
  "mt-1.5 block h-11 w-full min-w-0 border-2 border-input bg-card px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Years NVC's month can carry: 2020 to this year. */
function years(): number[] {
  const now = Number(isoToday().slice(0, 4));
  return Array.from({ length: now - 2019 }, (_, i) => now - i);
}

export function ConsularReportForm({ post, name, className }: { post: string; name: string; className?: string }) {
  const uid = useId();
  const valid = POST_SLUG.test(post);
  const [key, setKey] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [nvc, setNvcParts] = useState({ m: "", y: "" });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ kind: "idle" } | { kind: "sending" } | { kind: "done" | "refused"; message: string }>({
    kind: "idle",
  });

  useEffect(() => {
    if (!valid) return;
    if (window.location.hash === "#share") setOpen(true);
    const k = readKey(post);
    const url = convexSiteUrl("/consular-report/mine");
    if (!k || !url) return;
    setKey(k);
    setLoading(true);
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ post, key: k }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { mine: Form | null } | null) => {
        if (b?.mine) {
          setForm({ ...EMPTY, ...b.mine });
          const m = b.mine.nvcCompleteMonth;
          setNvcParts(m ? { y: m.slice(0, 4), m: m.slice(5, 7) } : { m: "", y: "" });
          setSaved(true);
          setOpen(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [post, valid]);

  const check = useMemo(() => validateReport({ ...form, post }), [form, post]);
  const yearList = useMemo(() => years(), []);

  if (!valid) return null;
  const saveUrl = convexSiteUrl("/consular-report/save");
  const removeUrl = convexSiteUrl("/consular-report/remove");
  if (!saveUrl || !removeUrl) return null;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    // An answer that only goes with another one is dropped with it, so a hidden field never travels:
    // the questions for a nonimmigrant visa with the visa, the 221(g) details with the 221(g).
    if (k === "category" && !takesNvc(v as string | null)) setNvcParts({ m: "", y: "" });
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "category") {
        if (!takesNvc(next.category)) next.nvcCompleteMonth = null;
        if (!takesNonimmigrant(next.category)) {
          next.mode = null;
          next.slipColor = null;
          next.askedToEmailDocs = null;
        }
      }
      if (k === "outcome") {
        if (next.outcome !== "refused") next.refusalGround = null;
        if (!APPROVED_OUTCOMES.has(next.outcome ?? "")) next.approvedOn = null;
        if (!RESOLVED_OUTCOMES.has(next.outcome ?? "")) next.resolvedOn = null;
        if (next.outcome !== "221g") {
          next.slipColor = null;
          next.askedToEmailDocs = null;
        }
      }
      return next;
    });
    if (state.kind !== "sending") setState({ kind: "idle" });
  };

  // NVC's month is two pickers; the report carries it only once both are chosen.
  const setNvc = (part: Partial<typeof nvc>) => {
    const next = { ...nvc, ...part };
    setNvcParts(next);
    set("nvcCompleteMonth", next.m && next.y ? `${next.y}-${next.m}` : null);
  };
  const nvcHalf = (nvc.m === "") !== (nvc.y === "");

  async function save(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "sending" || !saveUrl) return;
    if (nvcHalf) {
      setState({ kind: "refused", message: "Choose both the month and the year NVC said the case was complete, or neither." });
      return;
    }
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
        // Only the answers given: a blank field isn't sent, and the server clears what isn't sent.
        body: JSON.stringify({ post, key: k, ...Object.fromEntries(Object.entries(form).filter(([, x]) => x !== null && x !== undefined && x !== "")) }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      const ok = res.ok && body?.ok === true;
      if (ok) {
        writeKey(post, k);
        setKey(k);
        setSaved(true);
      }
      setState({
        kind: ok ? "done" : "refused",
        message: ok
          ? `${body?.message ?? "Your report is saved."} It counts in the figures above the next time this page refreshes, within a day.`
          : (body?.message ?? "That didn't go through. Try again in a moment."),
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
        body: JSON.stringify({ post, key }),
      });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (res.ok) {
        writeKey(post, null);
        setKey(null);
        setSaved(false);
        setForm(EMPTY);
        setNvcParts({ m: "", y: "" });
      }
      setState({ kind: res.ok ? "done" : "refused", message: body?.message ?? "That didn't go through." });
    } catch {
      setState({ kind: "refused", message: "That didn't go through, which usually means the connection dropped." });
    }
  }

  const outcome = form.outcome ?? "";
  const nvcOpen = takesNvc(form.category);
  const nonimmigrant = takesNonimmigrant(form.category);
  const dropbox = form.mode === "dropbox";
  const resolvedLabel =
    outcome === "221g" ? "221(g) cleared on" : outcome === "passport-returned" ? "Passport came back on" : "Visa issued on";

  return (
    <section id="share" aria-labelledby={`${uid}-h`} className={cn("max-w-3xl", className)}>
      <h3 id={`${uid}-h`} className="font-heading text-xl font-bold">
        Share your interview
      </h3>{" "}
      <p className="mt-2 text-base leading-relaxed text-soft">
        For anyone interviewing at a U.S. consulate: a green card, a work visa stamping, a drop box, a K-1, a student or a
        visitor visa. Had an appointment in {name}, or waiting for one? Add what happened. No account, no name and no
        case number. It counts toward this consulate&apos;s figures, which show once {MIN_REPORTS} people have reported.
      </p>

      <details
        className="group mt-4 border-t-2 border-border"
        open={open}
        onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <CaretRightIcon className="size-4 shrink-0 transition-transform group-open:rotate-90" weight="bold" aria-hidden="true" />{" "}
          {saved ? "Your report for this consulate" : loading ? "Loading your report…" : "Add your report"}
        </summary>

        <form onSubmit={save} className="mt-4 space-y-6" noValidate>
          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <legend className="mb-2 text-base font-semibold">The visa</legend>{" "}
            <div>
              <Label htmlFor={`${uid}-cat`}>Kind of visa</Label>
              <select
                id={`${uid}-cat`}
                className={selectCls}
                value={form.category ?? ""}
                onChange={(e) => set("category", e.target.value || null)}
                required
              >
                <option value="">Choose one</option>
                {REPORT_SECTIONS.map((s) => (
                  <optgroup key={s.id} label={s.label}>
                    {REPORT_CATEGORIES.filter((c) => c.section === s.id).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            {nvcOpen ? (
              <Fragment>
                {" "}
                <div>
                  <p id={`${uid}-nvc-l`} className="text-sm font-medium leading-none">
                    NVC said the case was complete in
                  </p>{" "}
                  <div className="mt-1.5 grid grid-cols-2 gap-2 [&>*]:min-w-0" role="group" aria-labelledby={`${uid}-nvc-l`}>
                    <select
                      aria-label="Month NVC said the case was complete"
                      className={cn(selectCls, "mt-0")}
                      value={nvc.m}
                      onChange={(e) => setNvc({ m: e.target.value })}
                    >
                      <option value="">Month</option>
                      {MONTH_NAMES.map((m, i) => (
                        <option key={m} value={String(i + 1).padStart(2, "0")}>
                          {m}
                        </option>
                      ))}
                    </select>{" "}
                    <select
                      aria-label="Year NVC said the case was complete"
                      className={cn(selectCls, "mt-0")}
                      value={nvc.y}
                      onChange={(e) => setNvc({ y: e.target.value })}
                    >
                      <option value="">Year</option>
                      {yearList.map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>{" "}
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    NVC calls it documentarily complete. Leave it blank if you&apos;re not sure.
                  </p>
                </div>
              </Fragment>
            ) : null}
            {nonimmigrant ? (
              <Fragment>
                {" "}
                <ChoiceField
                  id={`${uid}-mode`}
                  label="Interview or drop box"
                  value={form.mode}
                  options={REPORT_MODES}
                  blank="Not saying"
                  onChange={(v) => set("mode", v)}
                />
              </Fragment>
            ) : null}
          </fieldset>{" "}

          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <legend className="mb-2 text-base font-semibold">Dates, only the ones that have happened</legend>{" "}
            <DateField
              id={`${uid}-letter`}
              label="Appointment letter came"
              value={form.scheduledOn}
              onChange={(v) => set("scheduledOn", v)}
            />{" "}
            <DateField
              id={`${uid}-interview`}
              label={dropbox ? "Documents dropped off" : "Interview"}
              value={form.interviewOn}
              onChange={(v) => set("interviewOn", v)}
            />
          </fieldset>{" "}

          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <legend className="mb-2 text-base font-semibold">What happened</legend>{" "}
            <div>
              <Label htmlFor={`${uid}-outcome`}>Result</Label>
              <select
                id={`${uid}-outcome`}
                className={selectCls}
                value={outcome}
                onChange={(e) => set("outcome", e.target.value || null)}
                required
              >
                <option value="">Choose one</option>
                {REPORT_OUTCOMES.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {outcome === "refused" ? (
              <Fragment>
                {" "}
                <ChoiceField
                  id={`${uid}-ground`}
                  label="On what ground"
                  value={form.refusalGround}
                  options={REFUSAL_GROUNDS}
                  blank="Not saying"
                  onChange={(v) => set("refusalGround", v)}
                />
              </Fragment>
            ) : null}
            {APPROVED_OUTCOMES.has(outcome) ? (
              <Fragment>
                {" "}
                <DateField id={`${uid}-approved`} label="Approved on" value={form.approvedOn} onChange={(v) => set("approvedOn", v)} />
              </Fragment>
            ) : null}
            {RESOLVED_OUTCOMES.has(outcome) ? (
              <Fragment>
                {" "}
                <DateField id={`${uid}-resolved`} label={resolvedLabel} value={form.resolvedOn} onChange={(v) => set("resolvedOn", v)} />
              </Fragment>
            ) : null}
            {outcome === "221g" && nonimmigrant ? (
              <Fragment>
                {" "}
                <ChoiceField
                  id={`${uid}-slip`}
                  label="Colour of the 221(g) slip"
                  value={form.slipColor}
                  options={SLIP_COLORS}
                  blank="Not saying"
                  onChange={(v) => set("slipColor", v)}
                />{" "}
                <ChoiceField
                  id={`${uid}-email`}
                  label="Asked to email documents"
                  value={form.askedToEmailDocs}
                  options={YES_NO_UNSURE}
                  blank="Not saying"
                  onChange={(v) => set("askedToEmailDocs", v)}
                />
              </Fragment>
            ) : null}
          </fieldset>{" "}

          <p className="text-sm leading-relaxed text-muted-foreground">
            This browser keeps a key for this consulate, so you can come back to update the result or remove the report.
            Nothing else about you is kept with it.
          </p>{" "}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="outline" loading={state.kind === "sending"}>
              {saved ? "Save changes" : "Save my report"}
            </Button>{" "}
            {saved ? (
              <Button type="button" variant="ghost" onClick={remove} disabled={state.kind === "sending"}>
                Remove my report
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
    </section>
  );
}

/** A labelled pick from a fixed list, blank meaning no answer. */
function ChoiceField({
  id,
  label,
  value,
  options,
  blank,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null | undefined;
  options: readonly { id: string; label: string }[];
  blank: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={selectCls} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{blank}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A labelled date, blank meaning no answer. */
function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <DateInput id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="mt-1.5" />
    </div>
  );
}
