import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { FieldPosition } from "../FieldPosition";
import {
  DisclosureNote,
  EntityDataGap,
  LimitsPanel,
  MIN_DECIDED_FOR_RATE,
  PeerList,
  RankLadder,
  ReliabilityBand,
  TITLE_LIMIT,
  TITLE_SUFFIX,
  entityTitle,
  rateReliability,
  separationN,
  wilsonUpperPct,
  type PeerEntity,
} from "../EntityContext";

/** DOL's measured denial rate over 248,158 decided cases in this window. */
const BASELINE = 2.57;

function peer(over: Partial<PeerEntity> & { slug: string; name: string }): PeerEntity {
  return {
    rank: 10,
    total: 100,
    certified: 98,
    denied: 2,
    medianDays: 480,
    medianAnnualWage: null,
    state: null,
    ...over,
  };
}

describe("wilsonUpperPct", () => {
  it("never returns zero for a spotless record, which is the whole point", () => {
    // The textbook normal interval gives exactly 0 here, which would assert
    // that a three-case employer's denial rate is KNOWN to be zero.
    expect(wilsonUpperPct(0, 3)).toBeGreaterThan(50);
  });

  it("collapses to z^2 / (n + z^2) when there are no failures", () => {
    // Closed form, so these are derived rather than recorded from a run.
    const z2 = 1.959963984540054 ** 2;
    for (const n of [10, 30, 100, 500]) {
      expect(wilsonUpperPct(0, n)).toBeCloseTo((z2 / (n + z2)) * 100, 6);
    }
    expect(wilsonUpperPct(0, 30)).toBeCloseTo(11.35, 1);
  });

  it("tightens as the count grows", () => {
    const widths = [10, 50, 200, 2000].map((n) => wilsonUpperPct(1, n));
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]!).toBeLessThan(widths[i - 1]!);
    }
  });

  it("refuses to claim anything from an empty denominator", () => {
    expect(wilsonUpperPct(0, 0)).toBe(100);
  });
});

describe("separationN", () => {
  it("says a clean record needs about 146 decided cases at DOL's baseline", () => {
    // Solving z^2 / (n + z^2) < 0.0257. Only 255 of 12,240 employers get there,
    // which is the fact behind the whole warn-and-withhold treatment.
    expect(separationN(BASELINE)).toBe(146);
  });

  it("needs fewer cases when the field denies more often", () => {
    expect(separationN(10)).toBeLessThan(separationN(BASELINE));
  });

  it("is unreachable when the field never denies", () => {
    expect(separationN(0)).toBe(Infinity);
  });
});

describe("rateReliability", () => {
  it("withholds the rate below the threshold and publishes no percentage", () => {
    const r = rateReliability(3, 0, BASELINE);
    expect(r.tier).toBe("withheld");
    expect(r.ratePct).toBeNull();
    expect(r.decided).toBe(3);
  });

  it("withholds at one case under the bar and publishes at the bar", () => {
    expect(rateReliability(MIN_DECIDED_FOR_RATE - 1, 0, BASELINE).tier).toBe("withheld");
    expect(rateReliability(MIN_DECIDED_FOR_RATE, 0, BASELINE).ratePct).toBe(100);
  });

  it("counts decided cases, not filings: a withdrawal is in neither", () => {
    // 40 filings, 28 certified, 1 denied, 11 withdrawn is 29 decided, which is
    // under the bar even though the filing count is comfortably over it.
    expect(rateReliability(28, 1, BASELINE).decided).toBe(29);
    expect(rateReliability(28, 1, BASELINE).tier).toBe("withheld");
  });

  it("calls a clean 30-case record soft, because it still covers the field", () => {
    const r = rateReliability(30, 0, BASELINE);
    expect(r.tier).toBe("soft");
    expect(r.upperDenialPct).toBeGreaterThan(BASELINE);
  });

  it("calls a genuinely clean record firm once it is big enough", () => {
    // Microsoft's live row: 4,526 certified, 12 denied.
    const r = rateReliability(4526, 12, BASELINE);
    expect(r.tier).toBe("firm");
    expect(r.upperDenialPct).toBeLessThan(BASELINE);
  });

  it("calls a genuinely bad record firm too, not just a good one", () => {
    const r = rateReliability(100, 20, BASELINE);
    expect(r.tier).toBe("firm");
    expect(r.ratePct).toBeCloseTo(83.33, 1);
  });
});

