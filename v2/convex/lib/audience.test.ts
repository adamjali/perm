import { describe, expect, it } from "vitest";

import { audienceLine, audienceOf, countAudiences, OWN_CASE_ROLE } from "./audience";

describe("audienceOf", () => {
  it("reads the onboarding buttons exactly", () => {
    expect(audienceOf("Immigration Attorney")).toBe("practice");
    expect(audienceOf("Paralegal")).toBe("practice");
    expect(audienceOf("HR Professional")).toBe("practice");
    expect(audienceOf("Employer/Petitioner")).toBe("practice");
    expect(audienceOf(OWN_CASE_ROLE)).toBe("own-case");
    expect(audienceOf("Other")).toBe("other");
  });

  it("reads a role typed in Settings by the work it names", () => {
    expect(audienceOf("Partner, immigration attorney")).toBe("practice");
    expect(audienceOf("HR")).toBe("practice");
    expect(audienceOf("Software engineer")).toBe("other");
    // "law" alone is a word in too many job titles to count.
    expect(audienceOf("Lawn care")).toBe("other");
  });

  it("calls a missing role unstated, never practice", () => {
    expect(audienceOf(undefined)).toBe("unstated");
    expect(audienceOf(null)).toBe("unstated");
    expect(audienceOf("   ")).toBe("unstated");
  });
});

describe("countAudiences and audienceLine", () => {
  it("counts every account once and names only the buckets that have one", () => {
    const counts = countAudiences(["Paralegal", OWN_CASE_ROLE, OWN_CASE_ROLE, undefined]);
    expect(counts).toEqual({ practice: 1, "own-case": 2, other: 0, unstated: 1 });
    expect(audienceLine(counts)).toBe("1 in practice, 2 own case, 1 no role");
  });
});
