import { describe, expect, it } from "vitest";
import { deadlineDigestWords } from "../deadlineDigestWords";

describe("deadlineDigestWords", () => {
  it("gives one deadline a singular verb (Oct 11 2026: '1 PERM deadline need your attention')", () => {
    expect(deadlineDigestWords(1, 0)).toEqual({
      subject: "1 PERM deadline needs your attention",
      headline: "1 deadline needs your attention",
      preview: "1 PERM deadline coming up",
    });
  });
  it("gives several a plural one", () => {
    expect(deadlineDigestWords(4, 0).subject).toBe("4 PERM deadlines need your attention");
  });
  it("says a lone overdue deadline is overdue", () => {
    expect(deadlineDigestWords(1, 1).subject).toBe("1 PERM deadline is overdue");
    expect(deadlineDigestWords(3, 3).headline).toBe("3 deadlines are overdue");
  });
  it("names the overdue part of a mixed list", () => {
    expect(deadlineDigestWords(4, 1)).toEqual({
      subject: "4 PERM deadlines need attention, 1 overdue",
      headline: "4 deadlines need attention, 1 overdue",
      preview: "1 overdue of 4 PERM deadlines",
    });
  });
});
