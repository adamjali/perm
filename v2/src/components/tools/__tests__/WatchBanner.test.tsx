import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const path = { current: "/perm-queue" };
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

import { DataShell } from "../DataShell";
import { showsWatchBanner } from "../WatchBanner";

describe("the free-alert line on data pages", () => {
  it("sits above a data page, one line with one link to the case lookup", () => {
    path.current = "/perm-queue";
    render(<DataShell><h1>Queue</h1></DataShell>);
    const banner = screen.getByRole("complementary", { name: "Free case alerts" });
    expect(banner.textContent).toContain("Get a free email within minutes of DOL moving it.");
    expect(screen.getByRole("link", { name: "Watch my case" }).getAttribute("href")).toBe("/perm-case-status");
  });

  it("stays off the pages that already carry a lookup or an alert form", () => {
    expect(showsWatchBanner("/perm-case-status")).toBe(false);
    expect(showsWatchBanner("/email-preferences/")).toBe(false);
    expect(showsWatchBanner("/perm-employers/under-review")).toBe(true);
  });

  it("is not added to pages outside the data shell", () => {
    path.current = "/about";
    render(<DataShell><h1>About</h1></DataShell>);
    expect(screen.queryByRole("complementary", { name: "Free case alerts" })).toBeNull();
  });
});
