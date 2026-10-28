import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn() }),
  usePathname: () => "/",
}));

import { isStale, POLL_MS, RefreshWhenStale, STALE_AFTER_MS } from "../refresh-when-stale";

let visibility: DocumentVisibilityState = "visible";
/** What /api/sweep-stamp answers: the sweep's finish time. */
let stamp: number | null = 1000;
const fetchStamp = vi.fn(async () => new Response(JSON.stringify({ checkedAt: stamp }), { status: 200 }));

/** Let a poll's request and its answer land. */
async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function showPage() {
  visibility = "visible";
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function hidePage() {
  visibility = "hidden";
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("RefreshWhenStale", () => {
  beforeEach(() => {
    refresh.mockReset();
    fetchStamp.mockClear();
    stamp = 1000;
    vi.stubGlobal("fetch", fetchStamp);
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T20:01:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("asks for the current page when a tab left open a week is shown again", () => {
    render(<RefreshWhenStale />);
    hidePage();
    vi.setSystemTime(new Date("2026-10-09T06:43:00Z"));
    showPage();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("leaves a page alone when the reader comes back within the window", () => {
    render(<RefreshWhenStale />);
    hidePage();
    vi.advanceTimersByTime(STALE_AFTER_MS - 60_000);
    showPage();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes once per return, not once per event", () => {
    render(<RefreshWhenStale />);
    vi.advanceTimersByTime(STALE_AFTER_MS + 1);
    showPage();
    showPage();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing while the page is hidden", () => {
    render(<RefreshWhenStale />);
    vi.advanceTimersByTime(STALE_AFTER_MS + 1);
    hidePage();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes a page restored from the back-forward cache", () => {
    render(<RefreshWhenStale />);
    vi.advanceTimersByTime(STALE_AFTER_MS + 1);
    act(() => {
      const e = new Event("pageshow") as PageTransitionEvent;
      Object.defineProperty(e, "persisted", { value: true });
      window.dispatchEvent(e);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("redraws a page left on screen once a sweep finishes after it loaded", async () => {
    render(<RefreshWhenStale />);
    await settle();
    expect(fetchStamp).toHaveBeenCalledWith("/api/sweep-stamp");
    await settle(POLL_MS);
    expect(refresh).not.toHaveBeenCalled();
    stamp = 2000;
    await settle(POLL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    await settle(POLL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("asks nothing while the page is hidden", async () => {
    render(<RefreshWhenStale />);
    await settle();
    hidePage();
    fetchStamp.mockClear();
    await settle(POLL_MS * 3);
    expect(fetchStamp).not.toHaveBeenCalled();
  });

  it("a stamp it can't read changes nothing", async () => {
    render(<RefreshWhenStale />);
    await settle();
    fetchStamp.mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });
    await settle(POLL_MS);
    stamp = null;
    fetchStamp.mockImplementation(async () => new Response(JSON.stringify({ checkedAt: stamp }), { status: 200 }));
    await settle(POLL_MS);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("judges age by the window", () => {
    expect(isStale(0, STALE_AFTER_MS)).toBe(true);
    expect(isStale(0, STALE_AFTER_MS - 1)).toBe(false);
  });
});
