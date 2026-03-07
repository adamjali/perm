import { describe, it, expect } from "vitest";
import { generateNoteId } from "../case-form-schema";

describe("generateNoteId", () => {
  it("returns a string starting with 'note-'", () => {
    const id = generateNoteId();
    expect(id).toMatch(/^note-/);
  });

  it("includes a timestamp component", () => {
    const before = Date.now();
    const id = generateNoteId();
    const after = Date.now();

    const parts = id.split("-");
    // Format: note-{timestamp}-{random}
    expect(parts.length).toBe(3);
    const ts = Number(parts[1]);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateNoteId()));
    expect(ids.size).toBe(100);
  });

  it("includes a random suffix", () => {
    const id = generateNoteId();
    const parts = id.split("-");
    const random = parts[2];
    expect(random.length).toBe(7);
    // Should be alphanumeric (base36)
    expect(random).toMatch(/^[a-z0-9]+$/);
  });
});
