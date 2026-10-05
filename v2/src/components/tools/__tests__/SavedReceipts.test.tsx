import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_SAVED, readSaved, SavedReceipts, STORAGE_KEY } from "../SavedReceipts";

/**
 * The receipt list lives in this browser only. It must survive bad stored
 * data, a browser that refuses storage, and must never show for a visitor
 * who has nothing to save and nothing saved.
 */

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("SavedReceipts", () => {
  it("shows nothing to a visitor with no list and no receipt on the page", async () => {
    const { container } = render(<SavedReceipts current={null} />);
    await act(async () => {});
    expect(container.textContent).toBe("");
  });

  it("saves the receipt on the page with an optional name, and links it back", async () => {
    render(<SavedReceipts current="EAC2190123456" />);
    await act(async () => {});
    fireEvent.change(screen.getByLabelText(/A name for EAC2190123456/), { target: { value: "Mum's EAD" } });
    fireEvent.click(screen.getByRole("button", { name: "Save EAC2190123456" }));
    expect(screen.getByRole("link", { name: "EAC2190123456" }).getAttribute("href")).toBe(
      "/uscis-case-status?receipt=EAC2190123456",
    );
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual([{ receipt: "EAC2190123456", label: "Mum's EAD" }]);
    // Saved already: no second save offer.
    expect(screen.queryByRole("button", { name: /Save / })).toBeNull();
  });

  it("removes a receipt", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ receipt: "IOE0912345678", label: "" }]));
    render(<SavedReceipts current={null} />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Remove IOE0912345678" }));
    expect(screen.queryByRole("link", { name: "IOE0912345678" })).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual([]);
  });

  it("drops junk in storage instead of failing, and keeps at most the cap", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    expect(readSaved()).toEqual([]);
    const many = Array.from({ length: MAX_SAVED + 5 }, (_, i) => ({ receipt: `EAC21901234${String(i).padStart(2, "0")}`, label: "" }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...many, { receipt: "nonsense" }, 7]));
    expect(readSaved()).toHaveLength(MAX_SAVED);
  });

  it("says so when the browser refuses to save, and still shows the list for this visit", async () => {
    // A whole refusing storage behind the window's getter, restored below. A
    // spy on window.localStorage.setItem was never undone (the storage object
    // is a Proxy), so under CI's shuffled order this refusal leaked into the
    // next test and broke its save (Oct 4 2026).
    const refusing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as unknown as Storage;
    const refuse = vi.spyOn(window, "localStorage", "get").mockReturnValue(refusing);
    try {
      render(<SavedReceipts current="EAC2190123456" />);
      await act(async () => {});
      fireEvent.click(screen.getByRole("button", { name: "Save EAC2190123456" }));
      expect(screen.getByRole("status").textContent).toMatch(/isn't letting the page save/);
      expect(screen.getByRole("link", { name: "EAC2190123456" })).toBeInTheDocument();
    } finally {
      refuse.mockRestore();
    }
  });
});
