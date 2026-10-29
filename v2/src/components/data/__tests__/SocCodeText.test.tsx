import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { SocCodeText } from "../SocCodeText";

describe("SocCodeText", () => {
  it("keeps each occupation code on one line and the words as written", () => {
    const html = renderToStaticMarkup(<SocCodeText text="15-1132 and 15-1133 also covered 15-1253 (Software testers)." />);
    expect(html.match(/<span class="whitespace-nowrap">15-11\d\d<\/span>/g)).toHaveLength(2);
    expect(html).toContain('<span class="whitespace-nowrap">15-1253</span>');
    expect(html.replace(/<[^>]+>/g, "")).toBe("15-1132 and 15-1133 also covered 15-1253 (Software testers).");
  });
});
