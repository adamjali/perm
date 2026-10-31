import "server-only";

import { cache } from "react";

import { parseUscisCharts, USCIS_CHARTS_URL, type UscisCharts } from "@/lib/uscisCharts";

/**
 * USCIS's monthly chart notice, read on the server once a day (the fetch's
 * window), shared by every page that shows it. Never fatal: a page without it
 * says what the bulletin says and leaves USCIS's choice out. A page that
 * loaded and gave no chart is logged, so a reworded notice shows in the
 * server's journal instead of passing in silence.
 */
export const getUscisCharts = cache(async (): Promise<UscisCharts | null> => {
  try {
    const res = await fetch(USCIS_CHARTS_URL, {
      headers: {
        // uscis.gov answers a bare UA inconsistently and intermittently 403s
        // datacenter addresses. One honest browser-like set, and no retries.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(6000),
      // The pages' own window: a fetch's revalidate caps the page's.
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.warn("[uscisCharts] USCIS answered", res.status);
      return null;
    }
    const charts = parseUscisCharts(await res.text());
    if (!charts?.employment) console.warn("[uscisCharts] the page loaded but no employment-based chart was read", charts?.month ?? "no month");
    return charts;
  } catch (e) {
    console.warn("[uscisCharts] read failed", e instanceof Error ? e.message : e);
    return null;
  }
});
