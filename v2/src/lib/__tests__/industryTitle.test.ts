import { describe, expect, it } from "vitest";
import { industryName, industryTitle } from "@/lib/industryTitle";

describe("industryTitle", () => {
  it("names the industry and its code when they fit", () => {
    // The page Google showed 226 times with no click while its title read
    // "PERM in Offices of Mental Health Practitioners (except Physi" (Oct 2026).
    const t = industryTitle("Offices of Mental Health Practitioners (except Physicians)", "621330");
    expect(t).toBe("PERM in Offices of Mental Health Practitioners, NAICS 621330");
    expect(t.length).toBeLessThanOrEqual(60);
  });

  it("puts the code first when the name is too long, and never cuts a word", () => {
    const label =
      "Instruments and Related Products Manufacturing for Measuring, Displaying, and Controlling Industrial Process Variables";
    const t = industryTitle(label, "334513");
    expect(t.startsWith("NAICS 334513 PERM Filings: ")).toBe(true);
    expect(t.endsWith("Industrial Process Variables")).toBe(true);
  });

  it("keeps every word of the name, whatever its length", () => {
    for (const [label, code] of [
      ["Software Publishers", "513210"],
      ["Engineering Services", "541330"],
      ["Media Streaming Distribution Services, Social Networks, and Other Media Networks and Content Providers", "516210"],
    ] as const) {
      expect(industryTitle(label, code)).toContain(label);
      expect(industryTitle(label, code)).toContain(code);
    }
  });
});

describe("industryName", () => {
  it("drops a parenthetical and leaves the rest", () => {
    expect(industryName("Computing Infrastructure Providers (group 518)")).toBe("Computing Infrastructure Providers");
    expect(industryName("Software Publishers")).toBe("Software Publishers");
  });

  it("keeps a name that is nothing but a parenthetical", () => {
    expect(industryName("(unknown)")).toBe("(unknown)");
  });
});
