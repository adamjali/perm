import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../client", () => ({ rows: vi.fn(), one: vi.fn(), exec: vi.fn() }));

const { hydrate } = await import("../processingTimes");

describe("the stored processing-times snapshot", () => {
  it("passes a whole snapshot through", () => {
    const snap = hydrate({
      json: JSON.stringify({ permAsOf: "2026-09-22", permQueues: [{ a: 1 }], permAverageDays: [], pwdAsOf: null, pwdQueues: [], pwdPermBacklog: [], sourceUrl: "https://flag.dol.gov" }),
      fetched_at: 5,
    });
    expect(snap).toMatchObject({ permAsOf: "2026-09-22", permQueues: [{ a: 1 }], fetchedAt: 5 });
  });

  it("gives a renamed or missing list as empty instead of undefined, and says which", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const snap = hydrate({ json: JSON.stringify({ permAsOf: "2026-09-22", permQueue: [] }), fetched_at: 5 });
    expect(snap.permQueues).toEqual([]);
    expect(snap.pwdPermBacklog).toEqual([]);
    expect(String(err.mock.calls[0]?.[1])).toContain("permQueues");
    err.mockRestore();
  });
});
