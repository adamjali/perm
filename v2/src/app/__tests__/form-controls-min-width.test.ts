import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Form controls cannot overflow a grid or flex track.
 *
 * A grid or flex item defaults to `min-width: auto`, which means it will not
 * shrink below its intrinsic content width. Form controls have an intrinsic
 * width set by the user agent, and WebKit's is wider than Blink's for date
 * inputs in particular. The result is a field that sits correctly inside its
 * container on a desktop browser and hangs past the right padding on an
 * iPhone, where every browser is WebKit.
 *
 * Reported from Chrome on iOS as "the text field doesn't have proper spacing
 * on the right side", and invisible in desktop emulation: measured there, the
 * input's box was exactly right.
 *
 * `min-width: 0` is the fix, and the app's own `DateInput` already carried it,
 * which is the strongest argument for using that component rather than a raw
 * `<input type="date">`.
 */

const ROOTS = ["src"];
const DATE_TYPES = ["date", "time", "datetime-local", "month"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/**
 * Every opening `<input>`, `<select>` and `<textarea>` tag, with its whole
 * attribute list.
 *
 * This cannot be a regex. The first version was
 * `/<(input|select|textarea)\b((?:[^<>]|\n)*?)\/?>/g`, which ends the capture
 * at the first `>` — and `onChange={(e) => setDue(e.target.value)}` contains
 * one. So every attribute written after a handler was invisible, and a control
 * that had been fixed was reported as broken. The mirror of that failure is the
 * one that matters: a control that is genuinely broken, with its `min-w-0`
 * written before a handler, would have been reported clean.
 *
 * Walking the tag with a brace and quote depth counter is the only way to find
 * where the tag actually ends.
 */
function openingTags(source: string): { tag: string; attrs: string }[] {
  const out: { tag: string; attrs: string }[] = [];
  const NAME = /<(input|select|textarea)\b/g;
  for (const m of source.matchAll(NAME)) {
    const from = m.index! + m[0].length;
    let depth = 0;
    let quote: string | null = null;
    for (let i = from; i < source.length; i += 1) {
      const c = source[i]!;
      if (quote) {
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth += 1;
      else if (c === "}") depth -= 1;
      else if (c === ">" && depth === 0) {
        out.push({ tag: m[1]!, attrs: source.slice(from, i) });
        break;
      }
    }
  }
  return out;
}

/**
 * Comments are not markup.
 *
 * The first run of this gate reported three offenders in a file whose raw
 * inputs had all been replaced, because the replacement carried a comment
 * saying `not a raw <input type="date">`. A gate that flags the note
 * explaining the fix is worse than no gate: it trains you to ignore it.
 */
function stripComments(source: string): string {
  return source.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "");
}

/**
 * Same-file string constants, so a shared class list can be seen through.
 *
 * A control that writes `className={`${CONTROL} mt-1`}` has whatever `CONTROL`
 * holds, but a literal scan of the attrs sees only the interpolation. That is
 * not a cosmetic blind spot: it means the gate would MISS a real violation in
 * every component that factors its class list out, which is most of them. Two
 * date inputs in ChangeFeedBrowser were reported as offenders while carrying
 * `min-w-0` through exactly this route.
 *
 * Only same-file `const X = "..."` is resolved. An imported constant is left
 * unresolved and therefore still reported, which is the safe direction: a
 * false positive is read and fixed, a false negative ships.
 */
function localConstants(source: string): Map<string, string> {
  const out = new Map<string, string>();
  // ONE NON-GREEDY RUN TO THE SEMICOLON, not a repeated group of alternated
  // string literals. The nested quantifier that shape needs is the classic
  // backtracking blow-up, and `security/detect-unsafe-regex` says so. This
  // reads a whole `const X = ...;` and strips the quotes afterwards, which is
  // all the check needs: it only asks whether `min-w-0` is in there.
  const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]{0,2000});/g;
  for (const m of source.matchAll(re)) {
    out.set(m[1]!, m[2]!.replace(/["'`]/g, " "));
  }
  return out;
}

/** Expand `${NAME}` against same-file constants, one level deep. */
function expand(attrs: string, consts: Map<string, string>): string {
  return attrs.replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (whole, name: string) =>
    consts.has(name) ? ` ${consts.get(name)!} ` : whole,
  );
}

/** Either a utility class or an inline style satisfies the requirement. */
function hasMinWidthZero(attrs: string): boolean {
  return /\bmin-w-0\b/.test(attrs) || /minWidth:\s*0/.test(attrs);
}

describe("form controls cannot overflow their track", () => {
  const files = walk(ROOTS[0]!).filter(
    (f) => !/\.test\.tsx$|__tests__|\.stories\./.test(f),
  );

  it("scans a plausible number of components", () => {
    // A gate that cannot see its subject reads exactly like a pass.
    expect(files.length).toBeGreaterThan(100);
  });

  it("gives every date-like input a minimum width of zero", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = stripComments(readFileSync(file, "utf8"));
      const consts = localConstants(source);
      for (const { tag, attrs: raw } of openingTags(source)) {
        const attrs = expand(raw, consts);
        const type = /type="([^"]+)"/.exec(attrs)?.[1];
        if (!type || !DATE_TYPES.includes(type)) continue;
        if (hasMinWidthZero(attrs)) continue;
        offenders.push(`${file}: <${tag} type="${type}">`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("gives every full-width control a minimum width of zero", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = stripComments(readFileSync(file, "utf8"));
      for (const { tag, attrs } of openingTags(source)) {
        if (!/\bw-full\b/.test(attrs)) continue;
        if (hasMinWidthZero(attrs)) continue;
        offenders.push(`${file}: <${tag}>`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
