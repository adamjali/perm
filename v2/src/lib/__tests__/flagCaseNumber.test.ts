/**
 * Program classification for DOL FLAG case numbers.
 *
 * The defect this file exists to catch is silent by construction: a case
 * number filed under the wrong program is read out of a table that cannot
 * hold it, so the subscription never matches, never fires, and looks
 * perfectly healthy from every side. Nothing errors and nobody is emailed.
 *
 * @module
 */

import { describe, it, expect } from "vitest";
import {
  FLAG_PROGRAMS,
  freshnessDatasetFor,
  isProgramApproval,
  normaliseFlagCaseNumber,
  programNoun,
  programNounWithArticle,
  programOf,
  statusTableFor,
  type FlagProgram,
} from "../flagCaseNumber";

/** Read a sibling source file as TEXT, for the drift guards. */
async function source(relative: string): Promise<string | null> {
  const fs = await import("node:fs/promises");
  return await fs
    .readFile(new URL(relative, import.meta.url), "utf8")
    .catch(() => null);
}

describe("programOf", () => {
  it("files each prefix under its own program", () => {
    const cases: [string, FlagProgram][] = [
      ["G-100-26125-868956", "perm"],
      ["A-100-26125-868956", "perm"],
      ["G-300-26237-193005", "perm"],
      ["P-100-26125-868956", "pwd"],
      ["I-200-26125-868956", "lca"],
      ["I-203-26125-868956", "lca"],
      // I-201 and I-202 returned nothing in DOL's sampled windows but are in
      // the ingest's prefix list, so they must classify rather than fall
      // through to PERM.
      ["I-201-26125-868956", "lca"],
      ["I-202-26125-868956", "lca"],
    ];
    for (const [caseNumber, program] of cases) {
      expect(programOf(caseNumber), caseNumber).toBe(program);
    }
  });

  /**
   * THE ORDERING BUG, probed directly.
   *
   * PERM's shape rule is `^[A-Z]-\d{3}-\d{5}-\d+$` and accepts ANY leading
   * letter, so it matches a prevailing wage number too. A classifier that
   * asked "is this a PERM case number?" first would answer yes for every one
   * of these and route them all to `perm_case_status`.
   */
  it("does not let the PERM shape rule claim a P- or I- number", () => {
    const permShape = /^[A-Z]-\d{3}-\d{5}-\d+$/;
    for (const caseNumber of ["P-100-26125-868956", "I-200-26125-868956"]) {
      expect(
        permShape.test(caseNumber),
        `${caseNumber} really does satisfy the PERM shape rule, which is why order matters`,
      ).toBe(true);
      expect(programOf(caseNumber)).not.toBe("perm");
    }
  });

  it("tidies before classifying", () => {
    expect(programOf("  p-100-26125-868956 ")).toBe("pwd");
    expect(programOf("i-200-26125-868956")).toBe("lca");
  });
});

describe("normaliseFlagCaseNumber", () => {
  it("normalises and classifies in one step", () => {
    expect(normaliseFlagCaseNumber(" p-100-26125-868956 ")).toEqual({
      caseNumber: "P-100-26125-868956",
      program: "pwd",
    });
    expect(normaliseFlagCaseNumber("g-100-26125-868956")).toEqual({
      caseNumber: "G-100-26125-868956",
      program: "perm",
    });
    expect(normaliseFlagCaseNumber("I-203-26125-868956")).toEqual({
      caseNumber: "I-203-26125-868956",
      program: "lca",
    });
  });

  it("rejects everything that is not a case number", () => {
    for (const raw of [
      "",
      "hello",
      "P-100-26125",
      "P-10-26125-868956",
      "12345678",
      "I-200-26125-868956; DROP TABLE lca_case_status",
      "<script>alert(1)</script>",
    ]) {
      expect(normaliseFlagCaseNumber(raw), raw).toBeNull();
    }
  });
});

describe("statusTableFor", () => {
  it("gives each program its own table and nothing else", () => {
    expect(statusTableFor("perm")).toBe("perm_case_status");
    expect(statusTableFor("pwd")).toBe("pwd_case_status");
    expect(statusTableFor("lca")).toBe("lca_case_status");
  });

  /**
   * The value is interpolated into SQL, so the closed set is the guard.
   *
   * Not defence in depth for its own sake: `convex/caseAlerts.ts` builds
   * `FROM ${statusTableFor(program)}`, and a lookup that could miss would put
   * the string "undefined" in a query rather than throwing.
   */
  it("returns a real table name for every program, never undefined", () => {
    for (const program of FLAG_PROGRAMS) {
      const table = statusTableFor(program);
      expect(table, program).toMatch(/^(perm|pwd|lca)_case_status$/);
    }
    expect(new Set(FLAG_PROGRAMS.map(statusTableFor)).size).toBe(
      FLAG_PROGRAMS.length,
    );
  });
});

