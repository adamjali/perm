import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const path = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

const { SiteBreadcrumbs } = await import("../SiteBreadcrumbs");

const render = (at: string, props: Parameters<typeof SiteBreadcrumbs>[0] = {}) => {
  path.current = at;
  return renderToStaticMarkup(<SiteBreadcrumbs {...props} />);
};

describe("SiteBreadcrumbs", () => {
  it("renders nothing on the home page", () => {
    expect(render("/")).toBe("");
  });

  it("marks the page itself as current and emits its BreadcrumbList", () => {
    const html = render("/about");
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/"');
    expect(html).toMatch(/aria-current="page"[^>]*><span class="truncate">About</);
    expect(html).toContain('"@type":"BreadcrumbList"');
  });

  it("links every crumb on a detail page, and leaves the list to the page, which knows its name", () => {
    const html = render("/perm-wages/software-developers");
    expect(html).toContain('href="/perm-wages"');
    expect(html).not.toContain("aria-current");
    expect(html).not.toContain("BreadcrumbList");
  });

  it("says when the page last changed, and tells search the same day", () => {
    const html = render("/perm-processing-times", { sources: { dol: "2099-02-03" } });
    expect(html).toContain('Updated <time dateTime="2099-02-03">February 3, 2099</time>');
    expect(html).toContain('"@type":"WebPage"');
    expect(html).toContain('"dateModified":"2099-02-03"');
    expect(html).toContain('"url":"https://permtracker.app/perm-processing-times"');
  });

  it("gives the home page its WebPage date, with no trail to show", () => {
    const html = render("/", { sources: { sweep: "2099-02-03" } });
    expect(html).not.toContain("Breadcrumb");
    expect(html).toContain('"dateModified":"2099-02-03"');
    expect(html).toContain('"url":"https://permtracker.app"');
  });

  it("steps aside where the page dates itself, and shows the page's own day there", () => {
    expect(render("/perm-employers/adobe-inc", { sources: { corpus: "2099-01-01" } })).toBe("");
    const own = render("/perm-employers/adobe-inc", { date: "2099-04-05" });
    expect(own).toContain('href="/perm-employers"');
    expect(own).toContain('dateTime="2099-04-05"');
  });

  it("leaves the date to the article, which carries its own", () => {
    expect(render("/guides/three-180-day-clocks", { sources: { posts: "2099-01-01" } })).toBe("");
    const own = render("/guides/three-180-day-clocks", { pageName: "Three 180-day clocks", sources: { posts: "2099-01-01" } });
    expect(own).not.toContain("Updated");
    expect(own).not.toContain('"@type":"WebPage"');
  });

});
