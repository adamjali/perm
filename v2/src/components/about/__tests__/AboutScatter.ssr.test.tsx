import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ABOUT_DOCS, AboutScatter } from "../AboutScatter";

describe("AboutScatter on the server", () => {
  const html = renderToStaticMarkup(
    <AboutScatter>
      <figure>portrait</figure>
    </AboutScatter>,
  );

  it("renders the portrait it's given, and six federal pages", () => {
    expect(html).toContain("<figure>portrait</figure>");
    expect(ABOUT_DOCS).toHaveLength(6);
    expect(html.match(/<li /g)?.length).toBe(6);
  });

  it("gives every page alt text, its size and a label naming the agency and the page", () => {
    for (const d of ABOUT_DOCS) {
      expect(d.alt.length).toBeGreaterThan(40);
      expect(html).toContain(`src="${d.src}"`);
      expect(html).toContain(`width="${d.width}"`);
      expect(html).toContain(`height="${d.height}"`);
      expect(html).toContain(`>${d.agency}</span>`);
      expect(html).toContain(`>${d.page}</span>`);
    }
  });

  it("keeps a form number in one piece on the label", () => {
    const forms = ABOUT_DOCS.filter((d) => d.page.startsWith("Form"));
    expect(forms.length).toBe(3);
    for (const f of forms) expect(f.page).not.toContain("-");
  });

  it("draws nothing moved on the server: the drift comes only from scrolling", () => {
    expect(html).not.toMatch(/--drift:\s*\d/);
  });

  it("says what the pages are, in one quiet line", () => {
    expect(html).toContain("The federal pages every figure here comes from, and the forms a case moves through.");
  });
});
