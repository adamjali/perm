import { describe, it, expect } from "vitest";
import {
  validateStringLength,
  validateInputLengths,
  INPUT_LIMITS,
} from "../validation";

describe("validateStringLength", () => {
  it("passes for strings under the limit", () => {
    expect(() => validateStringLength("hello", "name", 100)).not.toThrow();
  });

  it("passes for strings at exactly the limit", () => {
    const value = "a".repeat(100);
    expect(() => validateStringLength(value, "name", 100)).not.toThrow();
  });

  it("throws for strings over the limit", () => {
    const value = "a".repeat(101);
    expect(() => validateStringLength(value, "name", 100)).toThrow(
      "name exceeds maximum length of 100 characters"
    );
  });

  it("silently passes for undefined", () => {
    expect(() => validateStringLength(undefined, "name", 100)).not.toThrow();
  });

  it("silently passes for null", () => {
    expect(() => validateStringLength(null, "name", 100)).not.toThrow();
  });

  it("passes for empty string", () => {
    expect(() => validateStringLength("", "name", 100)).not.toThrow();
  });

  it("formats large numbers with commas in error message", () => {
    const value = "a".repeat(10_001);
    expect(() => validateStringLength(value, "Description", 10_000)).toThrow(
      "Description exceeds maximum length of 10,000 characters"
    );
  });
});

describe("validateInputLengths", () => {
  it("passes when all fields are under limits", () => {
    expect(() =>
      validateInputLengths([
        { value: "short", name: "Name", limit: INPUT_LIMITS.SHORT },
        { value: "medium text", name: "Notes", limit: INPUT_LIMITS.MEDIUM },
        { value: undefined, name: "Optional", limit: INPUT_LIMITS.SHORT },
      ])
    ).not.toThrow();
  });

  it("throws on the first violation", () => {
    expect(() =>
      validateInputLengths([
        { value: "ok", name: "First", limit: INPUT_LIMITS.SHORT },
        { value: "a".repeat(501), name: "Second", limit: INPUT_LIMITS.SHORT },
        { value: "a".repeat(50_001), name: "Third", limit: INPUT_LIMITS.LONG },
      ])
    ).toThrow("Second exceeds maximum length of 500 characters");
  });

  it("passes with empty field list", () => {
    expect(() => validateInputLengths([])).not.toThrow();
  });
});

describe("INPUT_LIMITS", () => {
  it("has expected values", () => {
    expect(INPUT_LIMITS.SHORT).toBe(500);
    expect(INPUT_LIMITS.MEDIUM).toBe(10_000);
    expect(INPUT_LIMITS.LONG).toBe(50_000);
  });
});
