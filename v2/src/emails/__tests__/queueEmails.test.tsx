// @vitest-environment jsdom
/**
 * Queue-alert email templates.
 *
 * These assert the things that are expensive to discover in production: a link
 * that resolves nowhere, a house-style violation shipped to a real inbox, or a
 * figure hardcoded into a template instead of arriving as a prop.
 *
 * Every gate here is probed with an input that must fail it. A check that
 * cannot fail is decoration, and this file's own emoji and dash checks were
 * both written wrong the first time.
 *
 * @module
 */

import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import { QueueAlertConfirm } from "../QueueAlertConfirm";
import { QueueReached } from "../QueueReached";

const CONFIRM_URL = "https://example.convex.site/queue-alert/confirm?token=abc";
const UNSUB_URL = "https://example.convex.site/queue-alert/unsubscribe?token=abc";

const confirmProps = {
  filingMonth: "September 2024",
  confirmUrl: CONFIRM_URL,
};

/** The ordinary case: DOL has run past this subscriber's month. */
const alertProps = {
  frontierMonth: "November 2024",
  filingMonth: "September 2024",
  asOf: "August 20, 2026",
  monthsPast: 2,
  paceLine: "DOL\u2019s queue has moved 3 months over the last 6 months.",
  unsubscribeUrl: UNSUB_URL,
};

/** The exact-landing case, where a second month block would say nothing. */
const alertPropsEqual = {
  frontierMonth: "September 2024",
  filingMonth: "September 2024",
  asOf: "August 20, 2026",
  monthsPast: 0,
  paceLine: null,
  unsubscribeUrl: UNSUB_URL,
};

async function renderBoth() {
  return {
    confirm: await render(QueueAlertConfirm(confirmProps)),
    alert: await render(QueueReached(alertProps)),
  };
}

/** Every `href` in a rendered document, in source order. */
function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1] as string);
}

/**
 * Emoji, by Unicode property rather than by a hand-listed range.
 *
 * Two wrong versions preceded this one. `[\u{1F300}-\u{1FAFF}]` misses the
 * ones most likely to reach an email by accident, since the warning sign, the
 * check mark and the pointing hand all sit below U+1F300. Then
 * `\p{Extended_Pictographic}` failed these templates on their first run over
 * the `©` in the shared footer, because that property includes symbols that
 * default to TEXT presentation: `©`, `®` and `™` are all in it.
 *
 * `Emoji_Presentation` is the set that renders as emoji by default, and
 * U+FE0F is the selector that forces emoji presentation onto the rest. Between
 * them they catch `🚀` and `⚠️` and leave `©` alone.
 */
const EMOJI = /\p{Emoji_Presentation}|\uFE0F/u;

/** Em dash and en dash. House style permits neither. */
const LONG_DASH = /[—–]/;

