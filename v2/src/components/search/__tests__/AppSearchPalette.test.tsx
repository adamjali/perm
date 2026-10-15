// @vitest-environment jsdom
/**
 * The app's search box: your own cases first, then the app's pages, then the
 * public data, and nothing asked of the server for a one-letter query.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const useQuery = vi.fn();
vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => useQuery(...args) }));

import { AppSearchPalette } from "../AppSearchPalette";

const CASES = {
  cases: [
    { _id: "c1", employerName: "Juniper Biologics", positionTitle: "Senior Statistician", beneficiaryIdentifier: "A. Lindqvist", progressStatus: "working" },
  ],
  pagination: { totalCount: 3 },
};

describe("AppSearchPalette", () => {
  beforeEach(() => {
    useQuery.mockReset();
    useQuery.mockReturnValue(undefined);
  });

  it("asks nothing of the server until two letters are typed, and lists the app's pages", () => {
    render(<AppSearchPalette open onOpenChange={() => {}} />);
    expect(useQuery.mock.calls.every((c) => c[1] === "skip")).toBe(true);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Add a case")).toBeInTheDocument();
  });

  it("shows the matching cases, a way to every match, and the public search", async () => {
    useQuery.mockReturnValue(CASES);
    const user = userEvent.setup();
    render(<AppSearchPalette open onOpenChange={() => {}} />);
    await user.type(screen.getByPlaceholderText(/case number/i), "juniper");

    const last = useQuery.mock.calls.at(-1);
    expect(last?.[1]).toMatchObject({ searchQuery: "juniper" });
    expect(screen.getByText("Juniper Biologics")).toBeInTheDocument();
    expect(screen.getByText("Senior Statistician, A. Lindqvist")).toBeInTheDocument();
    expect(screen.getByText(/Every match on the cases page \(3\)/)).toBeInTheDocument();
    expect(screen.getByText(/Every public filing for/)).toBeInTheDocument();
  });

  it("offers DOL's own status for a case number", async () => {
    useQuery.mockReturnValue({ cases: [], pagination: { totalCount: 0 } });
    const user = userEvent.setup();
    render(<AppSearchPalette open onOpenChange={() => {}} />);
    await user.type(screen.getByPlaceholderText(/case number/i), "G-100-26010-550166");
    expect(screen.getByText("None of your cases match.")).toBeInTheDocument();
    expect(screen.getByText(/DOL's status for G-100-26010-550166/)).toBeInTheDocument();
  });
});
