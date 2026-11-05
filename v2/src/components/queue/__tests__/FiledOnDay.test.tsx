import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DayCase } from "@/lib/filingDay";

import { FiledOnDay } from "../FiledOnDay";

const mk = (i: number, over: Partial<DayCase> = {}): DayCase => ({
  caseNumber: `G-100-26015-${String(200000 + i).padStart(6, "0")}`,
  status: "ANALYST REVIEW",
  employer: `Employer ${i}`,
  employerSlug: null,
  jobTitle: "Software Engineer",
  final: false,
  ...over,
});

// The address as a store: router.replace writes it and every reader re-renders, as Next's does.
const nav = vi.hoisted(() => {
  let qs = "";
  const subs = new Set<() => void>();
  return {
    get: () => qs,
    set: (next: string) => {
      qs = next;
      subs.forEach((f) => f());
    },
    subs,
  };
});
vi.mock("next/navigation", async (importOriginal) => {
  const React = await import("react");
  return {
    ...(await importOriginal<object>()),
    usePathname: () => "/perm-queue/2026-01/15",
    useRouter: () => ({ replace: (u: string) => nav.set(u.split("?")[1] ?? ""), push: vi.fn(), prefetch: vi.fn() }),
    useSearchParams: () => {
      const qs = React.useSyncExternalStore(
        (cb: () => void) => {
          nav.subs.add(cb);
          return () => nav.subs.delete(cb);
        },
        nav.get,
        nav.get,
      );
      return new URLSearchParams(qs);
    },
  };
});

beforeEach(() => {
  act(() => nav.set(""));
});

const caseLinks = () => screen.queryAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/perm-case-status"));

