import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SECTIONS } from "@/components/tools/DataNav";

/**
 * Every data page highlights its own tab.
 *
 * WHAT WENT WRONG TWICE. `/perm-cases` shipped passing `active="employers"`,
 * so the section nav told a visitor they were on the Employers page. Fixed by
 * hand in August 2026, and then `/perm-queue` was found doing the same thing a
 * different way: it had no section key of its own, so it borrowed
 * `"overview"`, whose tab points at `/tools`. Two instances of one defect,
 * neither visible from reading the page it was on.
 *
 * WHY THIS RULE AND NOT A PATH-PREFIX MATCH. The obvious gate - "the active
 * tab's href must be a prefix of this page's route" - condemns a dozen
 * correct pages. `/tools/pwd-calculator` highlights Calculators, whose href is
 * `/calculators`, and that is right: the tab is the index of every calculator
 * and this is one of them. An earlier audit of exactly this shape reported
 * eleven mismatches of which ten were that false positive.
 *
 * The rule below only fires on the thing that is unambiguously wrong: if a
 * page's own route IS one of the section hrefs, it must use that section's
 * key. Nothing else can be correct, because the tab would be pointing at this
 * very page while claiming the visitor is somewhere else. Detail pages, whose
 * routes match no href, stay free to highlight their parent, which is the
 * behaviour that was right all along.
 */

const APP_ROOT = path.join(process.cwd(), "src", "app");

/** Every page under `src/app`, with its URL route and its DataNav prop. */
interface PageRecord {
  file: string;
  route: string;
  active: string | null;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(full, out);
    } else if (entry === "page.tsx") {
      out.push(full);
    }
  }
  return out;
}

/**
 * `src/app/(site)/(public)/perm-employers/[slug]/page.tsx` to
 * `/perm-employers/[slug]`.
 *
 * Route groups are parentheses-wrapped directory names and contribute nothing
 * to the URL, which is the entire reason `(site)/(public)` can exist without
 * `/perm-cases` becoming `/site/public/perm-cases`.
 */
function routeOf(file: string): string {
  const rel = path.relative(APP_ROOT, path.dirname(file));
  const segments = rel
    .split(path.sep)
    .filter((s) => s !== "" && s !== "." && !(s.startsWith("(") && s.endsWith(")")));
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

const ACTIVE_RE = /<DataNav\s+active=(?:"([^"]+)"|\{"([^"]+)"\})/;

const pages: PageRecord[] = walk(APP_ROOT).map((file) => {
  const src = readFileSync(file, "utf8");
  const m = ACTIVE_RE.exec(src);
  return {
    file: path.relative(process.cwd(), file),
    route: routeOf(file),
    active: m ? (m[1] ?? m[2] ?? null) : null,
  };
});

const withNav = pages.filter((p) => p.active !== null);
const hrefToKey = new Map(SECTIONS.map((s) => [s.href, s.key]));

describe("DataNav active section", () => {
  it("scanned a plausible number of pages, so a silent pass is a real pass", () => {
    // A gate that cannot see its subject reads exactly like a gate that found
    // nothing wrong. These two floors are the difference.
    expect(pages.length).toBeGreaterThanOrEqual(40);
    expect(withNav.length).toBeGreaterThanOrEqual(20);
    expect(SECTIONS.length).toBeGreaterThanOrEqual(10);
  });

  it("gives every section key a unique href and every href a unique key", () => {
    expect(new Set(SECTIONS.map((s) => s.href)).size).toBe(SECTIONS.length);
    expect(new Set(SECTIONS.map((s) => s.key)).size).toBe(SECTIONS.length);
  });

  it("makes an index page highlight itself, never a sibling", () => {
    const wrong = withNav
      .filter((p) => hrefToKey.has(p.route))
      .filter((p) => p.active !== hrefToKey.get(p.route))
      .map((p) => `${p.route} highlights "${p.active}", expected "${hrefToKey.get(p.route)}" (${p.file})`);
    expect(wrong).toEqual([]);
  });

  it("makes a detail page highlight the same section as its own index", () => {
    // The behaviour that was always correct: `/perm-employers/[slug]` marks
    // Employers. This asserts it stays tied to the parent rather than drifting.
    const byRoute = new Map(withNav.map((p) => [p.route, p]));
    const wrong: string[] = [];
    for (const page of withNav) {
      if (!page.route.includes("[")) continue;
      const parent = page.route.slice(0, page.route.lastIndexOf("/"));
      const index = byRoute.get(parent);
      if (!index) continue;
      if (page.active !== index.active) {
        wrong.push(
          `${page.route} highlights "${page.active}" but its index ${parent} highlights "${index.active}"`,
        );
      }
    }
    expect(wrong).toEqual([]);
  });

  it("never names a section key the nav does not define", () => {
    const known = new Set(SECTIONS.map((s) => s.key));
    const unknown = withNav
      .filter((p) => !known.has(p.active as never))
      .map((p) => `${p.route} highlights unknown section "${p.active}"`);
    expect(unknown).toEqual([]);
  });

  it("covers the four cases this gate exists for", () => {
    const at = (route: string) => withNav.find((p) => p.route === route);

    // 1. An index page highlights itself.
    expect(at("/perm-employers")?.active).toBe("employers");
    // 2. A detail page highlights its parent.
    expect(at("/perm-employers/[slug]")?.active).toBe("employers");
    // 3. The page that shipped the bug highlights itself.
    expect(at("/perm-cases")?.active).toBe("cases");
    // 4. A page with no section nav highlights nothing at all.
    expect(at("/privacy")).toBeUndefined();
    expect(pages.find((p) => p.route === "/privacy")?.active).toBeNull();
  });

  it("gives the live queue its own section rather than borrowing Overview", () => {
    const queue = SECTIONS.find((s) => s.key === "queue");
    expect(queue?.href).toBe("/perm-queue");
    expect(withNav.find((p) => p.route === "/perm-queue")?.active).toBe("queue");
    expect(withNav.find((p) => p.route === "/perm-queue/[month]")?.active).toBe("queue");
  });
});
