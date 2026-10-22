import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { clampPage, pageItems, Pagination } from "../pagination";

describe("pageItems", () => {
  it("lists every page when there are seven or fewer", () => {
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps the first pages together near the start", () => {
    expect(pageItems(2, 12)).toEqual([1, 2, 3, 4, 5, "gap", 12]);
  });

  it("puts the current page between its neighbours in the middle", () => {
    expect(pageItems(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
  });

  it("keeps the last pages together near the end", () => {
    expect(pageItems(11, 12)).toEqual([1, "gap", 8, 9, 10, 11, 12]);
  });

  it("always includes the current page", () => {
    for (let n = 1; n <= 40; n++) for (let p = 1; p <= n; p++) expect(pageItems(p, n)).toContain(p);
  });
});

describe("clampPage", () => {
  it("reads nonsense as page 1 and caps at the last page", () => {
    expect(clampPage(Number.NaN, 5)).toBe(1);
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(2.7, 5)).toBe(2);
  });
});

describe("Pagination", () => {
  it("says which items are showing, marks the current page and moves on a press", () => {
    const onPage = vi.fn();
    render(<Pagination page={2} pageCount={8} onPage={onPage} total={86} perPage={12} noun="guides" />);
    expect(screen.getByText("13 to 24 of 86 guides")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Page 2, this page" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    expect(onPage).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPage).toHaveBeenCalledWith(1);
  });

  it("turns Previous off on the first page and Next off on the last", () => {
    const { rerender } = render(<Pagination page={1} pageCount={3} onPage={() => {}} />);
    expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<Pagination page={3} pageCount={3} onPage={() => {}} />);
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("draws no controls for a single page", () => {
    render(<Pagination page={1} pageCount={1} onPage={() => {}} total={9} noun="posts" />);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByText("All 9 posts")).toBeTruthy();
  });
});
