import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SocCode } from "@/lib/socFinder";

vi.mock("server-only", () => ({}));
const getSocCodes = vi.fn();
const titlesForCode = vi.fn();
vi.mock("../socTitles", () => ({ getSocCodes, titlesForCode }));
const codeSummaries = vi.fn();
const onetReference = vi.fn();
vi.mock("../reference", () => ({ codeSummaries, onetReference }));
const getEntityBySlug = vi.fn();
vi.mock("../publicData", () => ({ getEntityBySlug }));

const { socProfile } = await import("../socProfile");

const SWE: SocCode = { soc: "15-1252", title: "Software Developers", zone: 4, perm: 900, pwd: 100, lca: 1000, slug: "software-developers", titles: 120 };

function codesDoc(codes: SocCode[], pageMin = 50) {
  return { pageMin, codes: new Map(codes.map((c) => [c.soc, c])) };
}

const SUMMARY = {
  soc: "15-1252",
  onetCode: "15-1252.00",
  title: "Software Developers",
  description: "Research, design, and develop computer and network software.",
  tasks: ["Analyze user needs.", "Modify existing software.", "Confer with data processing staff."],
  jobZone: 4,
  zoneLabel: "4",
  zoneName: "Considerable preparation needed",
};

function row(certified: number, denied: number, medianAnnualWage: number | null = 150_000) {
  return { slug: "software-developers", name: "Software Developers", rank: 1, total: certified + denied + 5, certified, denied, medianDays: 400, medianAnnualWage, state: null, code: "15-1252.00", recent12m: 10 };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSocCodes.mockResolvedValue(codesDoc([SWE]));
  codeSummaries.mockResolvedValue(new Map([["15-1252", SUMMARY]]));
  onetReference.mockResolvedValue({ zones: {}, version: "31.0" });
  titlesForCode.mockResolvedValue({
    filed: [
      { key: "software engineer", title: "Software Engineer", filings: 1000, share: 0.9, keyFilings: 1200 },
      { key: "member of technical staff", title: "Member of Technical Staff", filings: 20, share: 0.5, keyFilings: 40 },
    ],
    onet: [],
  });
  getEntityBySlug.mockResolvedValue(row(900, 100));
});

describe("socProfile", () => {
  it("answers with O*NET's text, the filed titles and the PERM figures", async () => {
    const p = await socProfile("15-1252.00");
    expect(p).toMatchObject({
      soc: "15-1252",
      title: "Software Developers",
      description: SUMMARY.description,
      tasks: SUMMARY.tasks,
      zoneLabel: "4",
      onetVersion: "31.0",
      href: "/perm-wages/software-developers",
      figures: { decided: 1000, approvalRate: 0.9, medianWage: 150_000 },
    });
    // Each title's share is of the code's own filings, every program together (2,000 here).
    expect(p?.titles.map((t) => [t.title, t.share, t.href])).toEqual([
      ["Software Engineer", 0.5, "/soc-codes/software-engineer"],
      ["Member of Technical Staff", 0.01, null],
    ]);
    expect(getEntityBySlug).toHaveBeenCalledWith("occupation", "software-developers");
  });

  it("withholds the rate under 30 decided cases and the median under 10", async () => {
    getEntityBySlug.mockResolvedValue(row(20, 5));
    expect((await socProfile("15-1252"))?.figures).toMatchObject({ decided: 25, approvalRate: null, medianWage: 150_000 });
    getEntityBySlug.mockResolvedValue(row(6, 2));
    expect((await socProfile("15-1252"))?.figures).toMatchObject({ decided: 8, approvalRate: null, medianWage: null });
  });

  it("links a code with no occupation page to the wage-level tool and carries no figures", async () => {
    getSocCodes.mockResolvedValue(codesDoc([{ ...SWE, slug: null }]));
    const p = await socProfile("15-1252");
    expect(p?.href).toBe("/tools/wage-levels?soc=15-1252");
    expect(p?.figures).toBeNull();
    expect(getEntityBySlug).not.toHaveBeenCalled();
  });

  it("answers null for a code nothing holds, and for anything that isn't a code", async () => {
    getSocCodes.mockResolvedValue(codesDoc([]));
    codeSummaries.mockResolvedValue(new Map());
    expect(await socProfile("99-9999")).toBeNull();
    vi.clearAllMocks();
    expect(await socProfile("software")).toBeNull();
    expect(getSocCodes).not.toHaveBeenCalled();
  });

  it("throws when a read fails, so no failure reads as a job nothing holds", async () => {
    titlesForCode.mockRejectedValue(new Error("database unavailable"));
    await expect(socProfile("15-1252")).rejects.toThrow("database unavailable");
  });
});