describe("entityTitle", () => {
  const rendered = (t: { title: string; absolute: boolean }) =>
    t.absolute ? t.title : t.title + TITLE_SUFFIX;

  it("keeps the brand suffix while the whole thing still fits", () => {
    const t = entityTitle("Microsoft Corporation", ["PERM Filings"]);
    expect(t.absolute).toBe(false);
    expect(rendered(t)).toBe("Microsoft Corporation PERM Filings | PERM Tracker");
    expect(rendered(t).length).toBeLessThanOrEqual(TITLE_LIMIT);
  });

  it("measures the RENDERED length, not the base", () => {
    // The old rule tested the base against 60, so a base under 60 passed and
    // then rendered 15 characters longer. This one puts the base at 52 and
    // the rendered title at 67.
    const name = "Management Health Systems of Boston, LLC";
    const t = entityTitle(name, ["PERM Filings"]);
    expect(`${name} PERM Filings`.length).toBeLessThan(TITLE_LIMIT);
    expect(t.absolute).toBe(true);
    expect(rendered(t).length).toBeLessThanOrEqual(TITLE_LIMIT);
  });

  it("drops the brand before it drops the qualifier", () => {
    const t = entityTitle("Secretaries and Administrative Assistants", [
      "PERM Salary and Filings",
      "PERM Salary",
    ]);
    expect(t.absolute).toBe(true);
    expect(t.title).toBe("Secretaries and Administrative Assistants PERM Salary");
  });

  it("falls back to the bare name and never cuts it", () => {
    // 79 characters, DOL's own longest SOC title. Nothing fits beside it, and
    // the name is the phrase people search, so it ships whole and over-length.
    const name =
      "Secretaries and Administrative Assistants, Except Legal, Medical, and Executive";
    const t = entityTitle(name, ["PERM Salary and Filings", "PERM Salary"]);
    expect(t.title).toBe(name);
    expect(t.absolute).toBe(true);
  });

  it("matches the template the root layout actually declares", () => {
    // A suffix constant that drifts from layout.tsx makes every length here a
    // fiction, and nothing else in the codebase would notice.
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toContain(`template: "%s${TITLE_SUFFIX}"`);
  });
});

