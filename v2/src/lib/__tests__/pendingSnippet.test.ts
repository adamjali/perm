import { describe, expect, it } from "vitest";
import { ON_HOLD, pendingFollowOn, pendingSentence } from "@/lib/pendingSnippet";

const counts = (pending: number, hold = 0) => ({
  pending,
  stages: [
    { status: "ANALYST REVIEW", n: pending - hold },
    ...(hold > 0 ? [{ status: ON_HOLD, n: hold }] : []),
  ],
});

describe("pendingSentence", () => {
  it("leads with the waiting count and names the holds", () => {
    expect(pendingSentence("Adobe Inc.", counts(218, 216))).toBe(
      "Adobe Inc. has 218 PERM cases waiting with DOL, 216 of them on hold.",
    );
  });

  it("says all of them when every waiting case is on hold", () => {
    expect(pendingSentence("Acme", counts(1831, 1831))).toBe(
      "Acme has 1,831 PERM cases waiting with DOL, all of them on hold.",
    );
  });

  it("is singular for one case", () => {
    expect(pendingSentence("Acme", counts(1))).toBe("Acme has 1 PERM case waiting with DOL.");
    expect(pendingSentence("Acme", counts(1, 1))).toBe("Acme has 1 PERM case waiting with DOL, on hold.");
  });

  it("says nothing about holds when there are none", () => {
    expect(pendingSentence("Acme", counts(12))).toBe("Acme has 12 PERM cases waiting with DOL.");
  });

  it("returns null with nothing waiting, so the page keeps its other description", () => {
    expect(pendingSentence("Acme", counts(0))).toBeNull();
    expect(pendingSentence("Acme", null)).toBeNull();
  });
});

describe("pendingFollowOn", () => {
  it("mentions the approval rate only when the page shows one", () => {
    expect(pendingFollowOn(counts(5), true)).toBe("See where they stand, plus its approval rate, jobs and wages.");
    expect(pendingFollowOn(counts(5), false)).toBe("See where they stand, plus its jobs and wages.");
    expect(pendingFollowOn(counts(1), false)).toBe("See where it stands, plus its jobs and wages.");
  });
});