describe("FiledOnDay", () => {
  it("lists the day's PERM cases, each linked to its live lookup", () => {
    render(<FiledOnDay perm={[mk(1), mk(2, { status: "CERTIFIED", final: true })]} pwd={[]} dayLabel="January 15, 2026" />);
    expect(caseLinks()).toHaveLength(2);
    expect(caseLinks()[0]).toHaveAttribute("href", "/perm-case-status?case=G-100-26015-200001");
    expect(screen.getByText("2 of 2 PERM cases")).toBeInTheDocument();
  });

  it("filters by status, and a second press clears it", () => {
    render(<FiledOnDay perm={[mk(1), mk(2, { status: "CERTIFIED", final: true }), mk(3)]} pwd={[]} dayLabel="January 15, 2026" />);
    const chip = within(screen.getByRole("group", { name: "Status" })).getByRole("button", { name: /Certified/ });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(caseLinks()).toHaveLength(1);
    expect(screen.getByText("1 of 3 PERM cases, Certified")).toBeInTheDocument();
    fireEvent.click(chip);
    expect(caseLinks()).toHaveLength(3);
  });

  it("filters by the employer's first letter, digits and symbols under #", () => {
    render(<FiledOnDay perm={[mk(1, { employer: "Acme" }), mk(2, { employer: "3M Company" }), mk(3, { employer: "Beta" })]} pwd={[]} dayLabel="x" />);
    fireEvent.click(screen.getByRole("button", { name: "A digit or symbol, 1 case" }));
    expect(caseLinks()).toHaveLength(1);
    expect(screen.getByText("3M Company")).toBeInTheDocument();
  });

  it("switches to the wage requests and clears the picks", () => {
    render(<FiledOnDay perm={[mk(1)]} pwd={[mk(9, { caseNumber: "P-100-26015-300000", status: "IN PROCESS" })]} dayLabel="x" />);
    fireEvent.click(within(screen.getByRole("group", { name: "Status" })).getByRole("button", { name: /Analyst Review/ }));
    fireEvent.click(screen.getByRole("button", { name: /Wage requests/ }));
    expect(caseLinks()).toHaveLength(1);
    expect(caseLinks()[0]).toHaveAttribute("href", "/perm-case-status?case=P-100-26015-300000");
    expect(screen.getByText("1 of 1 wage requests")).toBeInTheDocument();
  });

  it("pages a day longer than one page", () => {
    render(<FiledOnDay perm={Array.from({ length: 120 }, (_, i) => mk(i))} pwd={[]} dayLabel="x" />);
    expect(caseLinks()).toHaveLength(50);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(caseLinks()).toHaveLength(50);
    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    expect(caseLinks()).toHaveLength(20);
  });

  it("keeps its picks in the address, and opens from one", () => {
    act(() => nav.set("status=CERTIFIED&letter=B"));
    render(<FiledOnDay perm={[mk(1, { employer: "Acme" }), mk(2, { employer: "Beta", status: "CERTIFIED", final: true })]} pwd={[]} dayLabel="x" />);
    expect(caseLinks()).toHaveLength(1);
    expect(screen.getByText("1 of 2 PERM cases, Certified, employers under B")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Status" })).getByRole("button", { name: /Certified/ }));
    expect(nav.get()).toBe("letter=B");
  });

  it("says so when the day holds none of a kind", () => {
    render(<FiledOnDay perm={[]} pwd={[]} dayLabel="January 15, 2026" />);
    expect(screen.getByText("DOL's record holds none filed on January 15, 2026.")).toBeInTheDocument();
  });
});

describe("FiledOnDay employer links", () => {
  it("links an employer that has a page and leaves the rest as text", () => {
    render(
      <FiledOnDay
        perm={[mk(1, { employer: "Acme Corp", employerSlug: "acme-corp" }), mk(2, { employer: "No Page LLC" })]}
        pwd={[]}
        dayLabel="x"
      />,
    );
    expect(screen.getByRole("link", { name: "Acme Corp" }).getAttribute("href")).toBe("/perm-employers/acme-corp");
    expect(screen.queryByRole("link", { name: "No Page LLC" })).toBeNull();
    expect(screen.getByText("No Page LLC")).toBeTruthy();
  });
});

describe("FiledOnDay, every program and both sources", () => {
  it("searches the day by case number, employer or job, and keeps the words in the address", async () => {
    vi.useFakeTimers();
    try {
      render(<FiledOnDay perm={[mk(1, { employer: "Acme Corp" }), mk(2, { employer: "Beta LLC", jobTitle: "Data Scientist" })]} pwd={[]} dayLabel="x" />);
      fireEvent.change(screen.getByRole("searchbox", { name: /Search the day/ }), { target: { value: "data" } });
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(nav.get()).toBe("q=data");
      expect(caseLinks()).toHaveLength(1);
      expect(screen.getByText("Beta LLC")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("says what DOL's file adds, and when a case is only in the file or the file dates it otherwise", () => {
    render(
      <FiledOnDay
        perm={[
          mk(1, { employer: "Acme Corp", source: "both", decided: "2026-05-01", state: "CA", wage: "$145,000 per year", fileDate: "2026-01-14" }),
          mk(2, { employer: "Beta LLC", source: "file", final: true, status: "CERTIFIED" }),
        ]}
        pwd={[]}
        dayLabel="x"
      />,
    );
    expect(screen.getByText("Decided May 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("$145,000 per year")).toBeInTheDocument();
    expect(screen.getByText("DOL's file dates it January 14, 2026")).toBeInTheDocument();
    expect(screen.getByText("Only in DOL's published files")).toBeInTheDocument();
  });

  it("orders by the newest decision when asked", () => {
    act(() => nav.set("sort=decided"));
    render(
      <FiledOnDay
        perm={[mk(1, { employer: "Acme", decided: "2026-02-01" }), mk(2, { employer: "Beta", decided: "2026-06-01" })]}
        pwd={[]}
        dayLabel="x"
      />,
    );
    expect(caseLinks().map((a) => a.textContent)).toEqual(["G-100-26015-200002", "G-100-26015-200001"]);
  });

  it("offers the LCA and seasonal tabs only with a day, and loads one when opened", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ cases: [mk(5, { caseNumber: "I-200-26015-400000", employer: "Infosys" })], capped: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const { unmount } = render(<FiledOnDay perm={[mk(1)]} pwd={[]} dayLabel="x" />);
      expect(screen.queryByRole("button", { name: /H-1B LCAs/ })).toBeNull();
      unmount();
      render(<FiledOnDay perm={[mk(1)]} pwd={[]} dayLabel="x" day="2026-01-15" counts={{ lca: 1, seasonal: 0 }} />);
      fireEvent.click(screen.getByRole("button", { name: /H-1B LCAs/ }));
      expect(await screen.findByText("Infosys")).toBeInTheDocument();
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/filed-on?day=2026-01-15&program=lca");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
