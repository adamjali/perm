import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { allStatusMeanings } from "../permStatus";
import {
  dictionaryAnchors,
  LCA_STATUSES,
  permStatusGroups,
  PWD_STATUSES,
  SEASONAL_STATUSES,
  statusAnchor,
} from "../statusDictionary";

/** One status set of a program in the Python ingest's PROGRAMS dict. */
function pythonSet(program: string, which: "final" | "pending"): Set<string> {
  const src = readFileSync(join(process.cwd(), "scripts/ingest_pwd_status_direct.py"), "utf8");
  const start = src.indexOf(`"${program}": {`);
  expect(start).toBeGreaterThan(-1);
  const block = new RegExp(`"${which}": \\{([\\s\\S]*?)\\}`).exec(src.slice(start));
  expect(block).not.toBeNull();
  return new Set([...block![1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!));
}

describe("statusDictionary", () => {
  it("makes one anchor per status word and keeps them unique across programs", () => {
    const anchors = dictionaryAnchors().map((a) => a.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
    expect(statusAnchor("CERTIFIED - EXPIRED")).toBe("certified-expired");
    // PWD and LCA share words with PERM ("IN PROCESS", "WITHDRAWN"), so their
    // anchors carry the program.
    expect(anchors).toContain("pwd-in-process");
    expect(anchors).toContain("lca-in-process");
  });

  it("groups every PERM status the case page can decode, and nothing else", () => {
    const grouped = permStatusGroups().flatMap((g) => g.entries.map((e) => e.status));
    expect(grouped.sort()).toEqual(allStatusMeanings().map((m) => m.status).sort());
  });

  it("gives every FLAG entry exactly one of a citation or an admission that none exists", () => {
    for (const e of [...PWD_STATUSES, ...LCA_STATUSES, ...SEASONAL_STATUSES]) {
      const sourced = e.cite !== undefined;
      const admitted = e.unsourced !== undefined;
      expect(sourced !== admitted, `${e.status}: cite=${sourced} unsourced=${admitted}`).toBe(true);
      if (e.cite) expect(e.cite.href).toMatch(/^https:\/\/www\.ecfr\.gov\/current\/title-20\//);
    }
  });

  it("covers every wage-request status the read layer documents", () => {
    const documented = [
      "IN PROCESS",
      "RFI ISSUED",
      "DETERMINATION ISSUED",
      "PENDING REDETERMINATION",
      "REDETERMINATION AFFIRMED",
      "REDETERMINATION MODIFIED",
      "PENDING CENTER DIRECTOR REVIEW",
      "CENTER DIRECTOR REVIEW AFFIRMED DETERMINATION",
      "CENTER DIRECTOR REVIEW MODIFIED DETERMINATION",
      "RETURNED UNPROCESSED",
      "WITHDRAWN",
    ];
    expect(PWD_STATUSES.map((e) => e.status)).toEqual(documented);
    expect(LCA_STATUSES.map((e) => e.status)).toEqual(["IN PROCESS", "CERTIFIED", "CERTIFIED - WITHDRAWN", "WITHDRAWN", "DENIED"]);
  });

  it("files every H-2A and H-2B entry under the same pending or decided call the ingest makes", () => {
    const final = pythonSet("seasonal", "final");
    const pending = pythonSet("seasonal", "pending");
    expect(final.size).toBeGreaterThan(10);
    expect(pending.size).toBeGreaterThan(5);
    for (const e of SEASONAL_STATUSES) {
      const u = e.status.toUpperCase();
      // The ingest upper-cases before it looks a status up, and so does this.
      expect(final.has(u) || pending.has(u), `${e.status} is in neither of the ingest's sets`).toBe(true);
      expect(e.pending, `${e.status}: dictionary says pending=${e.pending}`).toBe(!final.has(u));
    }
    expect(dictionaryAnchors().filter((a) => a.program === "seasonal")).toHaveLength(SEASONAL_STATUSES.length);
  });
});