describe("ReliabilityBand", () => {
  it("states the count and refuses the rate when it is withheld", () => {
    render(
      <ReliabilityBand
        reliability={rateReliability(3, 0, BASELINE)}
        baselineDenialPct={BASELINE}
        subject="sponsor"
        unit="filings"
      />,
    );
    expect(screen.getByText(/Too few cases for a rate/i)).toBeInTheDocument();
    expect(screen.getByText(/3 decided filings/)).toBeInTheDocument();
    expect(screen.getByText(/146 decided cases/)).toBeInTheDocument();
  });

  it("names the interval when a published rate cannot be told from the field", () => {
    render(
      <ReliabilityBand
        reliability={rateReliability(30, 0, BASELINE)}
        baselineDenialPct={BASELINE}
        subject="firm"
        unit="cases"
      />,
    );
    expect(screen.getByText(/This rate is level with the field/i)).toBeInTheDocument();
    expect(screen.getByText(/95% interval/)).toBeInTheDocument();
    // The soft tier covers BOTH directions. An entity can be soft while sitting
    // below the field (Honda: 94.1% against 97.4%), so copy reading "consistent
    // with the field rather than one that beats it" was wrong for half of them.
    expect(screen.getByText(/in either\s+direction/)).toBeInTheDocument();
  });

  it("says nothing at all when the rate stands on its own", () => {
    const { container } = render(
      <ReliabilityBand
        reliability={rateReliability(4526, 12, BASELINE)}
        baselineDenialPct={BASELINE}
        subject="sponsor"
        unit="filings"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("PeerList", () => {
  const ITEMS = [
    peer({ slug: "alpha-inc", name: "Alpha Inc", rank: 11, total: 90 }),
    peer({ slug: "beta-llc", name: "Beta LLC", rank: 12, total: 88, denied: 0 }),
    peer({ slug: "gamma-co", name: "Gamma Co", rank: 13, total: 86, state: "NY" }),
  ];

  it("links every peer at the right base", () => {
    render(
      <PeerList
        heading="Sponsors filing at the same rate"
        note="peers"
        items={ITEMS}
        hrefBase="/perm-employers"
        unit="filings"
      />,
    );
    expect(screen.getByRole("link", { name: /Alpha Inc/ })).toHaveAttribute(
      "href",
      "/perm-employers/alpha-inc",
    );
    expect(screen.getByRole("link", { name: /Gamma Co/ })).toHaveAttribute(
      "href",
      "/perm-employers/gamma-co",
    );
  });

  it("separates array items so an extractor does not read one run of text", () => {
    // React renders array items with NOTHING between them, so a separator has
    // to be part of each iteration. Google has printed the glued form verbatim
    // in a real search listing for a sibling site.
    //
    // Asserted on textContent rather than on markup, because that is what an
    // extractor walks. An earlier version of this test matched `</li><li>` in
    // the HTML and stayed GREEN with the separator deliberately deleted: the
    // character before the boundary is `>`, not a word character, so its own
    // predicate could never fire. The rendered text is unambiguous -
    // "2 denied#12 Beta LLC" against "2 denied #12 Beta LLC".
    const { container } = render(
      <PeerList
        heading="Sponsors filing at the same rate"
        note="peers"
        items={ITEMS}
        hrefBase="/perm-employers"
        unit="filings"
      />,
    );
    const cards = Array.from(container.querySelectorAll("li"));
    const text = container.textContent ?? "";
    // Control: the sweep can see its subject. Without this, a selector that
    // matched nothing would report every pair as clean.
    expect(cards).toHaveLength(ITEMS.length);
    for (const card of cards) {
      expect(text).toContain(card.textContent);
    }
    for (let i = 1; i < cards.length; i++) {
      const glued = `${cards[i - 1]!.textContent}${cards[i]!.textContent}`;
      expect(text).not.toContain(glued);
    }
  });

  it("renders nothing rather than an empty shell when there are no peers", () => {
    const { container } = render(
      <PeerList heading="Peers" note="n" items={[]} hrefBase="/perm-employers" unit="filings" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("RankLadder", () => {
  it("says nothing filed more when the entity is ranked first", () => {
    render(
      <RankLadder
        rank={1}
        kindTotal={12240}
        above={null}
        below={peer({ slug: "second", name: "Second Place", rank: 2 })}
        hrefBase="/perm-employers"
        unit="filings"
      />,
    );
    // Counts, not a percentile: 1,240 employers are tied on three filings, so
    // "more filings than 2% of them" is false for every one of them.
    expect(
      screen.getByText(/Ranked 1 of 12,240 by volume: 0 filed at least as many/),
    ).toBeInTheDocument();
    expect(screen.getByText(/12,239 filed no more/)).toBeInTheDocument();
  });

  it("says nothing filed less when the entity is ranked last", () => {
    render(
      <RankLadder
        rank={12240}
        kindTotal={12240}
        above={peer({ slug: "prev", name: "Previous", rank: 12239 })}
        below={null}
        hrefBase="/perm-employers"
        unit="filings"
      />,
    );
    expect(screen.getByText(/12,239 filed at least as many/)).toBeInTheDocument();
    expect(screen.getByText(/and 0 filed no more/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Previous/ })).toHaveAttribute(
      "href",
      "/perm-employers/prev",
    );
  });

  it("renders nothing when there is nothing on either side", () => {
    const { container } = render(
      <RankLadder
        rank={1}
        kindTotal={1}
        above={null}
        below={null}
        hrefBase="/perm-employers"
        unit="filings"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("DisclosureNote", () => {
  it("names the source files and links the methodology", () => {
    render(
      <DisclosureNote
        sourceFiles={["PERM_Disclosure_Data_FY2026_Q3.xlsx", "PERM_Disclosure_Data_FY2025_Q4.xlsx"]}
        uniqueCases={259489}
      />,
    );
    expect(screen.getByText(/FY2026 Q3 and FY2025 Q4/)).toBeInTheDocument();
    expect(screen.getByText(/259,489 cases/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /methodology/i })).toHaveAttribute(
      "href",
      "/methodology",
    );
  });

  it("still states a window when the file list is empty", () => {
    render(<DisclosureNote sourceFiles={[]} uniqueCases={null} />);
    expect(screen.getByText(/PERM disclosure files/)).toBeInTheDocument();
  });
});

describe("EntityDataGap", () => {
  it("says the figures did not load, not that the entity has no record", () => {
    render(
      <EntityDataGap what="This employer" backHref="/perm-employers" backLabel="the ranking" />,
    );
    expect(screen.getByText(/figures did(?:n’t| not) load/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /the ranking/ })).toHaveAttribute(
      "href",
      "/perm-employers",
    );
  });
});

describe("LimitsPanel", () => {
  it("renders every limit it is handed", () => {
    render(
      <LimitsPanel
        items={[
          { head: "Volume is not quality", body: "one queue" },
          { head: "Nothing here is pending", body: "every case is decided" },
        ]}
      />,
    );
    expect(screen.getByText("Volume is not quality")).toBeInTheDocument();
    expect(screen.getByText("Nothing here is pending")).toBeInTheDocument();
  });
});

/**
 * FieldPosition is tested here because it is the drawing half of the same
 * contract: what may be claimed about an entity's standing, and when. The tie
 * rule and the unranked-marker rule are two halves of one decision.
 */
describe("FieldPosition", () => {
  // Seven at a spotless 100, three below. This is the real shape: 679 of the
  // 924 employers with a publishable rate have no denials at all.
  const CLUSTERED = [100, 100, 100, 100, 100, 100, 100, 90, 80, 70];

  it("reports ties as ties, not as an advantage", () => {
    render(
      <FieldPosition
        population={CLUSTERED}
        value={100}
        valueLabel="100.0%"
        measure="Approval rate"
        betterWhen="higher"
      />,
    );
    // Three of ten are strictly worse, six others are level. The old code
    // called this "ahead of 30%" and said nothing about the six.
    expect(screen.getByText(/ahead of 30%/)).toBeInTheDocument();
    expect(screen.getByText(/level with 6 more/)).toBeInTheDocument();
  });

  it("draws the marker but claims no percentile outside the population", () => {
    const { container } = render(
      <FieldPosition
        population={CLUSTERED}
        value={95}
        subjectInPopulation={false}
        valueLabel="95.0%"
        measure="Approval rate"
        betterWhen="higher"
        note="middle of 3 decided, not ranked"
      />,
    );
    expect(screen.getByText(/not ranked/)).toBeInTheDocument();
    expect(screen.queryByText(/ahead of/)).toBeNull();
    // The marker is the one absolutely-positioned span in the strip.
    expect(container.querySelectorAll("span.absolute")).toHaveLength(1);
  });

  it("draws no marker at all for a withheld figure", () => {
    const { container } = render(
      <FieldPosition
        population={CLUSTERED}
        value={null}
        valueLabel="not shown"
        measure="Approval rate"
        betterWhen="higher"
        note="under 30 decided"
      />,
    );
    expect(screen.getByText(/under 30 decided/)).toBeInTheDocument();
    expect(container.querySelectorAll("span.absolute")).toHaveLength(0);
  });

  it("refuses to draw a field it cannot describe", () => {
    const { container } = render(
      <FieldPosition population={[1, 2, 3]} value={2} valueLabel="2" measure="x" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

/**
 * An HTML entity written inside a JS STRING ships to the reader verbatim.
 *
 * JSX decodes `&apos;` in element children. It does not decode it inside a
 * string literal, so React escapes the ampersand and the page renders the
 * characters "isn&apos;t". Three of these were live across seven of the ten
 * rendered pages before this gate existed, all in `LimitsPanel` headings,
 * which are passed as data rather than written as JSX.
 */
describe("no HTML entities inside JS string literals", () => {
  const FILES = [
    "src/app/(site)/(public)/perm-employers/[slug]/page.tsx",
    "src/app/(site)/(public)/perm-attorneys/[slug]/page.tsx",
    "src/app/(site)/(public)/perm-wages/[slug]/page.tsx",
    "src/components/tools/EntityContext.tsx",
  ];
  const ENTITY_IN_STRING = /"[^"\n]*&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);[^"\n]*"/;

  /**
   * JSX tags come out FIRST, and that is the whole difficulty.
   *
   * The first version of this predicate flagged
   * `<h2 className="...">They&apos;re handling your case?</h2>` - a line that
   * is perfectly correct, because the entity is JSX text. It matched from the
   * className's closing quote to the next quote on the line. Stripping tags
   * leaves only the text and the real string literals, and an entity is a
   * defect only when it sits inside one of the latter.
   */
  const jsDefect = (line: string): boolean => {
    const t = line.trim();
    if (t.startsWith("*") || t.startsWith("//") || t.startsWith("/*")) return false;
    return ENTITY_IN_STRING.test(line.replace(/<[^>]*>/g, " "));
  };

  it.each(FILES)("%s", (rel) => {
    const lines = readFileSync(join(process.cwd(), rel), "utf8").split("\n");
    const bad = lines.filter(jsDefect).map((l) => l.trim().slice(0, 90));
    // Control: the sweep read a real file, not an empty one.
    expect(lines.length).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  });

  it("catches the defect and spares the two shapes that are fine", () => {
    // Without these three the regex could quietly stop matching and report
    // every file clean, which is exactly how the defect shipped in the first
    // place - and the middle case is the false positive it shipped WITH.
    expect(jsDefect('head: "Volume isn&apos;t quality",')).toBe(true);
    expect(jsDefect('<h2 className="a b">They&apos;re handling it?</h2>{" "}')).toBe(false);
    expect(jsDefect('className="font-bold underline"')).toBe(false);
  });
});

/**
 * The doctrine is positional, so the gate has to be positional too./**
 * The doctrine is positional, so the gate has to be positional too.
 *
 * "Warn and withhold, and the warning renders ABOVE the number" is only true
 * while the band is written above the stat grid in the page source. Nothing in
 * a component test can see that, because the two live in different files, so
 * this reads the pages themselves.
 */
describe("the warning sits above the figures on every entity page", () => {
  const PAGES = [
    "src/app/(site)/(public)/perm-employers/[slug]/page.tsx",
    "src/app/(site)/(public)/perm-attorneys/[slug]/page.tsx",
    "src/app/(site)/(public)/perm-wages/[slug]/page.tsx",
  ];

  it.each(PAGES)("%s puts ReliabilityBand before the stat grid", (rel) => {
    const src = readFileSync(join(process.cwd(), rel), "utf8");
    const band = src.indexOf("<ReliabilityBand");
    const grid = src.indexOf('<section className="pop');
    // Both must be found, or the test passes by failing to see its subject.
    expect(band).toBeGreaterThan(-1);
    expect(grid).toBeGreaterThan(-1);
    expect(band).toBeLessThan(grid);
  });

  // A SERP snippet reading "100.0% approved" over three cases makes, in the
  // one place nobody can see the warning beside it, exactly the claim the page
  // refuses to make. The occupation description carries a wage rather than a
  // rate, so the rule is conditional on the page publishing one at all.
  it.each(PAGES)("%s never puts an unguarded approval rate in its description", (rel) => {
    const src = readFileSync(join(process.cwd(), rel), "utf8");
    if (!src.includes("% approved")) return;
    expect(src).toContain("reliability.ratePct != null");
  });

  it("has at least one page publishing a rate, so the rule above is not vacuous", () => {
    const publishing = PAGES.filter((rel) =>
      readFileSync(join(process.cwd(), rel), "utf8").includes("% approved"),
    );
    expect(publishing.length).toBeGreaterThan(0);
  });
});
