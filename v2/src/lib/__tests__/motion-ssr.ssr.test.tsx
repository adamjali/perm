/**
 * @vitest-environment node
 *
 * Motion on the server, with the real library (the ssr project has no setup
 * file and no motion mock). Motion writes a component's `initial` into the
 * server HTML as an inline style, so `initial={{ opacity: 0 }}` on a wrapper
 * ships its content invisible until scripts run: it once hid 90% of every page.
 * These renders hold the site's own motion users to showing their content, and
 * the canary holds the library to the behaviour the rule exists for, so an
 * upgrade that changes it is noticed rather than assumed.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { motion } from "motion/react";
import { describe, expect, it } from "vitest";

import { SharedProviders } from "@/app/shared-providers";
import ReadingProgress from "@/components/content/ReadingProgress";
import { ScrollToTop } from "@/components/ui/scroll-to-top";

const hidden = /opacity:\s*0(?![.\d])/;

describe("motion on the server", () => {
  it("still writes `initial` into the HTML (the canary: if this changes, the rule's reason has)", () => {
    const html = renderToStaticMarkup(<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>x</motion.div>);
    expect(html).toMatch(hidden);
    // `initial={false}` starts at `animate`, which is how the site's entrances avoid it.
    expect(renderToStaticMarkup(<motion.div initial={false} animate={{ opacity: 1 }}>x</motion.div>)).not.toMatch(hidden);
  });

  it("the providers every page renders inside show their children", () => {
    const html = renderToStaticMarkup(
      <SharedProviders>
        <p>Every PERM case</p>
      </SharedProviders>,
    );
    expect(html).toContain("<p>Every PERM case</p>");
    expect(html).not.toMatch(hidden);
  });

  it("the reading bar is decoration and the back-to-top button waits for a scroll", () => {
    const bar = renderToStaticMarkup(<ReadingProgress />);
    expect(bar).toContain('aria-hidden="true"');
    expect(bar).not.toMatch(hidden);
    expect(renderToStaticMarkup(<ScrollToTop />)).toBe("");
  });
});
