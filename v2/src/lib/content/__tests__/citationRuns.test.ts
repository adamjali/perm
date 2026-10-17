import { describe, expect, it } from "vitest";
import { citationRuns } from "../citationRuns";

describe("citationRuns", () => {
  it("marks a section with its subsections as one run", () => {
    const runs = citationRuns("Duties: [the job] (§\u00a0656.17(f)(3))");
    expect(runs).toEqual([
      { text: "Duties: [the job] (", cite: false },
      { text: "§\u00a0656.17(f)(3)", cite: true },
      { text: ")", cite: false },
    ]);
  });

  it("leaves a list breakable between its sections", () => {
    const runs = citationRuns("(§§ 656.10(d)(4), 656.17(f)(5), (7))");
    expect(runs.filter((r) => r.cite).map((r) => r.text)).toEqual(["§§ 656.10(d)(4)"]);
  });

  it("gives back the text exactly when joined", () => {
    const text = "1. WHO (§ 656.10(b)(2))\n[Name] reviewed it. (§§\u00a0656.17(g)(1)–(2))\nNo cite here.";
    expect(citationRuns(text).map((r) => r.text).join("")).toBe(text);
  });

  it("returns the text as one plain run when there is no citation", () => {
    expect(citationRuns("Signed: ____")).toEqual([{ text: "Signed: ____", cite: false }]);
  });
});
