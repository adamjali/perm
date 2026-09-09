import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { GET } = await import("../route");
const { GET: AREAS } = await import("../../wage-areas/route");

const DOL = {
  rates: {
    I: { year: "102357.00", hour: "49.21" },
    II: { year: "126942.00", hour: "61.03" },
    III: { year: "151549.00", hour: "72.86" },
    IV: { year: "176134.00", hour: "84.68" },
  },
};

function get(path: string): Request {
  return new Request(`https://permtracker.app${path}`);
}

describe("GET /api/wage-levels", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("refuses malformed inputs before asking DOL", async () => {
    for (const qs of ["", "soc=15-1252", "soc=15-1252&area=31080", "soc=x&area=31080&year=2026", "soc=15-1252&area=abc&year=2026", "soc=15-1252&area=31080&year=1999"]) {
      const res = await GET(get(`/api/wage-levels?${qs}`));
      expect(res.status, qs).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts DOL's own body shape and returns the four levels, cached a day", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(DOL), { status: 200 }));
    const res = await GET(get("/api/wage-levels?soc=15-1252.00&area=31080&year=2026"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { levels: { level: string; yearly: number }[]; soc: string; seriesYear: number };
    expect(body.soc).toBe("15-1252");
    expect(body.levels.map((l) => l.level)).toEqual(["I", "II", "III", "IV"]);
    expect(body.levels[3]?.yearly).toBe(176134);
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=86400");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://flag.dol.gov/recaptcha/wageSearch");
    expect(JSON.parse(String(init.body))).toEqual({ collectionType: "alc", year: 2026, socCode: "15-1252", area: 31080, areaType: "bls_area", rdFlag: "BOTH" });
  });

  it("reports an all-zero answer as no data rather than as a wage", async () => {
    const zero = { hour: "0.00", year: "0.00" };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ rates: { I: zero, II: zero, III: zero, IV: zero } }), { status: 200 }));
    const res = await GET(get("/api/wage-levels?soc=15-1252&area=99999&year=2026"));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { levels: unknown }).levels).toBeNull();
  });

  it("passes a DOL failure through as 502, uncached", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const res = await GET(get("/api/wage-levels?soc=15-1252&area=31080&year=2026"));
    expect(res.status).toBe(502);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("GET /api/wage-areas", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("refuses a bad state and narrows DOL's list", async () => {
    expect((await AREAS(get("/api/wage-areas?state=ca&year=2026"))).status).toBe(400);
    expect((await AREAS(get("/api/wage-areas?state=CALIFORNIA"))).status).toBe(400);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ areaOptions: [{ value: 31080, label: "Los Angeles-Long Beach-Anaheim, CA" }, { value: "x" }] }), { status: 200 }));
    const res = await AREAS(get("/api/wage-areas?state=CALIFORNIA&year=2026"));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { areas: unknown[] }).areas).toEqual([{ value: 31080, label: "Los Angeles-Long Beach-Anaheim, CA" }]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://flag.dol.gov/flag/api/getAreaOptions?state=CALIFORNIA&year=2026");
  });
});
