import { afterEach, describe, expect, it, vi } from "vitest";

import { edgeCountry, parseTraceCountry } from "../edgeCountry";

/**
 * Cookie-free analytics lost every anonymous visitor's country on Sep 28 2026
 * (PostHog drops the IP before its GeoIP step). The country now comes from
 * Cloudflare's /cdn-cgi/trace, and these hold the two things that matter:
 * only a real two-letter code is kept, and nothing can make PostHog wait.
 */

const TRACE = "fl=12f1\nh=permtracker.app\nip=203.0.113.9\nts=1790819500.1\nloc=US\ntls=TLSv1.3\n";

describe("parseTraceCountry", () => {
  it.each([
    [TRACE, "US"],
    ["loc=VN\n", "VN"],
    ["loc=XX\n", null], // unknown
    ["loc=T1\n", null], // Tor
    ["loc=usa\n", null],
    ["colo=EWR\n", null],
    ["", null],
  ])("%j -> %s", (body, want) => {
    expect(parseTraceCountry(body)).toBe(want);
  });

  it("keeps the country only, never the IP", () => {
    expect(parseTraceCountry(TRACE)).not.toContain("203");
  });
});

describe("edgeCountry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reads the country from the same-origin trace, sending no cookie", async () => {
    const fetchMock = vi.fn(async () => new Response(TRACE, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(edgeCountry(800, true)).resolves.toBe("US");
    expect(fetchMock).toHaveBeenCalledWith(
      "/cdn-cgi/trace",
      expect.objectContaining({ credentials: "omit", cache: "no-store" }),
    );
  });

  it("asks nothing off https (local dev has no edge)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(edgeCountry(800, false)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives up at the wait limit rather than holding PostHog back", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ),
    );
    const pending = edgeCountry(800, true);
    await vi.advanceTimersByTimeAsync(800);
    await expect(pending).resolves.toBeNull();
  });

  it("treats an error page as no country", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("loc=US", { status: 404 })));
    await expect(edgeCountry(800, true)).resolves.toBeNull();
  });
});
