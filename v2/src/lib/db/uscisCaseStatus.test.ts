import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The stored-first read path over a mocked Turso client and a mocked Torch
 * client. Pins: a fresh row answers without a call; a stale row asks USCIS
 * and is replaced; a stale row survives a USCIS failure, marked stale; a
 * missing row with a USCIS failure is that failure; every live answer is
 * written; and the write moves last_change_at only on a real change.
 */

const execMock = vi.fn();
const oneMock = vi.fn();
vi.mock("./client", () => ({
  exec: (...a: unknown[]) => execMock(...a),
  one: (...a: unknown[]) => oneMock(...a),
  rows: vi.fn(),
}));
vi.mock("server-only", () => ({}));

const fetchCaseStatusMock = vi.fn();
vi.mock("@/lib/uscis/torchClient", () => ({
  fetchCaseStatus: (...a: unknown[]) => fetchCaseStatusMock(...a),
}));

import {
  FRESH_MS,
  RETENTION_MS,
  TABLE_DDL,
  lookupUscisCase,
  pruneUscisCaseStatus,
  recordStatus,
  resetEnsured,
} from "./uscisCaseStatus";

const NOW = new Date("2026-09-22T18:00:00Z");

const LIVE = {
  receipt: "EAC9999103403",
  formType: "I-140",
  statusText: "Case Was Received",
  statusDesc: "desc",
  submittedAt: "2023-09-05T14:28:46",
  modifiedAt: "2023-09-06T08:00:00",
  history: [{ date: "2023-09-05", text: "Case Was Received" }],
};

function storedRow(seenAt: number) {
  return {
    receipt: "EAC9999103403",
    form_type: "I-140",
    status_text: "Case Was Received",
    status_desc: "desc",
    submitted_at: "2023-09-05T14:28:46",
    modified_at: "2023-09-06T08:00:00",
    history_json: JSON.stringify(LIVE.history),
    // libSQL hands integers back as strings on some paths; the reader must cope.
    seen_at: String(seenAt),
    first_seen_at: String(seenAt - 1000),
    last_change_at: String(seenAt - 500),
  };
}

beforeEach(() => {
  execMock.mockReset().mockResolvedValue(1);
  oneMock.mockReset().mockResolvedValue(null);
  fetchCaseStatusMock.mockReset();
  resetEnsured();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("lookupUscisCase", () => {
  it("answers from a fresh stored row without asking USCIS", async () => {
    oneMock.mockResolvedValue(storedRow(NOW.getTime() - 60_000));
    const r = await lookupUscisCase("EAC9999103403", NOW);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.source).toBe("stored");
    expect(r.status.seenAt).toBe(NOW.getTime() - 60_000);
    expect(r.status.history).toEqual(LIVE.history);
    expect(fetchCaseStatusMock).not.toHaveBeenCalled();
    // The read is stamped so retention counts from the last lookup.
    expect(execMock.mock.calls.some(([sql]) => /UPDATE uscis_case_status SET last_read_at/.test(String(sql)))).toBe(true);
  });

  it("asks USCIS once the row is older than the freshness window and stores the answer", async () => {
    const old = storedRow(NOW.getTime() - FRESH_MS - 1);
    // First read: the stale row. After the write, the read-back: the new row.
    oneMock.mockResolvedValueOnce(old).mockResolvedValueOnce({ ...old, seen_at: String(NOW.getTime()) });
    fetchCaseStatusMock.mockResolvedValue({ kind: "ok", status: LIVE, raw: { case_status: {} } });
    const r = await lookupUscisCase("EAC9999103403", NOW);
    expect(fetchCaseStatusMock).toHaveBeenCalledTimes(1);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.source).toBe("live");
    expect(r.status.seenAt).toBe(NOW.getTime());
    const insert = execMock.mock.calls.find(([sql]) => /INSERT INTO uscis_case_status/.test(String(sql)));
    expect(insert).toBeDefined();
  });

  it("returns the stale row, marked stale with the failure named, when USCIS cannot answer", async () => {
    oneMock.mockResolvedValue(storedRow(NOW.getTime() - FRESH_MS - 1));
    fetchCaseStatusMock.mockResolvedValue({ kind: "rate_limited", where: "uscis" });
    const r = await lookupUscisCase("EAC9999103403", NOW);
    expect(r.kind).toBe("stale");
    if (r.kind !== "stale") return;
    expect(r.failure).toBe("rate_limited");
    expect(r.status.statusText).toBe("Case Was Received");
  });

  it("passes the USCIS failure through when there is nothing stored", async () => {
    fetchCaseStatusMock.mockResolvedValue({ kind: "not_found" });
    expect(await lookupUscisCase("EAC9999103403", NOW)).toEqual({ kind: "not_found" });
    fetchCaseStatusMock.mockResolvedValue({ kind: "disabled" });
    expect(await lookupUscisCase("EAC9999103403", NOW)).toEqual({ kind: "disabled" });
    expect(execMock.mock.calls.some(([sql]) => /INSERT/.test(String(sql)))).toBe(false);
  });

  it("stores a live answer even when the read-back fails, answering from what it wrote", async () => {
    oneMock.mockResolvedValue(null);
    fetchCaseStatusMock.mockResolvedValue({ kind: "ok", status: LIVE, raw: null });
    const r = await lookupUscisCase("EAC9999103403", NOW);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.status.seenAt).toBe(NOW.getTime());
    expect(r.status.firstSeenAt).toBe(NOW.getTime());
  });
});

