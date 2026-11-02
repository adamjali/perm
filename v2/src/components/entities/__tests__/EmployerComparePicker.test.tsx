import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** A search with no match says so, and a failed one says it failed: they had looked the same, an empty box. */

const searchEntities = vi.fn();
vi.mock("@/lib/fetchEntities", () => ({ searchEntities }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/search/DidYouMean", () => ({
  DidYouMean: () => null,
  useNameSuggestions: () => ({ suggestions: [], loading: false }),
}));

const { EmployerComparePicker } = await import("../EmployerComparePicker");

afterEach(() => {
  searchEntities.mockReset();
});

describe("EmployerComparePicker", () => {
  it("says no employer matches when the search found none", async () => {
    searchEntities.mockResolvedValue({ rows: [] });
    render(<EmployerComparePicker a={null} b={null} />);
    fireEvent.change(screen.getAllByRole("textbox")[0]!, { target: { value: "zzqx corp" } });
    expect(await screen.findByText("No employer matches that spelling.", {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it("says the search failed, never that nothing matched", async () => {
    searchEntities.mockRejectedValue(new Error("503"));
    render(<EmployerComparePicker a={null} b={null} />);
    fireEvent.change(screen.getAllByRole("textbox")[0]!, { target: { value: "acme" } });
    expect(await screen.findByText(/couldn't be searched just now/, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.queryByText("No employer matches that spelling.")).toBeNull();
  });
});
