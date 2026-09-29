import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmployerFollow } from "../EmployerFollow";
import type { EmployerMove } from "@/lib/employerStages";

/**
 * The follow panel must say WHY it has nothing to show. Before Sep 29 2026 a
 * stale census rendered "Nothing employer-wide in this site's record", a
 * false statement, and an employer under the census's five-case floor got no
 * sentence at all.
 */

const move = (i: number): EmployerMove => ({
  key: `2026-09-${String(10 + i).padStart(2, "0")}|hold-on|APPLICATION ON HOLD`,
  date: `2026-09-${String(10 + i).padStart(2, "0")}`,
  slug: "acme",
  name: "ACME",
  sentence: `DOL put ${i + 5} of its cases on hold.`,
  tone: "neutral",
  n: i + 5,
});

const base = { slug: "acme", name: "ACME", logFrom: "2026-08-27", asOf: "2026-09-28" };

describe("EmployerFollow", () => {
  it("says the census is unavailable instead of claiming nothing happened", () => {
    render(<EmployerFollow {...base} row={null} moves={[]} docMissing />);
    expect(screen.getByText(/couldn.t be read or is more than eight days old/)).toBeTruthy();
    expect(screen.getByText(/can.t say whether DOL has moved its cases/)).toBeTruthy();
    expect(screen.queryByText(/Nothing employer-wide/)).toBeNull();
  });

  it("says an employer is under the census floor rather than drawing nothing", () => {
    render(<EmployerFollow {...base} row={null} moves={[]} />);
    expect(screen.getByText(/Fewer than five of its PERM cases are pending/)).toBeTruthy();
    expect(screen.getByText(/Nothing employer-wide since this site.s record began/)).toBeTruthy();
  });

  it("keeps every earlier move reachable behind a show-more", () => {
    const moves = Array.from({ length: 9 }, (_, i) => move(i));
    render(<EmployerFollow {...base} row={null} moves={moves} />);
    expect(screen.getByText("Show the 3 earlier moves")).toBeTruthy();
    for (const m of moves) expect(screen.getByText(m.sentence)).toBeTruthy();
  });
});
