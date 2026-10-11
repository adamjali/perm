/**
 * The emails speak in the site's voice: sentence case, no emoji, nothing
 * shouting. Until Oct 11 2026 the daily deadline email went out as
 * "1 PERM deadline need your attention" with a "⚠️ THIS WEEK (1)" bar, and the
 * buttons read "VIEW CASE", "Create Your First Case" and "View All Cases".
 *
 * Small tracked labels (the alert stamps' "Was" / "Now", field labels) keep
 * their capitals: they are the email form of the site's mono labels. Buttons,
 * banners and section bars never do.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const EMAILS = join(ROOT, "src/emails");
const files = [
  ...readdirSync(EMAILS).filter((f) => f.endsWith(".tsx")).map((f) => join(EMAILS, f)),
  ...readdirSync(join(EMAILS, "components")).filter((f) => /\.tsx?$/.test(f)).map((f) => join(EMAILS, "components", f)),
];
// Pictographs and symbols, written raw or as numeric entities (&#128075; is 👋, &#9888; is ⚠).
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|&#(?:9[7-9]\d\d|1[0-2]\d{3}|12[89]\d{3}|1[3-9]\d{4});/u;

describe("email voice", () => {
  it("reads every template", () => {
    expect(files.length).toBeGreaterThan(25);
  });

  it("carries no emoji in any template", () => {
    const hits = files.flatMap((f) =>
      readFileSync(f, "utf8").split("\n").flatMap((ln, i) =>
        EMOJI.test(ln) && !/^\s*(\/\/|\*|\/\*)/.test(ln) ? [`${f.slice(ROOT.length + 1)}:${i + 1}: ${ln.trim()}`] : [],
      ),
    );
    expect(hits).toEqual([]);
  });

  it("never capitalises a button, banner or section bar", () => {
    const hits: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\n {2}(\w+): \{([^}]*)\}/g)) {
        const [, key, body] = m;
        if (/button|cta|banner|header(text)?$/i.test(key!) && /textTransform:\s*["']uppercase/.test(body!)) {
          hits.push(`${f.slice(ROOT.length + 1)}: ${key}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("never exclaims (\"Welcome!\", \"Good Morning, Jordan!\", \"Test Email Successful!\" until Oct 11 2026)", () => {
    // A word followed by "!" and then the end of the line, a tag or a quote is
    // copy; "!=" and "!x" are code.
    const hits = files.flatMap((f) =>
      readFileSync(f, "utf8").split("\n").flatMap((ln, i) =>
        /[A-Za-z0-9]!(\s*$|\s*<|["'`])/.test(ln) && !/^\s*(\/\/|\*|\/\*)/.test(ln)
          ? [`${f.slice(ROOT.length + 1)}:${i + 1}: ${ln.trim()}`]
          : [],
      ),
    );
    expect(hits).toEqual([]);
  });

  it("puts no emoji in a subject the backend sets", () => {
    const convex = join(ROOT, "convex");
    const hits = readdirSync(convex)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .flatMap((f) =>
        readFileSync(join(convex, f), "utf8").split("\n").flatMap((ln, i) =>
          /subject\s*[:=]/.test(ln) && EMOJI.test(ln) ? [`convex/${f}:${i + 1}`] : [],
        ),
      );
    expect(hits).toEqual([]);
  });
});
