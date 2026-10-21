import { describe, expect, it } from "vitest";
import { calculatePWDExpiration, calculateFilingWindow, pwdBearing } from "@/lib/perm";
import { DETERMINED, EXPIRES, FIRST_MAX, FIRST_MIN, VALID_DAYS, readPwdValidity } from "../model";

describe("the wage-validity figure says what the central rules say", () => {
  it("takes the expiry from the determination by the rule", () => {
    expect(EXPIRES).toBe(calculatePWDExpiration(DETERMINED));
    expect(EXPIRES).toBe("2026-07-14"); // April 2 to June 30: 90 days
    expect(VALID_DAYS).toBe(90);
  });

  it("sweeps through all three cases", () => {
    expect(readPwdValidity(FIRST_MIN).bearing).toBe("began-before");
    expect(readPwdValidity(0).bearing).toBe("began-inside");
    expect(readPwdValidity(VALID_DAYS).bearing).toBe("began-inside");
    expect(readPwdValidity(VALID_DAYS + 1).bearing).toBe("began-after");
    expect(readPwdValidity(FIRST_MAX).bearing).toBe("began-after");
  });

  it("lets a first step inside the validity run its full 180 days past the expiry", () => {
    const r = readPwdValidity(47);
    expect(r.first).toBe("2026-06-01");
    expect(r.closes).toBe("2026-11-28");
    expect(r.closes! > EXPIRES).toBe(true);
    expect(r.closeDay! - 47).toBe(180);
    expect(r.sentence).toBe("First step Jun 1, inside the validity: file by Nov 28, 2026, after it expires.");
  });

  it("stops a first step before the determination at the expiry", () => {
    const r = readPwdValidity(-20);
    const w = calculateFilingWindow({ firstRecruitmentDate: r.first, lastRecruitmentDate: "2026-04-25", pwdExpirationDate: EXPIRES })!;
    expect(r.closes).toBe(w.closes);
    expect(r.closes).toBe(EXPIRES);
    expect(r.closeDay).toBe(VALID_DAYS);
    expect(r.sentence).toBe("First step Mar 26, before the determination: file by Jul 14, 2026, the day it expires.");
  });

  it("gives no date once the determination has expired", () => {
    const r = readPwdValidity(VALID_DAYS + 5);
    expect(pwdBearing({ pwdDeterminationDate: DETERMINED, pwdExpirationDate: EXPIRES, firstPwdStep: r.first })).toBe("began-after");
    expect(r.closes).toBeNull();
    expect(r.sentence).toBe("First step Jul 19, after it expired: this determination can't be used.");
  });
});
