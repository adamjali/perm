import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import posthog from "posthog-js";
import { claimAutoReload, failedRequests, isReloadCurable, reportCaughtError } from "../recovery";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

describe("isReloadCurable", () => {
  it.each([
    ["ChunkLoadError", "Loading chunk 123 failed."],
    ["TypeError", "Cannot read properties of undefined (reading 'call')"],
    ["TypeError", "Failed to fetch dynamically imported module: /_next/x.js"],
    ["TypeError", "Failed to fetch"],
    ["TypeError", "Load failed"],
    ["Error", "Connection closed."],
    ["Error", "An error occurred in the Server Components render."],
  ])("a fresh load cures %s: %s", (name, message) => {
    const e = Object.assign(new Error(message), { name });
    expect(isReloadCurable(e)).toBe(true);
  });

  it.each([
    "Cannot read properties of undefined (reading 'length')",
    "x is not a function",
    "Minified React error #185",
  ])("a code defect is not: %s", (message) => {
    expect(isReloadCurable(new Error(message))).toBe(false);
  });

  it("handles nothing at all", () => {
    expect(isReloadCurable(undefined)).toBe(false);
    expect(isReloadCurable(null)).toBe(false);
  });
});

describe("claimAutoReload", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows one reload a minute, so a page that always fails can't loop", () => {
    expect(claimAutoReload()).toBe(true);
    expect(claimAutoReload()).toBe(false);
    vi.setSystemTime(new Date("2026-10-02T12:00:59Z"));
    expect(claimAutoReload()).toBe(false);
    vi.setSystemTime(new Date("2026-10-02T12:01:01Z"));
    expect(claimAutoReload()).toBe(true);
  });

  it("stays put when storage is blocked", () => {
    const real = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    try {
      expect(claimAutoReload()).toBe(false);
    } finally {
      if (real) Object.defineProperty(window, "sessionStorage", real);
    }
  });
});

describe("reportCaughtError", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records the error in PostHog with where it was caught", () => {
    const e = Object.assign(new Error("Loading chunk 9 failed."), { name: "ChunkLoadError", digest: "d1" });
    reportCaughtError("PublicDataError", e, { autoReloaded: true });
    expect(posthog.captureException).toHaveBeenCalledWith(e, {
      boundary: "PublicDataError",
      digest: "d1",
      path: expect.any(String),
      reloadCurable: true,
      autoReloaded: true,
      failedRequests: [],
    });
  });

  it("lists the build files and page data that came back wrong", () => {
    const entry = (name: string, responseStatus: number, contentType = "") => ({ name, responseStatus, contentType });
    const spy = vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      entry("https://permtracker.app/_next/static/chunks/a-1.js?dpl=x", 200, "text/javascript"),
      entry("https://permtracker.app/_next/static/chunks/b-2.js?dpl=x", 200, "text/html"),
      entry("https://permtracker.app/perm-queue?_rsc=abc", 429, "application/json"),
      entry("https://permtracker.app/images/logo.png", 404),
    ] as unknown as PerformanceEntryList);
    try {
      expect(failedRequests()).toEqual(["200 text/html /_next/static/chunks/b-2.js", "429 application/json /perm-queue"]);
    } finally {
      spy.mockRestore();
    }
  });

  it("adds nothing for an error a reload can't cure", () => {
    reportCaughtError("RouteError", new Error("x is not a function"), { sentry: false });
    expect(posthog.captureException).toHaveBeenCalledWith(expect.any(Error), expect.not.objectContaining({ failedRequests: expect.anything() }));
  });

  it("leaves Sentry alone when the caller reports there itself", async () => {
    const Sentry = await import("@sentry/nextjs");
    reportCaughtError("RouteError", new Error("x"), { sentry: false });
    await new Promise((r) => setTimeout(r, 0));
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("also reports to Sentry by default", async () => {
    const Sentry = await import("@sentry/nextjs");
    const e = new Error("y");
    reportCaughtError("GlobalError", e);
    await vi.waitFor(() => expect(Sentry.captureException).toHaveBeenCalledWith(e, expect.anything()));
  });
});
