import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import { caseWriteErrorMessage, rateLimitRetryMs } from "../caseWriteErrors";

describe("caseWriteErrorMessage (silent-limit audit #16)", () => {
  it("names the wait when the write limit refused the save", () => {
    const err = new ConvexError({ kind: "RateLimited", name: "caseUpdate", retryAfter: 4_200 });
    expect(caseWriteErrorMessage(err, "Failed")).toBe("Too many changes in a minute. Wait 5 seconds and save again.");
  });
  it("reads the refusal out of the text when only the text survived", () => {
    const err = new Error('Uncaught ConvexError: {"kind":"RateLimited","name":"caseCreate","retryAfter":900}');
    expect(rateLimitRetryMs(err)).toBe(900);
    expect(caseWriteErrorMessage(err, "Failed")).toBe("Too many changes in a minute. Wait 1 second and save again.");
  });
  it("passes a stated reason through", () => {
    const err = new ConvexError("50 documents is the most a case can hold. Delete one to add another.");
    expect(caseWriteErrorMessage(err, "Failed")).toMatch(/50 documents is the most/);
  });
  it("keeps the fallback for anything else", () => {
    expect(caseWriteErrorMessage(new Error("boom"), "Failed to save case.")).toBe("Failed to save case.");
    expect(caseWriteErrorMessage(new ConvexError({ code: 1 }), "Failed")).toBe("Failed");
  });
});
