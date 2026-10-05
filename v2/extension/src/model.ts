/**
 * What the panel says, as plain data, so the wording is tested without a page.
 *
 * Three rules carry the honesty: a possible match always says "possible" and
 * names what it matched; no record is said plainly, with a way to search; and
 * a certified share appears only when the API gave one.
 */

import type { LookupAnswer } from "./api";

export type PanelState =
  | { kind: "loading"; name: string }
  | { kind: "answer"; answer: LookupAnswer }
  | { kind: "error"; name: string; message: string }
  | { kind: "nothing" };

export interface PanelRow {
  label: string;
  value: string;
  note?: string;
}

export interface PanelModel {
  title: string;
  /** A line above the figures: a caution for a possible match, the reason for no record. */
  notice?: string;
  tone: "plain" | "caution";
  rows: PanelRow[];
  link?: { href: string; text: string };
  footer?: string;
  retry?: boolean;
  busy?: boolean;
}

const int = (n: number) => n.toLocaleString("en-US");

/** "2026-10-01" as "Oct 1, 2026", read as a calendar date (no time zone shift). */
export function shortDate(iso: string | null): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * "97%", but never "100%" while a denial exists or "0%" while a case was
 * certified: Google's 1,608 certified and 4 denied is 99.75%, which whole-
 * percent rounding printed as 100%.
 */
export function certifiedPercent(certified: number, denied: number): string {
  const decided = certified + denied;
  if (decided <= 0) return "None decided";
  if (denied === 0) return "100%";
  if (certified === 0) return "0%";
  const pct = (certified / decided) * 100;
  const whole = Math.round(pct);
  if (whole >= 100) return `${Math.min(99.9, Math.round(pct * 10) / 10).toFixed(1)}%`;
  if (whole <= 0) return `${Math.max(0.1, Math.round(pct * 10) / 10).toFixed(1)}%`;
  return `${whole}%`;
}

export function panelFor(state: PanelState): PanelModel {
  if (state.kind === "nothing") {
    return {
      title: "No job posting here",
      tone: "plain",
      notice: "This page doesn't say who's hiring in a way PERM Tracker can read. Open a job posting and try again.",
      rows: [],
    };
  }
  if (state.kind === "loading") {
    return { title: state.name, tone: "plain", rows: [], busy: true, notice: "Checking DOL's records…" };
  }
  if (state.kind === "error") {
    return { title: state.name, tone: "caution", rows: [], notice: state.message, retry: true };
  }

  const { data, meta } = state.answer;
  const asOf = shortDate(meta.asOf);
  const footer = `From DOL's published files${asOf ? ` (through ${asOf})` : ""} and its live case status.`;
  const e = data.employer;
  if (data.match === "none" || !e) {
    return {
      title: data.query,
      tone: "plain",
      rows: [],
      notice: "No PERM or H-1B record under this name. Companies often file under their legal name, so it may still sponsor under another.",
      link: { href: meta.url, text: "Search PERM Tracker" },
      footer,
    };
  }

  const p = e.perm;
  const rows: PanelRow[] = [{ label: "PERM cases published", value: p.published > 0 ? int(p.published) : "None yet" }];
  if (p.certifiedShare !== null) {
    rows.push({ label: "Certified", value: certifiedPercent(p.certified, p.denied), note: "of decided cases" });
  } else if (p.published > 0) {
    rows.push({ label: "Certified", value: "Too few to say", note: `under ${data.shareFloor} decided` });
  }
  if (p.pending !== null && p.pending > 0) rows.push({ label: "Waiting at DOL now", value: int(p.pending) });
  const newest = shortDate(p.newestFiling);
  if (newest) rows.push({ label: "Newest PERM filing", value: newest });
  if (e.h1bLcas !== null) rows.push({ label: "H-1B applications (LCAs)", value: int(e.h1bLcas) });
  if (e.wageRequests !== null) rows.push({ label: "Prevailing wage requests", value: int(e.wageRequests) });

  return {
    title: e.name,
    tone: data.match === "possible" ? "caution" : "plain",
    notice:
      data.match === "possible"
        ? `Possible match: ${e.name}. The posting says "${data.query}", so check it's the same company.`
        : undefined,
    rows,
    link: { href: e.url, text: "See the full record" },
    footer,
  };
}
