import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import GlobalError from "../global-error";

// The last-resort page replaces the whole document, so it draws the site's own
// look itself, and it names what failed so a screenshot says what to fix
// (owner, Oct 31 2026: a plain grey page that "looks like vercel").

function render(error: Error & { digest?: string }): string {
  return renderToStaticMarkup(<GlobalError error={error} reset={() => {}} />);
}

describe("the last-resort error page", () => {
  it("carries the site's header, a styled card and its own stylesheet", () => {
    const html = render(new Error("boom"));
    expect(html).toContain('<header class="pt-head">');
    expect(html).toContain("<b>PERM</b> Tracker");
    expect(html).toContain("--lime:#2ecc40");
    expect(html).toContain("<title>Something went wrong | PERM Tracker</title>");
    if (process.env.GLOBAL_ERROR_SNAPSHOT) writeFileSync(process.env.GLOBAL_ERROR_SNAPSHOT, `<!doctype html>${html}`);
  });

  it("names what failed, with Next's digest for a server error", () => {
    const html = render(Object.assign(new Error("Cannot read properties of undefined (reading 'x')"), { digest: "1234567" }));
    expect(html).toContain("What failed: Cannot read properties of undefined (reading &#x27;x&#x27;) (ref 1234567)");
  });

  it("an ended session says so and offers sign-in, without the failure line", () => {
    const html = render(new Error("Not authenticated"));
    expect(html).toContain("Your session ended");
    expect(html).toContain('href="/login?expired=1"');
    expect(html).not.toContain("What failed");
  });
});