describe("queue email templates", () => {
  it("both render", async () => {
    const { confirm, alert } = await renderBoth();
    expect(confirm.length).toBeGreaterThan(500);
    expect(alert.length).toBeGreaterThan(500);
  });

  // -------------------------------------------------------------------------
  // Links
  // -------------------------------------------------------------------------

  describe("links", () => {
    it("every href is absolute https", async () => {
      const { confirm, alert } = await renderBoth();
      for (const [name, html] of [["confirm", confirm], ["alert", alert]] as const) {
        const found = hrefs(html);
        expect(found.length, `${name} should carry links`).toBeGreaterThan(2);
        for (const h of found) {
          expect(h, `${name}: ${h}`).toMatch(/^https:\/\//);
        }
      }
    });

    it("every first-party link is on permtracker.app", async () => {
      const { confirm, alert } = await renderBoth();
      // The only hosts allowed to appear: our own site, DOL's own page (the
      // source of the figure in the alert), and the Convex HTTP domain, which
      // is where confirm and unsubscribe actually run.
      const allowed = new Set(["permtracker.app", "flag.dol.gov", "example.convex.site"]);
      for (const html of [confirm, alert]) {
        for (const h of hrefs(html)) {
          expect(allowed, h).toContain(new URL(h).host);
        }
      }
    });

    it("uses no shortener and no tracking redirect", async () => {
      const { confirm, alert } = await renderBoth();
      // A mismatched or wrapped link domain is one of the few things that
      // genuinely does hurt deliverability here, so it is worth a gate.
      for (const html of [confirm, alert]) {
        for (const h of hrefs(html)) {
          expect(h).not.toMatch(/bit\.ly|t\.co|tinyurl|lnkd\.in|\/r\/|[?&](url|redirect|u)=/i);
        }
      }
    });

    it("carries the action URL it was handed, unmodified", async () => {
      const { confirm, alert } = await renderBoth();
      expect(hrefs(confirm)).toContain(CONFIRM_URL);
      expect(hrefs(alert)).toContain(UNSUB_URL);
    });

    it("points the alert at DOL's own page for the figure it quotes", async () => {
      const { alert } = await renderBoth();
      expect(hrefs(alert)).toContain("https://flag.dol.gov/processingtimes");
    });

    it("has no vague link text", async () => {
      const { confirm, alert } = await renderBoth();
      // A link read out of context has to still mean something.
      for (const html of [confirm, alert]) {
        expect(html).not.toMatch(/>\s*(click here|here|read more|learn more)\s*</i);
      }
    });

    it("does not route the alert's CTA and its link list to the same page", async () => {
      const { alert } = await renderBoth();
      // Two controls with one destination is a duplicated CTA, and it was in
      // the first draft: the button and the list both went to the figures page.
      const site = hrefs(alert).filter((h) => h.startsWith("https://permtracker.app"));
      expect(new Set(site).size).toBe(site.length);
    });
  });

  // -------------------------------------------------------------------------
  // House style
  // -------------------------------------------------------------------------

  describe("house style", () => {
    it("contains no emoji", async () => {
      const { confirm, alert } = await renderBoth();
      expect(EMOJI.test(confirm)).toBe(false);
      expect(EMOJI.test(alert)).toBe(false);
    });

    it("contains no em dash or en dash", async () => {
      const { confirm, alert } = await renderBoth();
      expect(LONG_DASH.test(confirm)).toBe(false);
      expect(LONG_DASH.test(alert)).toBe(false);
    });

    it("PROBE: the emoji and dash gates fail on input that should fail them", () => {
      // Without this, both checks above pass for a template that renders
      // nothing at all.
      expect(EMOJI.test("shipped ⚠️ today")).toBe(true);
      expect(EMOJI.test("shipped \u{1F680} today")).toBe(true);
      expect(LONG_DASH.test("one — two")).toBe(true);
      expect(LONG_DASH.test("range 2024–2026")).toBe(true);
      expect(EMOJI.test("plain ascii text")).toBe(false);
      expect(LONG_DASH.test("a hyphen - is fine")).toBe(false);
      // The false positive this gate actually produced on its first run.
      expect(EMOJI.test("© 2026 PERM Tracker")).toBe(false);
      expect(EMOJI.test("PERM Tracker™ and ®")).toBe(false);
    });

    it("uses contractions", async () => {
      const { confirm, alert } = await renderBoth();
      expect(alert).toMatch(/isn(’|&rsquo;|&#x27;|')t/);
      expect(confirm).toMatch(/we(’|&rsquo;|&#x27;|')ll/);
    });
  });

  // -------------------------------------------------------------------------
  // Truth discipline
  // -------------------------------------------------------------------------

  describe("truth discipline", () => {
    it("states the figure with its as-of date and its source", async () => {
      const { alert } = await renderBoth();
      expect(alert).toContain("November 2024");
      expect(alert).toContain("August 20, 2026");
      expect(alert).toContain("flag.dol.gov/processingtimes");
    });

    it("says plainly that reaching a month is neither a decision nor a prediction", async () => {
      const { alert } = await renderBoth();
      const text = alert.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      expect(text).toMatch(/n(’|&rsquo;|')t a decision on your case/);
      expect(text).toMatch(/n(’|&rsquo;|')t a prediction of one/);
    });

    it("shows both months, so a frontier past the filing month is visible", async () => {
      const { alert } = await renderBoth();
      expect(alert).toContain("November 2024"); // DOL's frontier
      expect(alert).toContain("September 2024"); // the subscriber's month
    });

    it("hardcodes no month, date or figure", async () => {
      // Every figure must arrive as a prop. A literal here is a number that
      // goes stale silently.
      const other = await render(
        QueueReached({
          frontierMonth: "March 2031",
          filingMonth: "January 2030",
          asOf: "February 2, 2032",
          unsubscribeUrl: UNSUB_URL,
        }),
      );
      for (const stale of ["November 2024", "September 2024", "August 20, 2026"]) {
        expect(other, `template leaked ${stale}`).not.toContain(stale);
      }
      expect(other).toContain("March 2031");
    });

    it("makes no claim about when a decision will arrive", async () => {
      const { alert } = await renderBoth();
      const text = alert.replace(/<[^>]+>/g, " ");
      expect(text).not.toMatch(/will be (approved|decided|certified)/i);
      expect(text).not.toMatch(/expect(ed)? (a )?(decision|approval)/i);
      expect(text).not.toMatch(/\b(soon|shortly|any day)\b/i);
    });
  });

  // -------------------------------------------------------------------------
  // Rendering contract
  // -------------------------------------------------------------------------

  describe("rendering contract", () => {
    it("spends the brand fill on one stamp per email", async () => {
      const { confirm, alert } = await renderBoth();
      // The lime block. The confirmation also spends lime on its button, which
      // is why this counts the stamp class rather than the colour.
      expect((confirm.match(/qa-stamp"/g) ?? []).length).toBe(1);
      expect((alert.match(/qa-stamp"/g) ?? []).length).toBe(1);
    });

    it("labels the brand fill in ink, never white", async () => {
      const { confirm, alert } = await renderBoth();
      // White on #2ECC40 measures 2.14:1. Ink on the same lime is 9.82:1.
      for (const html of [confirm, alert]) {
        const stamp = /background-color:#2ECC40[^"]*"/.exec(html)?.[0] ?? "";
        expect(stamp).not.toMatch(/color:\s*#f{3,6}/i);
        expect(html).toContain("#000001");
      }
    });

    it("uses tables and no flexbox or grid", async () => {
      const { confirm, alert } = await renderBoth();
      for (const html of [confirm, alert]) {
        expect(html).toContain("<table");
        expect(html).not.toMatch(/display:\s*(flex|grid)/);
      }
    });

    it("declares a preview line and does not leave it empty", async () => {
      const { confirm, alert } = await renderBoth();
      for (const html of [confirm, alert]) {
        // react-email renders the preview into a hidden div at the top.
        expect(html).toMatch(/display:none/);
      }
      expect(confirm).toContain("September 2024");
      expect(alert).toContain("August 20, 2026");
    });

    it("keeps the confirmation's opt-out promise", async () => {
      const { confirm } = await renderBoth();
      const text = confirm.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      expect(text).toMatch(/ignore it\. Nothing will be sent\./);
    });

    it("gives the alert a visible opt-out to pair with List-Unsubscribe", async () => {
      const { alert } = await renderBoth();
      expect(alert).toContain(UNSUB_URL);
      expect(alert.replace(/<[^>]+>/g, " ")).toMatch(/Remove this address/);
    });

    it("makes the opt-out a 44px tap target", async () => {
      const { alert } = await renderBoth();
      // 18px line box plus 13px of padding top and bottom. `inline-block` is
      // what puts the padding inside the hit box; measured at 18px without it.
      const link = /<a[^>]*href="[^"]*unsubscribe[^"]*"[^>]*>/.exec(alert)?.[0] ?? "";
      expect(link, "opt-out link not found").not.toBe("");
      expect(link).toMatch(/display:inline-block/);
      expect(link).toMatch(/padding:13px/);
    });

    it("keeps every standalone control at or above 44px", async () => {
      const { confirm, alert } = await renderBoth();
      // The alert's link-list rows: 20px line box plus 13px padding each side.
      // The confirm email has no link list by design, so it is checked for the
      // footer links instead, which are the only standalone controls it has
      // besides the button.
      expect(alert).toMatch(/padding-top:13px/);
      expect(alert).toMatch(/padding-bottom:13px/);
      for (const html of [confirm, alert]) {
        expect(html, "footer links must be inline-block with padding").toMatch(
          /display:inline-block;padding:13px 10px/,
        );
      }
    });
  });
});

// ---------------------------------------------------------------------------
// The two cases the alert must not confuse
// ---------------------------------------------------------------------------

describe("alert: frontier past the filing month vs landed on it", () => {
  it("does not claim the case is being adjudicated once DOL has moved past", async () => {
    const html = await render(QueueReached(alertProps));
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    // The sentence that was false for every subscriber DOL had run past.
    expect(text).not.toMatch(/adjudicating cases filed/);
    expect(text).toMatch(/worked past September 2024 and is now on November 2024/);
  });

  it("does claim it when DOL landed exactly on the month", async () => {
    const html = await render(QueueReached(alertPropsEqual));
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(text).toMatch(/adjudicating cases filed in September 2024/);
  });

  it("drops the second month block when the months are the same", async () => {
    const equal = await render(QueueReached(alertPropsEqual));
    const past = await render(QueueReached(alertProps));
    expect(equal).not.toContain("Your filing month");
    expect(past).toContain("Your filing month");
  });

  it("keeps the disclaimer in both cases", async () => {
    for (const props of [alertProps, alertPropsEqual]) {
      const text = (await render(QueueReached(props))).replace(/<[^>]+>/g, " ");
      expect(text).toMatch(/n(\u2019|&rsquo;|')t a decision on your case/);
      expect(text).toMatch(/n(\u2019|&rsquo;|')t a prediction of one/);
    }
  });
});

describe("alert: the measured pace line", () => {
  it("states a measured rate when one is supplied", async () => {
    const html = await render(QueueReached(alertProps));
    expect(html).toContain("moved 3 months over the last 6 months");
  });

  it("renders nothing when there is no measurement", async () => {
    const html = await render(QueueReached(alertPropsEqual));
    expect(html).not.toMatch(/queue has moved/);
  });

  it("never turns the rate into a date for this reader", async () => {
    const text = (await render(QueueReached(alertProps))).replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/you(\u2019|')?ll be reached/i);
    expect(text).not.toMatch(/expect(ed)? (a )?(decision|approval)/i);
    expect(text).not.toMatch(/\b(by|around) (January|February|March|April|May|June|July|August|September|October|November|December)\b/);
  });
});

describe("confirm: one job", () => {
  it("carries no onward links, only the confirm action", async () => {
    const html = await render(QueueAlertConfirm(confirmProps));
    const site = hrefs(html).filter((h) => h.startsWith("https://permtracker.app"));
    // Privacy, terms and "Open PERM Tracker" are the shared footer. What must
    // not be here is a content link competing with the confirm button.
    expect(site.filter((h) => /perm-processing-times|tools\//.test(h))).toEqual([]);
    expect(hrefs(html)).toContain(CONFIRM_URL);
  });
});

describe("typography", () => {
  it("uses one apostrophe, the curly one, everywhere", async () => {
    const { confirm, alert } = await renderBoth();
    for (const [name, html] of [["confirm", confirm], ["alert", alert]] as const) {
      const visible = html.replace(/<[^>]+>/g, " ");
      // A straight apostrophe between letters is the defect: the body copy
      // rendered curly while the template literals in props rendered straight,
      // so one email carried both.
      const straight = visible.match(/[A-Za-z]'[A-Za-z]/g) ?? [];
      expect(straight, `${name} mixes apostrophes: ${straight.join(", ")}`).toEqual([]);
    }
  });

  it("PROBE: the apostrophe gate matches a straight one and not a curly one", () => {
    expect(/[A-Za-z]'[A-Za-z]/.test("DOL's queue")).toBe(true);
    expect(/[A-Za-z]'[A-Za-z]/.test("DOL\u2019s queue")).toBe(false);
  });
});
