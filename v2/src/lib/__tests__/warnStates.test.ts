import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { WARN_STATE_COUNT, WARN_STATE_NAMES, warnDate, warnStateName } from "../warnStates";

const SCRIPTS = join(__dirname, "..", "..", "..", "scripts");

/** Every `"xx": {"name": "Name"` entry in a reader's registry. */
function registry(file: string): Record<string, string> {
  const src = readFileSync(join(SCRIPTS, file), "utf8");
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/"([a-z]{2})": \{"name": "([^"]+)"/g)) out[m[1]!.toUpperCase()] = m[2]!;
  return out;
}

describe("WARN states", () => {
  it("names every state the readers read, and no other", () => {
    const read = { ...registry("ingest_warn.py"), ...registry("warn_states.py") };
    // A control: a pattern that matched nothing would make the next line pass.
    expect(Object.keys(read).length).toBeGreaterThan(30);
    expect(WARN_STATE_NAMES).toEqual(read);
    expect(WARN_STATE_COUNT).toBe(48);
  });

  it("prints a month-only notice as the month, never a day", () => {
    expect(warnDate("2026-10")).toBe("Oct 2026");
    expect(warnDate("2026-10", "long")).toBe("October 2026");
    expect(warnDate("2026-10-21")).toBe("Oct 21, 2026");
    expect(warnDate("2026-10-21", "long")).toBe("October 21, 2026");
    expect(warnDate("not a date")).toBe("not a date");
  });

  it("falls back to the code for a state it doesn't know", () => {
    expect(warnStateName("IL")).toBe("Illinois");
    expect(warnStateName("ZZ")).toBe("ZZ");
  });
});
