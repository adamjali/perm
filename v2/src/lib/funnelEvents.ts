"use client";

import { useCallback, useEffect, useRef } from "react";

import { analytics } from "@/lib/analytics";
import type { AlertSignupKind } from "@/lib/alertSignupEvent";
import { normaliseCaseNumber } from "@/lib/caseNumberShape";
import { looksLikeReceipt } from "@/lib/uscis/receipt";

/**
 * The funnel's events: what people look up, how they search, whether they see
 * an alert form and start it, and whether they're shown an estimate.
 *
 * NOTHING TYPED IS SENT. A case number, receipt, name or email never leaves
 * the browser through these: a lookup sends the SHAPE of what was typed
 * ("case", "receipt", "month", "name"), a result click sends its group and
 * position. Those are enough to count the funnel and to tell whether a box is
 * being used for what it's for.
 */

export type QueryShape = "empty" | "case" | "case-undashed" | "receipt" | "month" | "name";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/** A case number typed without its dashes: G10026254230507, JOA30026271264525. */
const UNDASHED = /^(?:[A-Z]|JOA)\d{14,}$/;

/** What kind of thing a search box was given, without the thing itself. */
export function queryShape(raw: string): QueryShape {
  const q = raw.trim();
  if (q.length === 0) return "empty";
  if (MONTH.test(q)) return "month";
  if (looksLikeReceipt(q)) return "receipt";
  if (normaliseCaseNumber(q) !== null) return "case";
  // The site's rule wants the dashes; counting these shows how often people
  // leave them out.
  if (UNDASHED.test(q.toUpperCase().replace(/[\s-]/g, ""))) return "case-undashed";
  return "name";
}

/** A case-number box was submitted. `source` names the page or box. */
export function trackLookup(source: string, raw: string): void {
  analytics.capture("case_lookup_submitted", { source, shape: queryShape(raw) });
}

/** A site-wide search box (header, palette, /case-search) was submitted. */
export function trackSiteSearch(surface: string, raw: string): void {
  analytics.capture("site_search_submitted", { surface, shape: queryShape(raw) });
}

/** The search palette opened; `trigger` is "shortcut" or "button". */
export function trackPaletteOpened(trigger: "shortcut" | "button"): void {
  analytics.capture("palette_opened", { trigger });
}

/**
 * What kind of place a search result leads to, read from its address so no
 * name or number goes with the event.
 */
export function hrefGroup(href: string): string {
  const path = href.split(/[?#]/)[0] ?? "";
  if (path === "/perm-case-status" || path === "/uscis-case-status") return "case";
  if (path.startsWith("/tools/perm-timeline-calculator")) return "estimate";
  if (/^\/perm-employers\/[^/]+$/.test(path) && !["/perm-employers/compare", "/perm-employers/under-review"].includes(path)) return "employer";
  if (/^\/perm-attorneys\/[^/]+$/.test(path)) return "firm";
  if (/^\/perm-wages\/[^/]+$/.test(path)) return "job";
  if (path === "/case-search") return "all-results";
  if (/^\/(blog|guides|changelog)\//.test(path)) return "article";
  return "page";
}

/** A palette row was chosen; only the kind of place it leads to is sent. */
export function trackPaletteSelected(href: string): void {
  analytics.capture("palette_selected", { group: hrefGroup(href) });
}

/** A result on a results page was opened. */
export function trackSearchResultClicked(surface: string, group: string, position: number): void {
  analytics.capture("search_result_clicked", { surface, group, position });
}

/** A case estimate was shown, and which model dated it. */
export function trackEstimateShown(model: string, dated: boolean, source: string): void {
  analytics.capture("estimate_shown", { model, dated, source });
}

/**
 * An alert form's two quiet events: it came into view (once per mount), and
 * someone started it (first focus inside, once per mount). Together with
 * `alert_signup` they show where people drop: never saw it, saw it and didn't
 * start, or started and didn't finish.
 *
 * Returns a ref for the form's outer element and a focus handler for it.
 */
export function useAlertFormTelemetry(kind: AlertSignupKind, source?: string) {
  const ref = useRef<HTMLElement | null>(null);
  const seen = useRef(false);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !seen.current) {
          seen.current = true;
          analytics.capture("alert_form_viewed", { kind, source });
          io.disconnect();
        }
      },
      // Half the form on screen counts as seen; a sliver at the bottom doesn't.
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [kind, source]);

  const onFocusCapture = useCallback(() => {
    if (started.current) return;
    started.current = true;
    analytics.capture("alert_form_started", { kind, source });
  }, [kind, source]);

  const setRef = useCallback((el: HTMLElement | null) => {
    ref.current = el;
  }, []);

  return { ref: setRef, onFocusCapture };
}