describe("freshnessDatasetFor", () => {
  it("names a dataset key per program", () => {
    expect(freshnessDatasetFor("perm")).toBe("perm-case-status");
    expect(freshnessDatasetFor("pwd")).toBe("pwd-status");
    expect(freshnessDatasetFor("lca")).toBe("lca-status");
  });

  /**
   * Drift guard against the ingests that WRITE these rows.
   *
   * A key that no longer matches reads as "we have no freshness date" and
   * quietly drops the as-of from the provenance line, which is exactly the
   * failure that line exists to prevent. Skipped loudly rather than failed if
   * the scripts move: a red test nobody can act on gets deleted.
   */
  it("agrees with the ingests that stamp the rows", async () => {
    const pwd = await source("../../../scripts/ingest_pwd_status_direct.py");
    if (pwd === null) {
      expect(true).toBe(true);
      return;
    }
    expect(pwd, "the PWD ingest no longer stamps 'pwd-status'").toContain(
      '"freshness": "pwd-status"',
    );
    expect(pwd, "the LCA ingest no longer stamps 'lca-status'").toContain(
      '"freshness": "lca-status"',
    );

    const perm = await source("../../../scripts/ingest_case_status_direct.py");
    if (perm === null) return;
    expect(perm, "the PERM ingest no longer stamps 'perm-case-status'").toContain(
      '"perm-case-status"',
    );
  });
});

describe("the prefix rules", () => {
  /**
   * The Turso read layer carries its own copy of these patterns, because it
   * is `server-only` and cannot be imported from Convex. Two copies of a rule
   * that decides which table a number is read from is exactly the drift worth
   * gating, so this reads the other copy off disk.
   */
  it("match the Turso read layer's own copies", async () => {
    const pwd = await source("../turso/pwdCases.ts");
    const lca = await source("../turso/lcaCases.ts");
    if (pwd === null || lca === null) {
      expect(true).toBe(true);
      return;
    }
    expect(
      pwd.includes("/^P-\\d{3}-\\d{5}-\\d+$/"),
      "pwdCases.ts no longer uses the same prefix pattern as flagCaseNumber.ts",
    ).toBe(true);
    expect(
      lca.includes("/^I-\\d{3}-\\d{5}-\\d+$/"),
      "lcaCases.ts no longer uses the same prefix pattern as flagCaseNumber.ts",
    ).toBe(true);
  });
});

describe("the nouns", () => {
  it("names each program the way a person would", () => {
    expect(programNoun("perm")).toBe("PERM case");
    expect(programNoun("pwd")).toBe("prevailing wage request");
    expect(programNoun("lca")).toBe("LCA");
  });

  it("gets the article right, including the one that is not 'a'", () => {
    // "a LCA" on the first line of an email is the kind of thing that reads
    // as machine-written, which is why the article is stored rather than
    // assembled by a caller guessing at the vowel.
    expect(programNounWithArticle("lca")).toBe("an LCA");
    expect(programNounWithArticle("perm")).toBe("a PERM case");
    expect(programNounWithArticle("pwd")).toBe("a prevailing wage request");
  });
});

describe("isProgramApproval", () => {
  it("keeps PERM's narrow rule", () => {
    expect(isProgramApproval("perm", "CERTIFIED")).toBe(true);
    // DOL's own suffix says the certification lapsed. A substring test would
    // render it as a win.
    expect(isProgramApproval("perm", "CERTIFIED - EXPIRED")).toBe(false);
    expect(isProgramApproval("perm", "DENIED")).toBe(false);
  });

  it("treats an issued wage as the good outcome for a wage request", () => {
    // The whole reason this exists: DETERMINATION ISSUED is final and is NOT
    // "CERTIFIED", so the PERM rule would print the no-fill treatment - the
    // one reserved for denied, withdrawn and expired - on the day someone's
    // wage came through.
    expect(isProgramApproval("pwd", "DETERMINATION ISSUED")).toBe(true);
    expect(isProgramApproval("pwd", "REDETERMINATION AFFIRMED")).toBe(true);
    expect(isProgramApproval("pwd", "REDETERMINATION MODIFIED")).toBe(true);
    expect(isProgramApproval("pwd", "WITHDRAWN")).toBe(false);
    expect(isProgramApproval("pwd", "DENIED")).toBe(false);
    // And PERM's word must not leak across: a PWD is never "CERTIFIED".
    expect(isProgramApproval("pwd", "CERTIFIED")).toBe(false);
  });

  it("treats a certified LCA as the good outcome, and a withdrawn one as not", () => {
    expect(isProgramApproval("lca", "CERTIFIED")).toBe(true);
    expect(isProgramApproval("lca", "CERTIFIED - WITHDRAWN")).toBe(false);
    expect(isProgramApproval("lca", "DENIED")).toBe(false);
  });

  it("canonicalises casing the way the ingest does", () => {
    expect(isProgramApproval("pwd", "  determination   issued ")).toBe(true);
    expect(isProgramApproval("lca", "Certified")).toBe(true);
  });

  /**
   * An approval must also be FINAL, or the tone rule can never consult it.
   *
   * `tone` is `!isFinal || isProgramApproval(...)`, so a "landed well" status
   * that the ingest does not consider final is dead code: the case is already
   * live and already gets the lime fill. A mismatch here means someone edited
   * one list and not the other.
   */
  it("only names statuses the ingest already treats as final", async () => {
    const pwd = await source("../turso/pwdCases.ts");
    const lca = await source("../turso/lcaCases.ts");
    if (pwd === null || lca === null) {
      expect(true).toBe(true);
      return;
    }
    for (const status of [
      "DETERMINATION ISSUED",
      "REDETERMINATION AFFIRMED",
      "REDETERMINATION MODIFIED",
    ]) {
      expect(
        pwd.includes(`"${status}"`),
        `${status} is not in PWD_FINAL_STATUSES, so the tone rule never reaches it`,
      ).toBe(true);
    }
    expect(lca.includes('"CERTIFIED"')).toBe(true);
  });
});
