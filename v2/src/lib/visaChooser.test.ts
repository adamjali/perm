import { describe, expect, it } from "vitest";

import { chooseCategories, type Answers } from "./visaChooser";

const base: Answers = {
  sponsor: "employer",
  job: "bachelors",
  qualification: "bachelors",
  acclaim: false,
  researcher: false,
  multinational: false,
  exceptional: false,
  nationalInterest: false,
};

const codes = (a: Partial<Answers>) => chooseCategories({ ...base, ...a }).fits.map((f) => f.code);

describe("the employer's job sets the PERM category (8 CFR 204.5(l)(4))", () => {
  it("puts a job needing an advanced degree in EB-2, with EB-3 on the same PERM as the other route", () => {
    expect(codes({ job: "advanced", qualification: "advanced" })).toEqual(["EB2", "EB3"]);
    expect(codes({ job: "advanced", qualification: "bachelors5" })).toEqual(["EB2", "EB3"]);
  });

  it("puts a bachelor's job in EB-3, and a two-year job in EB-3 as a skilled worker", () => {
    expect(codes({ job: "bachelors" })).toEqual(["EB3"]);
    expect(codes({ job: "two-years", qualification: "two-years" })).toEqual(["EB3"]);
  });

  it("puts a job needing under two years in EB-3 Other Workers, whatever degree the person holds", () => {
    expect(codes({ job: "under-two", qualification: "advanced" })).toEqual(["EW3"]);
  });

  it("names nothing when the person doesn't meet the job's own requirement, and says why", () => {
    const r = chooseCategories({ ...base, job: "advanced", qualification: "bachelors" });
    expect(r.fits).toEqual([]);
    expect(r.notes.join(" ")).toMatch(/requires more than/);
  });
});

describe("the categories that don't need a PERM", () => {
  it("offers EB-1A to anyone with sustained acclaim, even with no employer", () => {
    expect(codes({ sponsor: "self", acclaim: true })).toEqual(["EB1A"]);
    expect(chooseCategories({ ...base, sponsor: "self", acclaim: true }).fits[0]!.needsPerm).toBe(false);
  });

  it("offers EB-1B and EB-1C only through an employer", () => {
    expect(codes({ researcher: true, multinational: true })).toEqual(["EB1B", "EB1C", "EB3"]);
    expect(codes({ sponsor: "self", researcher: true, multinational: true })).toEqual([]);
  });

  it("offers the national interest waiver only with an advanced degree or exceptional ability", () => {
    expect(codes({ sponsor: "self", nationalInterest: true, qualification: "advanced" })).toEqual(["EB2NIW"]);
    expect(codes({ sponsor: "self", nationalInterest: true, exceptional: true })).toEqual(["EB2NIW"]);
    const r = chooseCategories({ ...base, sponsor: "self", nationalInterest: true });
    expect(r.fits).toEqual([]);
    expect(r.notes.join(" ")).toMatch(/advanced degree or exceptional ability/);
  });

  it("orders EB-1 first, then EB-2, then EB-3", () => {
    expect(codes({ job: "advanced", qualification: "advanced", acclaim: true, nationalInterest: true })).toEqual([
      "EB1A", "EB2", "EB2NIW", "EB3",
    ]);
  });
});

describe("routes this page doesn't cover", () => {
  it("points a family or investment route to its own rules instead of guessing", () => {
    expect(codes({ sponsor: "family" })).toEqual([]);
    expect(chooseCategories({ ...base, sponsor: "family" }).notes.join(" ")).toMatch(/family/i);
    expect(chooseCategories({ ...base, sponsor: "investment" }).notes.join(" ")).toMatch(/EB-5/);
  });

  it("tells a self-petitioner with nothing ticked which two routes exist without an employer", () => {
    const r = chooseCategories({ ...base, sponsor: "self" });
    expect(r.fits).toEqual([]);
    expect(r.notes.join(" ")).toMatch(/EB-1A and the national interest waiver/);
  });

  it("cites the regulation for every category it names", () => {
    const r = chooseCategories({ ...base, job: "advanced", qualification: "advanced", acclaim: true, researcher: true, multinational: true, nationalInterest: true });
    for (const f of r.fits) expect(f.rule, f.code).toMatch(/8 CFR 204\.5/);
  });
});
