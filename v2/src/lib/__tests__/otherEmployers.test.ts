import { describe, expect, it } from "vitest";

import { DATASET_LABELS } from "../datasetCoverage";
import { otherEmployerDatasets, programsMix, programsShort } from "../otherEmployers";

const fmt = (n: number) => n.toLocaleString("en-US");
const zero = { perm: 0, lca: 0, pwd: 0, h2a: 0, h2b: 0, cw1: 0 };

describe("words for an employer with no PERM record", () => {
  it("names only the programs it files, H-1B first", () => {
    expect(programsShort({ ...zero, lca: 12, pwd: 3 })).toBe("H-1B and Wage Request");
    expect(programsShort({ ...zero, h2b: 2 })).toBe("H-2B");
    expect(programsShort({ ...zero, lca: 1, h2a: 4, cw1: 1 })).toBe("H-1B, H-2A and CW-1");
  });

  it("counts each one, singular where there is one", () => {
    expect(programsMix({ ...zero, lca: 1, pwd: 3, h2b: 1 }, fmt)).toBe("1 H-1B LCA, 3 wage requests and 1 H-2B filing");
    expect(programsMix({ ...zero, lca: 1234 }, fmt)).toBe("1,234 H-1B LCAs");
  });

  it("lists only datasets the source lines know by name", () => {
    const all = otherEmployerDatasets({ perm: 1, lca: 1, pwd: 1, h2a: 1, h2b: 1, cw1: 1 });
    expect(all.filter((d) => !(d in DATASET_LABELS))).toEqual([]);
    expect(otherEmployerDatasets({ ...zero, h2a: 2 })).toEqual(["seasonal-status", "h2a-disclosure"]);
  });
});
