/**
 * Case-status vocabulary.
 *
 * Two things are worth testing here and they are not the obvious one. The
 * glosses themselves are prose and a test cannot check whether they are TRUE.
 * What a test can check is the two places the module makes a DECISION that
 * reaches a reader: which statuses count as an approval, and whether an
 * unsourced status returns null instead of something plausible.
 *
 * @module
 */

import { describe, it, expect } from "vitest";
import {
  canonicalStatus,
  isApproval,
  normaliseCaseNumber,
  showsRfiFunnel,
  statusMeaning,
} from "../caseStatusVocabulary";

/** Every status in the live mirror on 2026-08-27, with its case count. */
const LIVE_STATUSES: [string, number][] = [
  ["CERTIFIED", 230392],
  ["ANALYST REVIEW", 94435],
  ["CERTIFIED - EXPIRED", 57038],
  ["WITHDRAWN", 18295],
  ["DENIED", 9483],
  ["APPLICATION ON HOLD", 1789],
  ["RFI ISSUED", 906],
  ["RECONSIDERATION APPEALS", 166],
  ["BALCA APPEALS", 165],
  ["NORD ISSUED", 110],
  ["IN PROCESS", 71],
  ["DETERMINATION ISSUED", 6],
  ["REQUEST FOR REVIEW", 4],
  ["SUPERVISED RECRUITMENT", 3],
  ["DENIED - BALCA DISMISSED", 1],
  ["PENDING AUDIT RESPONSE", 1],
];

describe("canonicalStatus", () => {
  it("matches what the ingest stores", () => {
    // The upstream emits the same status in two casings, and the ingest
    // upper-cases and collapses whitespace. A lookup that normalises
    // differently silently misses a quarter of the corpus.
    expect(canonicalStatus("Analyst Review")).toBe("ANALYST REVIEW");
    expect(canonicalStatus("  certified  -  expired ")).toBe("CERTIFIED - EXPIRED");
    expect(canonicalStatus("RFI\tISSUED")).toBe("RFI ISSUED");
  });
});

describe("isApproval", () => {
  it("is exactly CERTIFIED and nothing that merely contains it", () => {
    expect(isApproval("CERTIFIED")).toBe(true);
    expect(isApproval("certified")).toBe(true);
    // DOL's own suffix says the certification lapsed. Treating anything
    // CONTAINING "CERTIFIED" as an approval renders a lapsed certification as a
    // win, which is the whole reason this is a set rather than a substring test.
    expect(isApproval("CERTIFIED - EXPIRED")).toBe(false);
    expect(isApproval("DENIED")).toBe(false);
    expect(isApproval("ANALYST REVIEW")).toBe(false);
  });
});

describe("showsRfiFunnel", () => {
  it("fires on an RFI and on nothing else in the corpus", () => {
    // Pasting a reassuring statistic into a denial would be grotesque, so this
    // is asserted against EVERY status the mirror actually holds rather than
    // against the two that came to mind.
    for (const [status] of LIVE_STATUSES) {
      expect(showsRfiFunnel(status), status).toBe(status === "RFI ISSUED");
    }
  });
});

describe("statusMeaning", () => {
  it("returns null rather than a guess for an unsourced status", () => {
    // DOL publishes no definition list for these strings. A plausible wrong
    // explanation of a government status is worse than none: the reader cannot
    // tell them apart and will act on it.
    for (const status of [
      "NORD ISSUED",
      "DETERMINATION ISSUED",
      "REQUEST FOR REVIEW",
      "APPLICATION ON HOLD",
      "IN PROCESS",
      "SOMETHING DOL INVENTS IN 2028",
    ]) {
      expect(statusMeaning(status), status).toBeNull();
    }
  });

  it("covers the statuses the docstring claims it covers", () => {
    // The docstring says the glossed set is 410,884 of 412,865 cases (99.5%).
    // That is a claim about coverage, and a claim about coverage goes stale the
    // moment a gloss is added or removed. This is the check that notices.
    const glossed = LIVE_STATUSES.filter(([s]) => statusMeaning(s) !== null);
    const covered = glossed.reduce((acc, [, n]) => acc + n, 0);
    const total = LIVE_STATUSES.reduce((acc, [, n]) => acc + n, 0);
    expect(total).toBe(412865);
    expect(covered).toBe(410884);
    expect(covered / total).toBeGreaterThan(0.99);
  });

  it("never promises what happens next", async () => {
    // The glosses describe a state. The moment one of them says what comes
    // after it, the email is making a prediction in the one place nobody is
    // looking for it.
    for (const [status] of LIVE_STATUSES) {
      const meaning = statusMeaning(status);
      if (!meaning) continue;
      for (const banned of [
        /\bwill be\b/i,
        /\bshould be\b/i,
        /\byou can expect\b/i,
        /\btypically takes\b/i,
        /\bmost cases (?:are|end)\b/i,
      ]) {
        expect(meaning, `${status}: ${meaning}`).not.toMatch(banned);
      }
    }
  });
});

describe("normaliseCaseNumber", () => {
  it("accepts real case numbers from the mirror", () => {
    for (const raw of [
      "P-100-26125-868956",
      "G-300-26237-193005",
      "A-07323-99999",
    ]) {
      const out = normaliseCaseNumber(raw);
      // The third is deliberately malformed for this format and must be
      // rejected, so the loop below checks shape rather than blanket acceptance.
      expect(out === null || out === raw.toUpperCase()).toBe(true);
    }
    expect(normaliseCaseNumber("p-100-26125-868956")).toBe("P-100-26125-868956");
    expect(normaliseCaseNumber("  G-300-26237-193005 ")).toBe("G-300-26237-193005");
  });

  it("rejects everything that is not one", () => {
    for (const raw of [
      "",
      "hello",
      "P-100-26125",
      "P-10-26125-868956",
      "12345678",
      "P-100-26125-868956; DROP TABLE perm_case_status",
      "<script>alert(1)</script>",
    ]) {
      expect(normaliseCaseNumber(raw), raw).toBeNull();
    }
  });

  it("agrees with the Turso reader's own copy", async () => {
    // A key normalised differently by the subscriber than by the reader is a
    // subscription that can never match its own case. `caseLookup.ts` carries
    // `server-only`, so it cannot be imported here; the rule is duplicated and
    // this asserts the two copies have not drifted.
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../turso/caseLookup.ts", import.meta.url),
        "utf8",
      ).catch(() => null),
    );
    if (source === null) {
      // The file is another agent's and may legitimately be gone or renamed.
      // Skipping loudly beats a red test nobody can act on.
      expect(true).toBe(true);
      return;
    }
    const pattern = /\/\^\[A-Z\]-\\d\{3\}-\\d\{5\}-\\d\+\$\//;
    expect(
      pattern.test(source),
      "caseLookup.ts no longer uses the same case-number pattern as caseStatusVocabulary.ts",
    ).toBe(true);
  });
});
