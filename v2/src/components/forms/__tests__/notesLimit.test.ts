import { describe, it, expect } from "vitest";
import { NOTES_PER_CASE_MAX, notesLimitMessage } from "../notesLimit";

describe("notesLimitMessage (silent-limit audit #7)", () => {
  it("says nothing well under the cap", () => {
    expect(notesLimitMessage(0)).toBeNull();
    expect(notesLimitMessage(NOTES_PER_CASE_MAX - 11)).toBeNull();
  });
  it("counts down the last ten", () => {
    expect(notesLimitMessage(NOTES_PER_CASE_MAX - 10)).toBe("10 notes left of 200 a case can hold.");
    expect(notesLimitMessage(NOTES_PER_CASE_MAX - 1)).toBe("1 note left of 200 a case can hold.");
  });
  it("says why adding stopped, and what to do", () => {
    expect(notesLimitMessage(NOTES_PER_CASE_MAX)).toBe("200 notes is the most a case can hold. Delete one to add another.");
  });
});
