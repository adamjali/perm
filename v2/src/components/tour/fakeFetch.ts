import answers from "./soc-fixtures.json";

/**
 * The job-code reads the tour's pages make (`/api/soc` and `/api/soc/<code>`), answered from the recorded
 * fixtures (scripts/record-soc-fixtures.mjs), so a story draws the SOC field, its card and the suggested
 * description with real figures and no network. Any other request goes to the real fetch.
 */
const RECORDED = answers as Record<string, unknown>;

export function installTourFetch() {
  if (typeof window === "undefined" || (window.fetch as { tour?: true }).tour) return;
  const real = window.fetch.bind(window);
  const fake = (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    const key = url.pathname + url.search;
    if (url.pathname.startsWith("/api/soc")) {
      const body = RECORDED[key];
      return Promise.resolve(
        body === undefined
          ? new Response(JSON.stringify({ error: "Not in the tour's recorded answers." }), { status: 404 })
          : new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }),
      );
    }
    return real(input, init);
  };
  window.fetch = Object.assign(fake, { tour: true as const });
}
