import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { StateConcentration, StateLeaders } from "../StateProfiles";
import { DenialReach } from "../DenialReach";
import type { StateProfile } from "@/lib/turso/states";

/**
 * Glued text, checked on the RENDERED markup rather than the source.
 *
 * `src/app/__tests__/no-glued-jsx-text.test.ts` scans source and is
 * structurally blind to the shape these components use: the glue between two
 * `.map()` array items exists nowhere in the source, because there is no
 * newline between two tags to find. It reported these files clean while a dev
 * server was serving 36 real pairs off them, found only by fetching pages.
 *
 * `scripts/audit_glued_text.py` is the authority and does fetch pages, but it
 * needs a running server, so it cannot run in CI and did not exist as a guard
 * on this work. Rendering to static markup asks the same question of the same
 * output with neither a build nor a server.
 *
 * The predicate is deliberately the same one that script uses: a closing tag
 * immediately followed by an opening tag, with a word character on both sides
 * of the boundary once the tags are stripped. Adjacency alone is not glue,
 * which is why the word-character test is there: two icon-only links have no
 * text between them and are fine. A first version of that script without it
 * reported 293 pairs where 153 were real.
 */

const TAGS =
  "h1|h2|h3|h4|h5|h6|p|span|a|li|dt|dd|strong|b|em|td|th|button|label|ul|ol";
const BOUNDARY = new RegExp(`</(?:${TAGS})>(<(?:${TAGS})(?:\\s[^>]*)?>)`, "gi");
const TAG = /<[^>]*>/g;
const WORD = /[A-Za-z0-9]/;

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function gluedPairs(markup: string): string[] {
  const found: string[] = [];
  for (const m of markup.matchAll(BOUNDARY)) {
    const start = m.index;
    const end = start + m[0].length;
    const before = decode(markup.slice(Math.max(0, start - 300), start).replace(TAG, ""));
    const after = decode(markup.slice(end, end + 300).replace(TAG, ""));
    if (!before || !after) continue;
    if (WORD.test(before.slice(-1)) && WORD.test(after.slice(0, 1))) {
      found.push(`${before.trim().slice(-40)}||${after.trim().slice(0, 40)}`);
    }
  }
  return found;
}

function profile(over: Partial<StateProfile> & { state: string }): StateProfile {
  return {
    total: 1000,
    decided: 950,
    denied: 30,
    withdrawn: 20,
    denialRate: 3.16,
    topOccupations: [{ key: "15-1252", label: "Software Developers", count: 250 }],
    topEmployers: [{ key: "acme-inc", label: "Acme Inc.", count: 100 }],
    topOccupationShare: 25,
    topEmployerShare: 10,
    ...over,
  };
}

const STATES: StateProfile[] = [
  profile({ state: "AL", total: 4986, topOccupationShare: 62.7, topEmployerShare: 48.5 }),
  profile({ state: "WA", total: 15746, topOccupationShare: 44.1, topEmployerShare: 37 }),
  profile({ state: "CA", total: 67742, topOccupationShare: 25.6, topEmployerShare: 3.7 }),
];

describe("the predicate itself", () => {
  it("catches glue and clears an ordinary space", () => {
    // A gate whose first run is a pass teaches you to ignore it. Probe with an
    // input that MUST match before believing any clean result below.
    expect(gluedPairs("<p>Petitions waiting</p><p>89,215</p>")).toHaveLength(1);
    expect(gluedPairs("<p>Petitions waiting</p> <p>89,215</p>")).toHaveLength(0);
  });

  it("does not call two icon-only elements glued", () => {
    // Adjacency is not glue. Requiring a word character on both sides is what
    // separates a real defect from a pair of icon links.
    expect(gluedPairs('<a><svg/></a><a><svg/></a>')).toHaveLength(0);
  });
});

describe("rendered markup carries no glued text", () => {
  it("StateConcentration bars", () => {
    const html = renderToStaticMarkup(<StateConcentration states={STATES} />);
    expect(html.length).toBeGreaterThan(500);
    expect(gluedPairs(html)).toEqual([]);
  });

  it("StateLeaders table", () => {
    const html = renderToStaticMarkup(<StateLeaders states={STATES} />);
    expect(html.length).toBeGreaterThan(500);
    expect(gluedPairs(html)).toEqual([]);
  });

  it("DenialReach bars", () => {
    const html = renderToStaticMarkup(
      <DenialReach
        rows={[
          { label: "Employer had a layoff", decided: 10222, denied: 56 },
          { label: "Worker has an ownership interest", decided: 1308, denied: 275 },
        ]}
        totalDecided={355130}
        totalDenied={11357}
        label="Denial reach by declared factor"
        unitLabel="Declared factor"
        caption="c"
      />,
    );
    expect(html.length).toBeGreaterThan(500);
    expect(gluedPairs(html)).toEqual([]);
  });
});
