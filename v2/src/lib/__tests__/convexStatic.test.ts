import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Next's unstable_cache as it behaves: a value the read resolved is kept under its key, and a read that throws keeps
 * nothing (Next's unstable-cache.ts passes only a resolved result to its cache). The test then checks what our
 * read gives it.
 */
const store = new Map<string, unknown>();
const calls: Array<{ key: string[]; options: { revalidate?: number; tags?: string[] } }> = [];
vi.mock("next/cache", () => ({
  unstable_cache: (cb: () => Promise<unknown>, key: string[], options: { revalidate?: number; tags?: string[] }) => {
    calls.push({ key, options });
    return async () => {
      const k = JSON.stringify(key);
      if (store.has(k)) return store.get(k);
      const value = await cb();
      store.set(k, value);
      return value;
    };
  },
}));

import { anyApi } from "convex/server";

import { queryStatic } from "../convexStatic";

const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const ok = (value: unknown) => reply({ status: "success", value, logLines: [] });
// Convex answers a failed query with HTTP 200 and the error in the body.
const failed = () => reply({ status: "error", errorMessage: "Could not find public function for 'reviews:listPublished'", logLines: [] });

const query = anyApi.siteReviews.listPublished as never;

/**
 * Next's data cache as it behaves for a fetch that asks for a window: it keeps any HTTP 200, Convex's error replies
 * included. That is the defect the old windowed fetch had.
 */
const dataCache = new Map<string, string>();
function withDataCache(inner: typeof fetch): typeof fetch {
  return async (input, init) => {
    const windowed = (init as { next?: { revalidate?: number } } | undefined)?.next?.revalidate !== undefined;
    if (!windowed || init?.cache === "no-store") return inner(input, init);
    const key = `${String(input)} ${String(init?.body)}`;
    const kept = dataCache.get(key);
    if (kept !== undefined) return reply(JSON.parse(kept));
    const res = await inner(input, init);
    if (res.status === 200) dataCache.set(key, await res.clone().text());
    return res;
  };
}

describe("queryStatic", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    store.clear();
    dataCache.clear();
    calls.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", withDataCache(fetchMock));
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("never keeps a failed read, so the next request asks Convex again", async () => {
    fetchMock.mockResolvedValueOnce(failed()).mockResolvedValueOnce(ok([{ id: 1 }]));
    await expect(queryStatic(query, {}, 86400)).rejects.toThrow(/Could not find public function/);
    await expect(queryStatic(query, {}, 86400)).resolves.toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a good read for the page's window, keyed by the function and its arguments", async () => {
    fetchMock.mockImplementation(async () => ok(7));
    await queryStatic(query, { slug: "a" }, 21600);
    await queryStatic(query, { slug: "a" }, 21600);
    await queryStatic(query, { slug: "b" }, 21600);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calls[0]?.key).toEqual(["convex-static", "siteReviews:listPublished", JSON.stringify({ slug: "a" })]);
    expect(calls[0]?.options.revalidate).toBe(21600);
  });

  it("asks Convex with no-store, so only the cache above it decides what's kept", async () => {
    fetchMock.mockImplementation(async () => ok(1));
    await queryStatic(query, {}, 86400);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit & { next?: unknown };
    expect(init.cache).toBe("no-store");
    expect(init.next).toBeUndefined();
  });

  it("refuses to run without a Convex address", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
    await expect(queryStatic(query, {}, 86400)).rejects.toThrow(/NEXT_PUBLIC_CONVEX_URL/);
  });
});
