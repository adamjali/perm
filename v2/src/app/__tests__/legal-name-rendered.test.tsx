import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AccessibilityPage from "@/app/(site)/(public)/accessibility/page";
import ApiTermsPage from "@/app/(site)/(public)/api-terms/page";
import TermsPage from "@/app/(site)/(public)/terms/page";

/**
 * What a reader sees, not what the source says. On Oct 31 2026 the Terms read
 * "operated byAsolys LLC": "operated by" ended one source line and the name
 * began the next, and JSX drops the space between them. The source test passed.
 */
function text(el: React.ReactElement): string {
  const html = renderToStaticMarkup(el);
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ");
}

describe("the operator, as the pages read", () => {
  it("the Terms name it with its spaces", () => {
    const t = text(<TermsPage />);
    expect(t).toContain("operated by Asolys LLC, doing business as PERM Tracker (");
    expect(t).toContain("hold harmless Asolys LLC, doing business as PERM Tracker, and its operators");
    expect(t).toContain("agreement between you and Asolys LLC regarding the Service");
  });

  it("the API terms and the accessibility statement name it the same way", () => {
    expect(text(<ApiTermsPage />)).toContain("provided by Asolys LLC, doing business as PERM Tracker, a Florida limited liability company");
    expect(text(<AccessibilityPage />)).toContain("Operated by Asolys LLC, doing business as PERM Tracker.");
  });
});
