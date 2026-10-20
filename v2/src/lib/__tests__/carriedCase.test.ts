import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { calculatePWDExpiration } from "@/lib/perm";
import { carriedCaseFields } from "../carriedCaseFields";
import {
  afterAuthPath,
  CARRIED_KEEP_MS,
  carriedHref,
  carriedSummary,
  decodeCarried,
  encodeCarried,
  forgetCarried,
  readCarried,
  rememberCarried,
} from "../carriedCase";

const FULL = { pwd: "2026-01-15", first: "2026-02-01", last: "2026-03-10" };

describe("the dates the deadline calculator carries into the app", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });
  afterEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("round-trips through the address without anything to escape", () => {
    const enc = encodeCarried(FULL);
    expect(enc).toBe("2026-01-15_2026-02-01_2026-03-10");
    expect(encodeURIComponent(enc)).toBe(enc);
    expect(decodeCarried(enc)).toEqual(FULL);
    expect(carriedHref("/signup", FULL)).toBe("/signup?calc=2026-01-15_2026-02-01_2026-03-10");
  });

  it("keeps only what the calculator itself would accept", () => {
    expect(decodeCarried("2026-02-30")).toBeNull(); // no such day
    expect(decodeCarried("not-a-date")).toBeNull();
    expect(decodeCarried("")).toBeNull();
    expect(decodeCarried(null)).toBeNull();
    expect(decodeCarried("2026-01-15_2026-02-01_2026-03-10_2026-04-01")).toBeNull();
    expect(decodeCarried("1850-01-01")).toBeNull();
    // A last step before the first is dropped, never carried as a window.
    expect(decodeCarried("2026-01-15_2026-03-10_2026-02-01")).toEqual({ pwd: "2026-01-15", first: "2026-03-10" });
    // A last step without a first means nothing.
    expect(decodeCarried("2026-01-15__2026-03-10")).toEqual({ pwd: "2026-01-15" });
  });

  it("reads the address before storage, and storage only while it's fresh", () => {
    const now = Date.parse("2026-10-19T12:00:00Z");
    rememberCarried({ pwd: "2026-01-15" }, now);
    expect(readCarried("", now)).toEqual({ pwd: "2026-01-15" });
    expect(readCarried("?calc=2026-02-02", now)).toEqual({ pwd: "2026-02-02" });
    expect(readCarried("", now + CARRIED_KEEP_MS + 1)).toBeNull();
    expect(readCarried("?calc=junk", now)).toEqual({ pwd: "2026-01-15" });
  });

  it("forgets the dates in storage and in the address", () => {
    rememberCarried(FULL);
    window.history.replaceState(null, "", "/dashboard?calc=2026-01-15&tab=1#x");
    forgetCarried();
    expect(window.localStorage.getItem("pt:calculator-case")).toBeNull();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/dashboard?tab=1#x");
    expect(readCarried()).toBeNull();
  });

  it("fills the case from the central wage rule and keeps the recruitment steps as a note", () => {
    const fields = carriedCaseFields(FULL);
    expect(fields.pwdDeterminationDate).toBe("2026-01-15");
    expect(fields.pwdExpirationDate).toBe(calculatePWDExpiration("2026-01-15"));
    expect(fields.recruitmentNotes).toBe(
      "From the deadline calculator: first recruitment step February 1, 2026, last March 10, 2026. Enter each step's own dates under Recruitment and the filing window is worked out from them.",
    );
    // No step entered, no note: an empty note would read as something lost.
    expect("recruitmentNotes" in carriedCaseFields({ pwd: "2026-01-15" })).toBe(false);
  });

  it("sends a new account to the dashboard's setup and a returning one to the new-case form", () => {
    const q = "?calc=2026-01-15_2026-02-01";
    expect(afterAuthPath("signup", q)).toBe("/dashboard?calc=2026-01-15_2026-02-01");
    expect(afterAuthPath("login", q)).toBe("/cases/new?calc=2026-01-15_2026-02-01");
    // Without dates in the address, stored ones never redirect a sign-in.
    rememberCarried({ pwd: "2026-01-15" });
    expect(afterAuthPath("login", "")).toBe("/dashboard");
    expect(afterAuthPath("signup", "?calc=//evil.example")).toBe("/dashboard");
  });

  it("names the dates in one line", () => {
    expect(carriedSummary(FULL)).toBe("wage determination January 15, 2026, recruitment February 1, 2026 to March 10, 2026");
    expect(carriedSummary({ pwd: "2026-01-15", first: "2026-02-01" })).toBe(
      "wage determination January 15, 2026, first recruitment step February 1, 2026",
    );
  });
});
