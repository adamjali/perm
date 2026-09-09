import { describe, expect, it } from "vitest";

import {
  FOOTER_COLUMNS,
  LEARN_NAV_LINKS,
  TOOL_NAV_LINKS,
} from "@/lib/constants/navigation";
import { SECTIONS } from "@/components/tools/dataSections";

/**
 * The footer and the top nav have to agree, and the footer has to reach every
 * public page.
 *
 * Adam: "drop down learn isnt same as footer, ensure footer is correct
 * everywhere adn vice versa". Measured at the time: the Learn dropdown listed
 * Blog, Guides, FAQ, Methodology, About and Changelog; the footer's Learn
 * column listed Blog, Guides, Changelog and "Processing Times". FAQ was under
 * Product, About was under Legal, and METHODOLOGY WAS IN THE DROPDOWN AND
 * NOWHERE IN THE FOOTER AT ALL.
 *
 * Underneath that was the bigger one: the whole Reference cluster - glossary,
 * status meanings, policy changes, debarments, the scorecard, badges - was
 * reachable only from the data rail. Pages that exist, sit in the sitemap, and
 * had nothing in the footer pointing at them.
 *
 * Both lists are now derived rather than transcribed, so this test is mostly
 * guarding that nobody transcribes them again.
 */
describe("footer and nav parity", () => {
  const columns = Object.fromEntries(FOOTER_COLUMNS.map((c) => [c.title, c]));
  const allFooterHrefs = FOOTER_COLUMNS.flatMap((c) => [
    ...c.links.map((l) => l.href),
    ...(c.publicOnly ?? []).map((l) => l.href),
    ...(c.more ? [c.more.href] : []),
  ]);

  it("has the columns it is about to make assertions about", () => {
    // A renamed column would otherwise make every lookup below `undefined`
    // and the assertions vacuous.
    for (const title of ["Product", "Learn", "Reference", "Calculators", "Legal"]) {
      expect(columns[title], `footer column "${title}"`).toBeDefined();
    }
  });

  it("gives the Learn column exactly the Learn dropdown", () => {
    expect(columns.Learn!.links.map((l) => `${l.href} ${l.label}`)).toEqual(
      LEARN_NAV_LINKS.map((l) => `${l.href} ${l.label}`),
    );
  });

  it("links every Reference page the data rail lists", () => {
    const railReference = SECTIONS.filter((s) => s.group === "Reference");
    // Sanity: if the group were empty or renamed this test would pass while
    // checking nothing.
    expect(railReference.length).toBeGreaterThanOrEqual(4);

    const missing = railReference
      .map((s) => s.href)
      .filter((href) => !allFooterHrefs.includes(href));
    expect(
      missing,
      `these Reference pages are in the rail and nowhere in the footer: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("samples the calculators rather than listing all of them", () => {
    const cols = columns.Calculators!;
    // The full list is what made the footer 760px tall on desktop and 1,882px
    // on a phone. A sample plus a link to the hub is the whole point.
    expect(cols.links.length).toBeLessThan(TOOL_NAV_LINKS.length);
    expect(cols.more?.href).toBe("/calculators");
    // The label counts the real total, so it cannot go stale when a tool ships.
    expect(cols.more?.label).toContain(String(TOOL_NAV_LINKS.length));
    for (const link of cols.links) {
      expect(TOOL_NAV_LINKS.map((t) => t.href)).toContain(link.href);
    }
  });

  it("never points two footer links at the same page", () => {
    // Two links with one destination, or one visible label used for two
    // destinations, is the defect `navigation.ts` already records for
    // "Processing times". Duplicates are also a Lighthouse finding.
    const seen = new Set<string>();
    const dupes = allFooterHrefs.filter((h) => (seen.has(h) ? true : (seen.add(h), false)));
    expect(dupes, `duplicated footer hrefs: ${dupes.join(", ")}`).toEqual([]);
  });
});
