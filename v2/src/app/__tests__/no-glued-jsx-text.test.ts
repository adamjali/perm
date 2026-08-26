import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Adjacent JSX elements are separated by something.
 *
 * JSX strips the whitespace between two elements written on separate lines, so
 *
 *     <h3>Prevailing wage</h3>
 *     <p>How many requests are ahead of mine?</p>
 *
 * reaches the DOM with nothing between the two, and every extractor that walks
 * the DOM reads "Prevailing wageHow many requests are ahead of mine?" as one
 * word. Google has reproduced the glued form verbatim in a search listing. CSS
 * hides it completely, because the children are block or flex, so it looks
 * correct in a browser and is wrong everywhere that matters.
 *
 * A sweep fixed 609 of these across the app, and four new ones were introduced
 * in a component written days later. That is what makes it worth a gate rather
 * than a habit.
 *
 * The fix is an explicit `{" "}` after the closing tag.
 */

const ROOTS = ["src"];

/**
 * Tags whose text an extractor concatenates with its neighbour.
 *
 * `motion.h1` renders an `<h1>`, so it glues exactly like one. Leaving the
 * dotted form out is why every content index shipped "BlogBlog Posts": the
 * source reads `</motion.span>` then a comment then `<motion.h1>`, and the
 * pattern matched none of those three things.
 */
const BASE = "h1|h2|h3|h4|h5|h6|p|span|a|li|dt|dd|strong|b|em";
const TAGS = `(?:motion\\.)?(?:${BASE})`;

/**
 * A JSX comment renders nothing, so it does not separate two elements — but it
 * does stop a whitespace-only pattern from matching.
 *
 * This gate reported clean while the homepage shipped
 * "30-Day Audit ResponseMiss the DOL's 30-day audit window", because the source
 * reads `</h3>` then `{/* Consequence *\/}` then `<p>`. Twenty-six pairs across
 * twenty-one files were hidden this way, and the pattern is house style here.
 */
const GAP = `(?:\\s|\\{/\\*[\\s\\S]*?\\*/\\})*`;

/**
 * A closing tag followed by an opening tag with nothing but whitespace and
 * comments between them, and no `{" "}` separator.
 */
const GLUED = new RegExp(
  `</${TAGS}>${GAP}\\n${GAP}<${TAGS}[\\s>]`,
  "g",
);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("adjacent JSX elements are separated", () => {
  const files = walk(ROOTS[0]!).filter(
    (f) => !/\.test\.tsx$|__tests__|\.stories\./.test(f),
  );

  it("scans a plausible number of components", () => {
    // A gate that cannot see its subject reads exactly like a pass.
    expect(files.length).toBeGreaterThan(100);
  });

  it("finds no glued pairs anywhere in src", () => {
    // Scoped to this session's own directories at first, which is how six
    // pairs shipped on a page the gate was not looking at and another 207 sat
    // across the rest of the app while it reported clean. The whole tree is
    // swept now, so the scope is the whole tree.
    const offenders = files
      .map((f) => {
        const hits = readFileSync(f, "utf8").match(GLUED);
        return hits ? `${f}: ${hits.length} (${hits[0]!.trim().slice(0, 40)})` : null;
      })
      .filter(Boolean);

    expect(offenders).toEqual([]);
  });
});
