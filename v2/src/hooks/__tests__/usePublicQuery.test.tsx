import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { usePublicQuery } from "../usePublicQuery";

/**
 * The hook a public page uses to read a JSON route. The behaviour that matters
 * is the failure surface, not the happy path: a request that hangs or errors
 * must end in `failed: true`, never an eternal `undefined`, because the caller
 * renders `undefined` as "Checking..." with no end - the reported bug.
 *
 * The mock fetch mirrors the real contract in the one way that matters here:
 * when its signal aborts, it rejects with the signal's REASON. That is what
 * lets the hook tell a supersede abort (AbortError, ignore) from a deadline
 * (TimeoutError, a real failure) - so the mock must carry the reason through
 * rather than inventing its own.
 */

function mockFetch(
  impl: (url: string, init: { signal: AbortSignal }) => Promise<Response>,
) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

/** A fetch that never resolves on its own, only rejecting when aborted. */
function hangingFetch() {
  mockFetch(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(init.signal.reason),
        );
      }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usePublicQuery", () => {
  it("returns data on a 200 and never marks it failed", async () => {
    mockFetch(async () =>
      new Response(JSON.stringify({ hi: 1 }), { status: 200 }),
    );
    const { result } = renderHook(() => usePublicQuery<{ hi: number }>("/x"));
    await waitFor(() => expect(result.current.data).toEqual({ hi: 1 }));
    expect(result.current.failed).toBe(false);
  });

  it("marks failed on an HTTP error status", async () => {
    mockFetch(async () => new Response("nope", { status: 500 }));
    const { result } = renderHook(() => usePublicQuery("/x"));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("marks failed when the request hangs past the deadline", async () => {
    // The regression. Without a deadline this stays undefined forever.
    hangingFetch();
    const { result } = renderHook(() =>
      usePublicQuery("/x", { timeoutMs: 40 }),
    );
    expect(result.current.failed).toBe(false); // in flight first
    await waitFor(() => expect(result.current.failed).toBe(true), {
      timeout: 500,
    });
  });

  it("does NOT mark failed when superseded by a new url", async () => {
    // The abort from a url change must never read as a failure - otherwise an
    // error flashes on every keystroke of a search box.
    hangingFetch();
    const { result, rerender } = renderHook(
      ({ url }) => usePublicQuery<{ n: number }>(url),
      { initialProps: { url: "/a" } },
    );
    // Swap the url while /a is still hanging; then let /b resolve.
    mockFetch(async () =>
      new Response(JSON.stringify({ n: 2 }), { status: 200 }),
    );
    rerender({ url: "/b" });
    await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
    expect(result.current.failed).toBe(false);
  });

  it("does not fetch at all when the url is 'skip'", () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    const { result } = renderHook(() => usePublicQuery("skip"));
    expect(spy).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
    expect(result.current.failed).toBe(false);
  });
});
