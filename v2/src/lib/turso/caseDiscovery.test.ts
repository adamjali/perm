import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lookup-side replenishment: the corpus was a CLOSED set.
 *
 * The daily sweep only re-checks case numbers already in perm_case_status
 * (verified 2026-08-28: still exactly the 414,050 rows the mirror seed left,
 * with nothing adding new filings). Left alone, the pending pool drains as
 * cases decide and every month after the freeze looks emptier than it is.
 * This module is the first replenishment path: a lookup that misses our
 * table asks DOL's own batch endpoint live, shows the visitor their real
 * status instead of "not found", and records the case - after which the
 * daily sweep re-checks it forever. Every visitor grows the corpus.
 *
 * It is also a public, unauthenticated surface that proxies to a federal
 * endpoint, so the checklist applies: the shape gate runs before anything
 * (normaliseLookupCaseNumber refuses junk for free), and a GLOBAL daily
 * budget caps what the whole world can make us send DOL - a per-IP limit
 * cannot stop identity rotation, a cap on the shared resource can.
 */

const execMock = vi.fn();
const oneMock = vi.fn();
vi.mock("./client", () => ({
  exec: (...a: unknown[]) => execMock(...a),
  one: (...a: unknown[]) => oneMock(...a),
  rows: vi.fn(),
}));

import {
  DAILY_DISCOVERY_CAP,
  FINAL_STATUSES,
  discoverCase,
  fetchDolCase,
} from "./caseDiscovery";

const DOL_HIT = {
  value: [
    {
      caseNumber: "G-100-26125-868956",
      caseStatus: "Analyst Review",
      employerName: "ACME ROBOTICS LLC",
      jobTitle: "Software Developer",
      submittedDate: "2026-05-05",
      visaType: "EB-2",
    },
  ],
};

const ok = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  execMock.mockReset().mockResolvedValue(1);
  oneMock.mockReset();
});

describe("FINAL_STATUSES parity", () => {
  it("matches the Python ingest byte for byte, so is_final cannot fork", () => {
    // Two writers deciding is_final differently is the flip-flop bug the
    // mirror retirement removed; this pin keeps it removed.
    const py = readFileSync(
      join(process.cwd(), "scripts/ingest_case_status_direct.py"),
      "utf8",
    );
    const m = /FINAL_STATUSES = \{([^}]+)\}/.exec(py);
    expect(m).not.toBeNull();
    const pySet = new Set(
      [...m![1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!),
    );
    expect(new Set(FINAL_STATUSES)).toEqual(pySet);
  });
});

describe("fetchDolCase", () => {
  it("returns the record only on an exact case-number match", async () => {
    const f = vi.fn().mockImplementation(() => ok(DOL_HIT));
    const hit = await fetchDolCase("G-100-26125-868956", f as never);
    expect(hit?.employerName).toBe("ACME ROBOTICS LLC");
    // The endpoint is a SEARCH: it can return neighbours with a score. A
    // near-miss rendered as the visitor's case would be somebody else's
    // record on their screen.
    const miss = await fetchDolCase("G-100-26125-999999", f as never);
    expect(miss).toBeNull();
  });

  it("returns null on a network failure rather than throwing into the page", async () => {
    const f = vi.fn().mockRejectedValue(new Error("ETIMEDOUT"));
    expect(await fetchDolCase("G-100-26125-868956", f as never)).toBeNull();
  });
});

describe("discoverCase", () => {
  it("records a hit with is_final derived the ingest's way, and filing date from the number", async () => {
    oneMock.mockResolvedValue({ n: 3 }); // budget counter well under cap
    const f = vi.fn().mockImplementation(() => ok(DOL_HIT));
    const got = await discoverCase("G-100-26125-868956", f as never);

    expect(got).not.toBeNull();
    expect(got?.status).toBe("Analyst Review");
    // G-100-26125: year 2026, day 125 -> 2026-05-05.
    expect(got?.filingDate).toBe("2026-05-05");

    const insert = execMock.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT OR IGNORE INTO perm_case_status"),
    );
    expect(insert).toBeDefined();
    const args = insert![1] as unknown[];
    expect(args[0]).toBe("G-100-26125-868956");
    expect(args[3]).toBe(0); // ANALYST REVIEW is not final

    // The searchable half of the promise: a case discovered by NUMBER is
    // findable by EMPLOYER immediately, via the slugged remainder table.
    const liveInsert = execMock.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT OR IGNORE INTO perm_live_recent"),
    );
    expect(liveInsert).toBeDefined();
    const liveArgs = liveInsert![1] as unknown[];
    expect(liveArgs[0]).toBe("G-100-26125-868956");
    expect(liveArgs[5]).toBe("acme-robotics-llc"); // slugified for the needle
  });

  it("marks a decided status final", async () => {
    oneMock.mockResolvedValue({ n: 3 });
    const f = vi.fn().mockImplementation(() =>
      ok({ value: [{ ...DOL_HIT.value[0], caseStatus: "Certified" }] }),
    );
    await discoverCase("G-100-26125-868956", f as never);
    const insert = execMock.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT OR IGNORE INTO perm_case_status"),
    );
    expect((insert![1] as unknown[])[3]).toBe(1);
  });

  it("never calls DOL once the daily budget is spent", async () => {
    oneMock.mockResolvedValue({ n: DAILY_DISCOVERY_CAP });
    const f = vi.fn();
    expect(await discoverCase("G-100-26125-868956", f as never)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("returns null and writes nothing when DOL has no such case", async () => {
    oneMock.mockResolvedValue({ n: 3 });
    const f = vi.fn().mockImplementation(() => ok({ value: [] }));
    expect(await discoverCase("G-100-26125-868956", f as never)).toBeNull();
    const insert = execMock.mock.calls.find(([sql]) =>
      String(sql).includes("perm_case_status"),
    );
    expect(insert).toBeUndefined();
  });
});


describe("discoverCase refuses non-PERM prefixes", () => {
  it("does not ask DOL, spend budget, or write for a P- (wage request) number", async () => {
    const f = vi.fn();
    const r = await discoverCase(
      "P-100-26240-200135",
      f as unknown as typeof fetch,
      new Date("2026-09-02T12:00:00Z"),
    );
    expect(r).toBeNull();
    expect(f).not.toHaveBeenCalled();
    expect(execMock).not.toHaveBeenCalled();
  });

  it("nor for an H-1B LCA (I-) number", async () => {
    const f = vi.fn();
    expect(await discoverCase("I-200-26155-983861", f as unknown as typeof fetch)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
