/**
 * Dates worked out in the public deadline calculator, carried into the app
 * when the visitor signs up or signs in to keep them as a case (Oct 19 2026).
 *
 * They travel two ways at once, because either can be lost: in the address
 * (`?calc=`), which survives a browser that blocks site storage, and in
 * localStorage, which survives the sign-up form and the email code. The app
 * reads the address first.
 *
 * Only the dates travel. A case also needs the employer, the job and the
 * person, which the calculator never asks for, so nothing is saved until
 * someone fills those in: the new-case form and the setup wizard's "Create your
 * first case" step arrive with the dates already in place.
 */

import { formatAsOf } from "@/lib/dolFormat";
import { isIsoDate } from "@/lib/dateCoverage";

export interface CarriedDates {
  /** The prevailing wage determination date. */
  pwd: string;
  /** The first recruitment step. */
  first?: string;
  /** The last recruitment step; only with a first step on or before it. */
  last?: string;
}

export const CARRIED_PARAM = "calc";
const STORE_KEY = "pt:calculator-case";
/** Fired on window when the carried dates are stored or dropped (useCarriedDates listens). */
export const CARRIED_EVENT = "pt:carried-change";
/** A carried set older than this is a visit long over, not a sign-up in progress. */
export const CARRIED_KEEP_MS = 14 * 24 * 60 * 60 * 1000;

const sane = (d: string | undefined): d is string =>
  d !== undefined && isIsoDate(d) && d >= "1990-01-01" && d <= "2100-12-31";

/** Only what the calculator itself would accept, in a shape that can't contradict itself. */
export function cleanCarried(d: { pwd?: string; first?: string; last?: string }): CarriedDates | null {
  if (!sane(d.pwd)) return null;
  const out: CarriedDates = { pwd: d.pwd };
  if (sane(d.first)) {
    out.first = d.first;
    if (sane(d.last) && d.last >= d.first) out.last = d.last;
  }
  return out;
}

/** `2026-01-15_2026-02-01_2026-03-10`: no character a URL has to escape. */
export function encodeCarried(d: CarriedDates): string {
  return [d.pwd, d.first, d.last].filter(Boolean).join("_");
}

export function decodeCarried(raw: string | null | undefined): CarriedDates | null {
  if (!raw || raw.length > 40) return null;
  const [pwd, first, last, extra] = raw.split("_");
  if (extra !== undefined) return null;
  return cleanCarried({ pwd, first, last });
}

/**
 * Where sign-up or sign-in sends someone who came from the calculator: a new
 * account to the dashboard, where the setup wizard's first case takes the
 * dates; an existing one straight to the new-case form. Read from the address
 * only, so dates stored on an earlier visit never redirect an ordinary sign-in.
 */
export function afterAuthPath(
  kind: "signup" | "login",
  search: string = typeof window === "undefined" ? "" : window.location.search,
): string {
  const d = decodeCarried(new URLSearchParams(search).get(CARRIED_PARAM));
  if (!d) return "/dashboard";
  return carriedHref(kind === "signup" ? "/dashboard" : "/cases/new", d);
}

/** A path with the dates on it, for the sign-up, sign-in and new-case links. */
export function carriedHref(path: string, d: CarriedDates): string {
  return `${path}?${CARRIED_PARAM}=${encodeCarried(d)}`;
}

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function rememberCarried(d: CarriedDates, now: number = Date.now()): void {
  try {
    store()?.setItem(STORE_KEY, JSON.stringify({ calc: encodeCarried(d), at: now }));
  } catch {
    // A full or refusing store: the address still carries the dates.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CARRIED_EVENT));
}

/** The address's dates, else the stored ones while they're fresh. */
export function readCarried(search: string = typeof window === "undefined" ? "" : window.location.search, now: number = Date.now()): CarriedDates | null {
  const fromUrl = decodeCarried(new URLSearchParams(search).get(CARRIED_PARAM));
  if (fromUrl) return fromUrl;
  try {
    const raw = store()?.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { calc?: unknown; at?: unknown };
    if (typeof parsed.at !== "number" || now - parsed.at > CARRIED_KEEP_MS || now < parsed.at) return null;
    return typeof parsed.calc === "string" ? decodeCarried(parsed.calc) : null;
  } catch {
    return null;
  }
}

/** Once the dates are on a case, or the person said no: drop them from storage and the address. */
export function forgetCarried(): void {
  try {
    store()?.removeItem(STORE_KEY);
  } catch {
    // Nothing stored, or nothing to remove.
  }
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(CARRIED_PARAM)) {
      url.searchParams.delete(CARRIED_PARAM);
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  } catch {
    // An address that can't be rewritten keeps its parameter; nothing reads it twice.
  }
  window.dispatchEvent(new Event(CARRIED_EVENT));
}

/** One line naming the dates, for the places that offer to save them. */
export function carriedSummary(d: CarriedDates): string {
  const parts = [`wage determination ${formatAsOf(d.pwd)}`];
  if (d.first && d.last) parts.push(`recruitment ${formatAsOf(d.first)} to ${formatAsOf(d.last)}`);
  else if (d.first) parts.push(`first recruitment step ${formatAsOf(d.first)}`);
  return parts.join(", ");
}