describe("recordStatus", () => {
  it("creates the table once, then upserts with a change-detecting last_change_at", async () => {
    await recordStatus(LIVE, NOW);
    await recordStatus(LIVE, NOW);
    const ddl = execMock.mock.calls.filter(([sql]) => String(sql) === TABLE_DDL);
    expect(ddl).toHaveLength(1);
    const inserts = execMock.mock.calls.filter(([sql]) => /INSERT INTO uscis_case_status/.test(String(sql)));
    expect(inserts).toHaveLength(2);
    const [sql, args] = inserts[0] as [string, unknown[]];
    // The change rule lives in the SQL, so the test reads the SQL.
    expect(sql).toMatch(/last_change_at = CASE/);
    expect(sql).toMatch(/status_text IS NOT excluded\.status_text/);
    expect(sql).toMatch(/modified_at IS NOT excluded\.modified_at/);
    expect(args[0]).toBe("EAC9999103403");
    expect(args[6]).toBe(JSON.stringify(LIVE.history));
    expect(args).toHaveLength(11);
  });

  it("stores the columns the privacy policy names, and nothing about the reader", async () => {
    await recordStatus(LIVE, NOW);
    const insert = execMock.mock.calls.find(([sql]) => /INSERT INTO uscis_case_status/.test(String(sql)));
    const sql = String(insert?.[0]);
    for (const col of ["receipt", "form_type", "status_text", "submitted_at", "modified_at", "history_json", "seen_at"]) {
      expect(sql).toContain(col);
    }
    // The policy does not name a raw response body, so none is stored.
    expect(sql).not.toContain("raw_json");
    expect(sql).not.toMatch(/\b(ip|ip_address|user_agent|email)\b/i);
  });
});

describe("pruneUscisCaseStatus", () => {
  it("deletes rows not read inside the retention window, and only those", async () => {
    execMock.mockResolvedValue(3);
    const n = await pruneUscisCaseStatus(NOW);
    expect(n).toBe(3);
    const del = execMock.mock.calls.find(([sql]) => /DELETE FROM uscis_case_status/.test(String(sql)));
    expect(del).toBeDefined();
    const [sql, args] = del as [string, unknown[]];
    expect(sql).toMatch(/WHERE last_read_at < \?/);
    expect(args[0]).toBe(NOW.getTime() - RETENTION_MS);
    expect(RETENTION_MS).toBe(365 * 24 * 60 * 60 * 1000);
  });
});
