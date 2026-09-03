import { describe, expect, it } from "vitest";

import { nextSort, sortRows, type SortColumn } from "@/lib/tableSort";

interface Row {
  name: string | null;
  wage: number | null;
  decided: string | null;
}

const COLUMNS: SortColumn<Row>[] = [
  { key: "name", label: "Name", get: (r) => r.name },
  { key: "wage", label: "Wage", descFirst: true, get: (r) => r.wage },
  { key: "decided", label: "Decided", descFirst: true, get: (r) => r.decided },
];

const row = (name: string | null, wage: number | null, decided: string | null): Row => ({
  name,
  wage,
  decided,
});

describe("sortRows", () => {
  it("orders numbers ascending and descending", () => {
    const rows = [row("b", 200, null), row("a", 100, null), row("c", 300, null)];
    expect(sortRows(rows, COLUMNS, { key: "wage", dir: 1 }).map((r) => r.wage)).toEqual([100, 200, 300]);
    expect(sortRows(rows, COLUMNS, { key: "wage", dir: -1 }).map((r) => r.wage)).toEqual([300, 200, 100]);
  });

  it("orders text case-insensitively, the way a reader scans a column", () => {
    const rows = [row("banana", null, null), row("Apple", null, null), row("cherry", null, null)];
    expect(sortRows(rows, COLUMNS, { key: "name", dir: 1 }).map((r) => r.name)).toEqual([
      "Apple",
      "banana",
      "cherry",
    ]);
  });

  it("puts an unknown value LAST in both directions, never first", () => {
    // The whole point: a case with no wage is not the cheapest one, it is one
    // DOL has not published. Leading an ascending sort with it would read as a
    // measurement of zero.
    const rows = [row("a", 100, null), row("b", null, null), row("c", 300, null)];
    expect(sortRows(rows, COLUMNS, { key: "wage", dir: 1 }).map((r) => r.wage)).toEqual([100, 300, null]);
    expect(sortRows(rows, COLUMNS, { key: "wage", dir: -1 }).map((r) => r.wage)).toEqual([300, 100, null]);
  });

  it("treats an empty string as unknown too", () => {
    const rows = [row("a", null, "2026-01-01"), row("b", null, ""), row("c", null, "2025-01-01")];
    expect(sortRows(rows, COLUMNS, { key: "decided", dir: -1 }).map((r) => r.decided)).toEqual([
      "2026-01-01",
      "2025-01-01",
      "",
    ]);
  });

  it("does not mutate the input array", () => {
    const rows = [row("b", 200, null), row("a", 100, null)];
    const before = [...rows];
    sortRows(rows, COLUMNS, { key: "wage", dir: 1 });
    expect(rows).toEqual(before);
  });

  it("returns the rows untouched for an unknown column", () => {
    const rows = [row("b", 200, null), row("a", 100, null)];
    expect(sortRows(rows, COLUMNS, { key: "nope", dir: 1 })).toEqual(rows);
  });
});

describe("nextSort", () => {
  it("flips direction when the same column is clicked again", () => {
    expect(nextSort({ key: "wage", dir: -1 }, "wage", COLUMNS)).toEqual({ key: "wage", dir: 1 });
    expect(nextSort({ key: "wage", dir: 1 }, "wage", COLUMNS)).toEqual({ key: "wage", dir: -1 });
  });

  it("starts a money or date column descending, and a name ascending", () => {
    // Defaulting everything to ascending makes the first click on a date
    // column feel broken: nobody wants the oldest row first.
    expect(nextSort({ key: "name", dir: 1 }, "wage", COLUMNS)).toEqual({ key: "wage", dir: -1 });
    expect(nextSort({ key: "name", dir: 1 }, "decided", COLUMNS)).toEqual({ key: "decided", dir: -1 });
    expect(nextSort({ key: "wage", dir: -1 }, "name", COLUMNS)).toEqual({ key: "name", dir: 1 });
  });

  it("defaults an unknown column to ascending rather than throwing", () => {
    expect(nextSort({ key: "name", dir: 1 }, "mystery", COLUMNS)).toEqual({ key: "mystery", dir: 1 });
  });
});
