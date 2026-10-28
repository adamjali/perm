import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DayCase } from "@/lib/filingDay";

import { FiledOnDay } from "../FiledOnDay";

const mk = (i: number, over: Partial<DayCase> = {}): DayCase => ({
  caseNumber: `G-100-26015-${String(200000 + i).padStart(6, "0")}`,
  status: "ANALYST REVIEW",
  employer: `Employer ${i}`,
  jobTitle: "Software Engineer",
  final: false,
  ...over,
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

  it("says so when the day holds none of a kind", () => {
    render(<FiledOnDay perm={[]} pwd={[]} dayLabel="January 15, 2026" />);
    expect(screen.getByText("DOL's record holds none filed on January 15, 2026.")).toBeInTheDocument();
  });
});
