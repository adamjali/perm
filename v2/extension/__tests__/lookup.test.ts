import { describe, expect, it, vi } from "vitest";

import { createController, type PanelLike } from "../src/controller";
import { CACHE_MS, createLookup, type SessionStore } from "../src/lookup";
import type { PanelModel } from "../src/model";

const meta = { source: "DOL", asOf: "2026-06-30", url: "https://permtracker.app/perm-employers/google-llc" };
const answerJson = {
  data: {
    query: "Google",
    match: "exact",
    shareFloor: 30,
    employer: {
      name: "GOOGLE LLC",
      slug: "google-llc",
      url: "https://permtracker.app/perm-employers/google-llc",
      page: "perm",
      perm: { published: 9000, certified: 8800, denied: 100, certifiedShare: 0.989, pending: 160, newestFiling: "2026-10-01", filingsLast12Months: 2100 },
      h1bLcas: 54321,
      wageRequests: null,
    },
  },
  meta,
};

function memoryStore(): SessionStore & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: async (k) => (k in data ? { [k]: data[k] } : {}),
    set: async (items) => void Object.assign(data, items),
  };
}

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("the lookup", () => {
  it("asks once with no cookies and its version, then answers from the session cache", async () => {
    const f = vi.fn(async () => ok(answerJson));
    let t = 1_000;
    const lookup = createLookup({ fetch: f as unknown as typeof fetch, store: memoryStore(), version: "1.0.0", now: () => t });
    expect((await lookup("Google")).ok).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://permtracker.app/v1/lookup/employer?name=Google");
    expect(init.credentials).toBe("omit");
    expect((init.headers as Record<string, string>)["X-PT-Extension"]).toBe("1.0.0");
    t += 60_000;
    await lookup("  google ");
    expect(f).toHaveBeenCalledTimes(1);
    t += CACHE_MS;
    await lookup("Google");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("passes the server's own words on a refusal, and caches nothing", async () => {
    const store = memoryStore();
    const lookup = createLookup({
      fetch: (async () => ok({ error: { code: "rate_limited", message: "Try again in 20 seconds." } }, 429)) as unknown as typeof fetch,
      store,
      version: "1.0.0",
    });
    expect(await lookup("Google")).toEqual({ ok: false, message: "Try again in 20 seconds." });
    expect(Object.keys(store.data)).toEqual([]);
  });

  it("refuses an answer of the wrong shape, and a network failure, plainly", async () => {
    const bad = createLookup({ fetch: (async () => ok({ data: {} })) as unknown as typeof fetch, store: memoryStore(), version: "1" });
    expect((await bad("Google")).ok).toBe(false);
    const down = createLookup({
      fetch: (async () => {
        throw new TypeError("Failed to fetch");
      }) as unknown as typeof fetch,
      store: memoryStore(),
      version: "1",
    });
    expect(await down("Google")).toEqual({ ok: false, message: expect.stringContaining("Couldn't reach PERM Tracker") });
  });
});

function fakePanel(): PanelLike & { shown: PanelModel[]; hidden: number } {
  const p = { shown: [] as PanelModel[], hidden: 0, show: (m: PanelModel) => void p.shown.push(m), hide: () => void (p.hidden += 1) };
  return p;
}

function docWith(employer: string | null): Document {
  const html = employer
    ? `<script type="application/ld+json">{"@type":"JobPosting","hiringOrganization":{"name":"${employer}"}}</script>`
    : "<p>nothing</p>";
  return new DOMParser().parseFromString(`<!doctype html><html><head>${html}</head><body></body></html>`, "text/html");
}

describe("the page controller", () => {
  const url = () => new URL("https://www.linkedin.com/jobs/view/1");

  it("looks up each new employer once on a listed site", async () => {
    let doc = docWith("Google");
    const panel = fakePanel();
    const lookup = vi.fn(async () => ({ ok: true as const, answer: answerJson as never }));
    const live = createController({ doc: () => doc, url, lookup, panel, manual: false });
    await live.check();
    await live.check();
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(panel.shown.at(-1)?.title).toBe("GOOGLE LLC");
    doc = docWith("Stripe");
    await live.check();
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup).toHaveBeenLastCalledWith("Stripe");
  });

  it("stays closed after close until the toolbar opens it", async () => {
    let doc = docWith("Google");
    const panel = fakePanel();
    const lookup = vi.fn(async () => ({ ok: true as const, answer: answerJson as never }));
    const c = createController({ doc: () => doc, url, lookup, panel, manual: false });
    await c.check();
    c.closed();
    const before = panel.shown.length;
    doc = docWith("Stripe");
    await c.check();
    expect(panel.shown.length).toBe(before);
    await c.open();
    expect(panel.shown.at(-1)?.title).toBe("GOOGLE LLC");
    expect(lookup).toHaveBeenLastCalledWith("Stripe");
  });

  it("drops a reply that arrives after the reader moved on", async () => {
    let doc = docWith("Slow Co");
    const panel = fakePanel();
    let release: (v: unknown) => void = () => undefined;
    const lookup = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (release = r)))
      .mockResolvedValueOnce({ ok: false, message: "second" });
    const c = createController({ doc: () => doc, url, lookup, panel, manual: false });
    const first = c.check();
    doc = docWith("Fast Co");
    await c.check();
    release({ ok: false, message: "first" });
    await first;
    expect(panel.shown.at(-1)?.notice).toBe("second");
  });

  it("says there's no posting when clicked on a page without one", async () => {
    const panel = fakePanel();
    const c = createController({ doc: () => docWith(null), url: () => new URL("https://example.com/"), lookup: vi.fn(), panel, manual: true });
    await c.check();
    expect(panel.shown.at(-1)?.title).toBe("No job posting here");
  });
});
