import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const path = { current: "/perm-queue" };
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

import { SiteBreadcrumbs } from "@/components/layout/SiteBreadcrumbs";
import { DataShell } from "../DataShell";
import { showsWatchBanner } from "../WatchBanner";

describe("the free-alert offer on data pages", () => {
  it("sits at the end of a data page's breadcrumb bar, one link to the case lookup", () => {
    path.current = "/perm-queue";
    render(<SiteBreadcrumbs />);
    const link = screen.getByRole("link", { name: "Watch my case" });
    expect(link.getAttribute("href")).toBe("/perm-case-status");
    expect(document.body.textContent).toContain("Get a free email within minutes of DOL moving it.");
    // Outside the breadcrumb list: the trail stays a trail.
    expect(screen.getByRole("navigation", { name: "Breadcrumb" }).contains(link)).toBe(false);
  });

  it("no longer adds a box above the page's heading", () => {
    path.current = "/perm-queue";
    render(<DataShell><h1>Queue</h1></DataShell>);
    expect(screen.queryByRole("link", { name: "Watch my case" })).toBeNull();
  });

  it("stays off the pages that already carry a lookup or an alert form", () => {
    expect(showsWatchBanner("/perm-case-status")).toBe(false);
    expect(showsWatchBanner("/email-preferences/")).toBe(false);
    expect(showsWatchBanner("/perm-employers/under-review")).toBe(true);
  });

  it("is not shown outside the data pages", () => {
    path.current = "/about";
    render(<SiteBreadcrumbs />);
    expect(screen.queryByRole("link", { name: "Watch my case" })).toBeNull();
  });
});
