import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FigurePlate } from "@/components/tools/FigurePlate";

import { MoreText, firstSentence, plainText, wordCount } from "../MoreText";

describe("firstSentence", () => {
  it.each([
    ["One thing. Two things.", "One thing."],
    ["The U.S. Department of Labor decides. Then USCIS.", "The U.S. Department of Labor decides."],
    ["A 3.2% rate, e.g. Adobe. Next one.", "A 3.2% rate, e.g. Adobe."],
    ["No full stop at all", "No full stop at all"],
    ["Quoted. “Next” starts here.", "Quoted."],
  ])("%s", (text, want) => {
    expect(firstSentence(text)).toBe(want);
  });
});

describe("plainText and wordCount", () => {
  it("reads strings through elements and arrays, and skips booleans", () => {
    const node = (
      <>
        Filed <b>today</b>, {3} {false} days <a href="/x">ago</a>.
      </>
    );
    expect(plainText(node).replace(/\s+/g, " ")).toBe("Filed today, 3 days ago.");
    expect(wordCount(node)).toBe(5);
  });
});

describe("MoreText", () => {
  it("shows the gist, keeps every original word in the HTML, and starts closed", () => {
    const html = renderToStaticMarkup(
      <MoreText gist="Short version.">
        <p>The long original note, word for word.</p>
      </MoreText>,
    );
    expect(html).toContain("Short version.");
    expect(html).toContain("The long original note, word for word.");
    expect(html).not.toMatch(/<details[^>]*\bopen\b/);
  });
});

describe("FigurePlate captions", () => {
  const long =
    "Each bar counts sponsors at that value. Sponsors with fewer than 30 decided cases are left out of the population rather than plotted, because a rate over a handful of cases lands wherever the handful landed. The line marks this one.";

  it("folds a long caption to its first sentence, the rest still in the HTML", () => {
    const html = renderToStaticMarkup(
      <FigurePlate n="02" title="Position" caption={long}>
        <svg />
      </FigurePlate>,
    );
    expect(html).toContain("<details");
    expect(html).toContain("Each bar counts sponsors at that value.");
    expect(html).toContain("lands wherever the handful landed");
  });

  it("leaves a short caption as it is", () => {
    const html = renderToStaticMarkup(
      <FigurePlate n="01" title="Queue" caption="Counted from DOL's live status.">
        <svg />
      </FigurePlate>,
    );
    expect(html).not.toContain("<details");
  });
});
