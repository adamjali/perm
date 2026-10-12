import { beforeEach, describe, expect, it, vi } from "vitest";

const suggestNames = vi.fn();
vi.mock("@/lib/turso/nameSuggest", () => ({
  SUGGEST_KINDS: ["employer", "attorney", "occupation"],
  SUGGEST_MIN_LENGTH: 2,
  SUGGEST_MAX_LENGTH: 80,
  suggestNames: (...a: unknown[]) => suggestNames(...a),
}));

import { GET } from "../route";

const s = (kind: string, name: string, score: number, cases = 10) => ({
  kind,
  name,
  href: `/x/${name}`,
  cases,
  score,
  published: true,
});

const get = (qs: string) => GET(new Request(`https://permtracker.app/api/suggest?${qs}`));

describe("GET /api/suggest", () => {
  beforeEach(() => {
    suggestNames.mockReset();
  });

  it("refuses an unknown kind and a query out of bounds with a 400, never an empty answer", async () => {
    expect((await get("kind=planet&q=amazon")).status).toBe(400);
    expect((await get("kind=employer&q=a")).status).toBe(400);
    expect((await get(`kind=employer&q=${"x".repeat(81)}`)).status).toBe(400);
    expect(suggestNames).not.toHaveBeenCalled();
  });

  it("answers one kind's suggestions, cacheable at the edge", async () => {
    suggestNames.mockResolvedValue([s("employer", "Amazon.com Services LLC", 0.83, 2271)]);
    const r = await get("kind=employer&q=amazn");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toContain("s-maxage=");
    const d = (await r.json()) as { suggestions: { name: string }[] };
    expect(d.suggestions.map((x) => x.name)).toEqual(["Amazon.com Services LLC"]);
    expect(suggestNames).toHaveBeenCalledWith("employer", "amazn");
  });

  it("ranks every kind together for kind=all, closest first", async () => {
    suggestNames.mockImplementation(async (kind: string) =>
      kind === "employer"
        ? [s("employer", "Fragomen Inc", 0.7)]
        : kind === "attorney"
          ? [s("attorney", "Fragomen, Del Rey, Bernsen & Loewy", 0.9)]
          : [],
    );
    const d = (await (await get("q=fragomn")).json()) as { suggestions: { kind: string }[] };
    expect(d.suggestions.map((x) => x.kind)).toEqual(["attorney", "employer"]);
  });

  it("says the names couldn't be read, as a 503, when the index fails", async () => {
    suggestNames.mockRejectedValue(new Error("database down"));
    const r = await get("kind=employer&q=amazn");
    expect(r.status).toBe(503);
  });
});
