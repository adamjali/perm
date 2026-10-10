import { describe, expect, it } from "vitest";

import { ENDPOINTS } from "../openapi";
import { SANDBOX_CASE_NUMBERS, SANDBOX_SOURCE, sandboxAnswer, sandboxCase } from "../sandbox";
import { normaliseFlagCaseNumber } from "@/lib/flagCaseNumber";

const BASE = "https://permtracker.app/v1";

/** The route's params for an example path, read off the path template. */
function paramsFor(template: string, example: string): Record<string, string> {
  const t = template.split("/");
  const e = example.split("?")[0]!.split("/");
  const out: Record<string, string> = {};
  t.forEach((seg, i) => {
    const m = /^\{(.+)\}$/.exec(seg);
    if (m) out[m[1]!] = decodeURIComponent(e[i]!);
  });
  return out;
}

describe("the sandbox", () => {
  it("answers every keyed read the API describes, without touching anything live", () => {
    const reads = ENDPOINTS.filter((e) => !e.keyless && (e.method ?? "GET") === "GET" && e.path !== "/me" && !e.sandboxOwn);
    expect(reads.length).toBeGreaterThan(8);
    for (const e of reads) {
      const r = sandboxAnswer(new URL(`${BASE}${e.example}`), paramsFor(e.path, e.example));
      // A sample for each, or a 404 that names what the sandbox holds.
      expect(r.ok || r.status === 404, e.path).toBe(true);
    }
    // And most answer with a sample: a sandbox that 404'd every read passed
    // the line above.
    const answered = reads.filter((e) => sandboxAnswer(new URL(`${BASE}${e.example}`), paramsFor(e.path, e.example)).ok);
    expect(answered.length, "reads answered with a sample").toBeGreaterThanOrEqual(Math.ceil(reads.length / 2));
  });

  it("answers its own sample case with the sample, never a 404", () => {
    for (const n of SANDBOX_CASE_NUMBERS) {
      const r = sandboxCase(n);
      expect(r.ok, n).toBe(true);
    }
  });

  it("marks every answer as sample data", () => {
    const r = sandboxCase(SANDBOX_CASE_NUMBERS[0]!);
    expect(r.ok && r.meta.source).toBe(SANDBOX_SOURCE);
  });

  it("uses case numbers DOL never issues, so no sample is a real person's case", () => {
    for (const n of SANDBOX_CASE_NUMBERS) {
      expect(n).toMatch(/^[A-Z]-\d{3}-26000-/);
      // Still shaped like a real number, so a client's own validation passes.
      expect(normaliseFlagCaseNumber(n)?.caseNumber).toBe(n);
    }
  });

  it("names the samples when asked for any other case", () => {
    const r = sandboxCase("G-100-26045-123456");
    expect(r).toMatchObject({ ok: false, status: 404 });
    expect(r.ok ? "" : r.message).toContain(SANDBOX_CASE_NUMBERS[0]);
  });
});
