"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";

import { BADGE_THEMES, type BadgeStyle, type BadgeTheme } from "@/lib/badge";
import { choiceVariants } from "@/components/ui/choice";
import { buttonVariants } from "@/components/ui/button";

/**
 * The catalogue: pick a shape, a theme and a snippet format once, and every
 * badge on the page answers to it.
 *
 * WHY THE CONTROLS ARE SHARED RATHER THAN PER BADGE. The page this replaces
 * printed a Markdown block AND an HTML block under each of three badges - six
 * code walls, and a page that was almost entirely chrome for copying. Thirty-
 * nine badges that way is unreadable. None of these three choices is a
 * property of WHICH badge you want; they are properties of where you are
 * pasting it and what your page looks like. So they are one set of controls,
 * and each badge keeps only what is specific to it: the picture, what the
 * number means, and one line to copy.
 *
 * Every preview is the SAME SVG the route serves, rendered inline from the
 * page's own single read. Not `<img src="/badge/...">`: that would be a
 * request per badge per variant for figures the page already has, and it would
 * let the preview drift from the real thing.
 */

export type SnippetFormat = "markdown" | "html" | "url";

export interface BadgeVariant {
  style: BadgeStyle;
  theme: BadgeTheme;
  /** The rendered SVG, exactly as the route serves it. */
  svg: string;
  /** The path segment for this variant, e.g. `perm-queue.card.light`. */
  path: string;
}

export interface BadgeRow {
  kind: string;
  group: string;
  label: string;
  meaning: string;
  href: string;
  unavailable: boolean;
  /** Every shape this figure supports, in both themes. */
  variants: BadgeVariant[];
  /** The shapes offered, in order, for the picker to fall back through. */
  styles: BadgeStyle[];
}

const FORMATS: { id: SnippetFormat; label: string; hint: string }[] = [
  { id: "markdown", label: "Markdown", hint: "READMEs, GitHub and Reddit" },
  { id: "html", label: "HTML", hint: "a web page or a forum signature" },
  { id: "url", label: "Image URL", hint: "Notion, Slack, anywhere that takes a link" },
];

const STYLE_LABELS: Record<BadgeStyle, string> = {
  shield: "Strip",
  card: "Card",
  bar: "Share of pending",
};

const STYLE_HINTS: Record<BadgeStyle, string> = {
  shield: "The 20px strip. Sits inline next to text.",
  card: "The figure large, with who published it and when.",
  bar: "The count, and how much of everything pending it is.",
};

function snippet(row: BadgeRow, v: BadgeVariant, format: SnippetFormat, origin: string): string {
  const src = `${origin}/badge/${v.path}.svg`;
  const page = `${origin}${row.href}`;
  if (format === "url") return src;
  if (format === "html") return `<a href="${page}"><img src="${src}" alt="${row.label}, from PERM Tracker"></a>`;
  return `[![${row.label}](${src})](${page})`;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={choiceVariants({ on: active })}
    >
      {children}{" "}
    </button>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      // Clipboard access can be refused: an insecure origin, a permission
      // policy, an older browser. Say so rather than showing a success that
      // did not happen. The snippet is selectable either way.
      setState("failed");
      setTimeout(() => setState("idle"), 4000);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      className={buttonVariants({ variant: "outline", size: "default", className: "shrink-0" })}
    >
      {state === "copied" ? <CheckIcon size={16} weight="bold" aria-hidden="true" /> : <CopyIcon size={16} weight="bold" aria-hidden="true" />}
      {state === "copied" ? "Copied" : state === "failed" ? "Select the line to copy" : "Copy"}
    </button>
  );
}

/**
 * A group whose labels read "<category> <place>" (the visa bulletin's EB1 to
 * EB3 by country) as one matrix: categories down, places across, each cell the
 * badge itself. Picking a cell fills ONE copy line under the matrix. As cards,
 * fifteen badges repeated one sentence fifteen times and ran a phone past
 * 5,000 px; the matrix says it once and keeps the grid the data already has.
 * Null when the labels don't split cleanly, so the caller falls back to cards.
 */
function matrixOf(rows: BadgeRow[]): { cats: string[]; places: string[]; at: (c: string, p: string) => BadgeRow | null } | null {
  const parts = rows.map((r) => {
    const m = /^(\S+)\s+(.+)$/.exec(r.label);
    return m ? { row: r, cat: m[1]!, place: m[2]! } : null;
  });
  if (parts.some((p) => p === null) || rows.length < 6) return null;
  const ok = parts as { row: BadgeRow; cat: string; place: string }[];
  const cats = [...new Set(ok.map((p) => p.cat))];
  const places = [...new Set(ok.map((p) => p.place))];
  // Only a real grid: at least two of each, and most cells filled.
  if (cats.length < 2 || places.length < 2 || ok.length < cats.length * places.length * 0.75) return null;
  return {
    cats,
    places,
    at: (c, p) => ok.find((x) => x.cat === c && x.place === p)?.row ?? null,
  };
}

function MatrixGroup({
  rows,
  variantFor,
  format,
  origin,
  theme,
}: {
  rows: BadgeRow[];
  variantFor: (row: BadgeRow) => BadgeVariant | null;
  format: SnippetFormat;
  origin: string;
  theme: BadgeTheme;
}) {
  const grid = matrixOf(rows)!;
  const [picked, setPicked] = useState(rows[0]!.kind);
  const row = rows.find((r) => r.kind === picked) ?? rows[0]!;
  const v = variantFor(row);
  const code = v ? snippet(row, v, format, origin) : "";
  const ground = theme === "dark" ? "bg-black" : "bg-white";
  return (
    <div className="mt-5 border border-border bg-card">
      <p className="border-b border-border p-4 text-sm leading-relaxed text-soft">
        {`The final action cutoff the State Department published for each category and country. A priority date earlier than its cutoff has a visa number available. Pick a badge for its line.`}
      </p>{" "}
      <div className="overflow-x-auto overscroll-x-none">
        {/* Fixed columns, and each badge scales down to its cell (the SVGs
            carry a viewBox), so five places fit a desktop column; a phone
            scrolls the table inside its own box. */}
        <table className="w-full min-w-[44rem] table-fixed border-collapse text-sm">
          <caption className="sr-only">{`Visa bulletin badges by category and country. Pick one to copy its line.`}</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="w-24 p-3 text-left font-heading font-bold">Category{" "}</th>
              {grid.places.map((place) => (
                <th key={place} scope="col" className="p-3 text-left font-heading font-bold">
                  {`${place.charAt(0).toUpperCase()}${place.slice(1)} `}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.cats.map((cat) => (
              <tr key={cat} className="border-b border-border last:border-b-0">
                <th scope="row" className="p-3 text-left font-heading text-base font-bold">
                  {cat}{" "}
                </th>
                {grid.places.map((place) => {
                  const cell = grid.at(cat, place);
                  const cv = cell ? variantFor(cell) : null;
                  if (!cell || !cv) {
                    return (
                      <td key={place} className="p-3 text-muted-foreground">
                        {"Not published "}
                      </td>
                    );
                  }
                  const on = cell.kind === row.kind;
                  return (
                    <td key={place} className="p-2">
                      <button
                        type="button"
                        aria-pressed={on}
                        aria-label={`${cell.label}${on ? ", picked" : ""}`}
                        onClick={() => setPicked(cell.kind)}
                        className={
                          `flex min-h-11 w-full items-center justify-center border px-1.5 py-2 [&_svg]:h-auto [&_svg]:max-w-full ${ground} ` +
                          (on ? "border-primary outline outline-2 outline-offset-2 outline-primary" : "border-border")
                        }
                        /* Our own string from the renderer; the trailing space
                           keeps one cell's words off the next. */
                        dangerouslySetInnerHTML={{ __html: `${cv.svg} ` }}
                      />{" "}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>{" "}
      <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:items-stretch [&>*]:min-w-0">
        <p className="shrink-0 self-center font-heading text-base font-bold sm:w-40">{row.label}</p>{" "}
        <pre className="flex-1 overflow-x-auto whitespace-nowrap bg-tint px-3 py-2.5 font-mono text-sm leading-relaxed">
          <code>{code}</code>
        </pre>{" "}
        <CopyButton text={code} />
      </div>
    </div>
  );
}

export function BadgeCatalogue({ rows, origin }: { rows: BadgeRow[]; origin: string }) {
  const [style, setStyle] = useState<BadgeStyle>("shield");
  const [theme, setTheme] = useState<BadgeTheme>("dark");
  const [format, setFormat] = useState<SnippetFormat>("markdown");

  const activeFormat = FORMATS.find((f) => f.id === format);
  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const r of rows) if (!seen.includes(r.group)) seen.push(r.group);
    return seen;
  }, [rows]);

  // Every shape any figure on the page supports, in a stable order.
  const styles = useMemo(() => {
    const order: BadgeStyle[] = ["shield", "card", "bar"];
    return order.filter((s) => rows.some((r) => r.styles.includes(s)));
  }, [rows]);

  /** The chosen shape if the figure has it, otherwise its own first. */
  const variantFor = useCallback(
    (row: BadgeRow): BadgeVariant | null => {
      const wanted = row.styles.includes(style) ? style : row.styles[0];
      return row.variants.find((v) => v.style === wanted && v.theme === theme) ?? row.variants[0] ?? null;
    },
    [style, theme],
  );

  return (
    <>
      <section className="mt-10 bg-tint p-5 sm:p-6">
        <h2 className="font-heading text-2xl font-bold">Set them up</h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
          These three choices apply to every badge below, so you only make them once.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3 [&>*]:min-w-0">
          <div>
            <p className="font-heading text-sm font-bold">Shape</p>{" "}
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Badge shape">
              {styles.map((s) => (
                <Chip key={s} active={style === s} onClick={() => setStyle(s)}>{STYLE_LABELS[s]}</Chip>
              ))}
            </div>{" "}
            <p className="mt-2 text-sm text-muted-foreground">{STYLE_HINTS[style]}</p>
          </div>

          <div>
            <p className="font-heading text-sm font-bold">Background</p>{" "}
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Badge background">
              {BADGE_THEMES.map((t) => (
                <Chip key={t} active={theme === t} onClick={() => setTheme(t)}>
                  {t === "dark" ? "Dark" : "Light"}
                </Chip>
              ))}
            </div>{" "}
            <p className="mt-2 text-sm text-muted-foreground">
              Pick the one that matches the page you are pasting into.
            </p>
          </div>

          <div>
            <p className="font-heading text-sm font-bold">Snippet</p>{" "}
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Snippet format">
              {FORMATS.map((f) => (
                <Chip key={f.id} active={format === f.id} onClick={() => setFormat(f.id)}>{f.label}</Chip>
              ))}
            </div>{" "}
            {activeFormat ? <p className="mt-2 text-sm text-muted-foreground">Good for {activeFormat.hint}.</p> : null}
          </div>
        </div>
      </section>

      {groups.map((group) => (
        <section key={group} className="mt-12">
          <h2 className="font-heading text-2xl font-bold">{group}</h2>{" "}
          {matrixOf(rows.filter((r) => r.group === group)) ? (
            <MatrixGroup
              rows={rows.filter((r) => r.group === group)}
              variantFor={variantFor}
              format={format}
              origin={origin}
              theme={theme}
            />
          ) : (
          /* A GRID OF CARDS, the embed gallery's shape below. One badge per
              full-width row ran the page past 13,000 px on a desktop for
              thirty-five small pictures. Each card leads with the badge as it
              will render, on the ground chosen above, then what the figure
              means, then the one line to copy. */
          <ul className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
            {rows.filter((r) => r.group === group).map((row) => {
              const v = variantFor(row);
              // A figure with no renderable variant at all is not shown. It
              // cannot happen with the current registry - every def declares at
              // least one style - and rendering half a row would be worse than
              // rendering none.
              if (!v) return null;
              const code = snippet(row, v, format, origin);
              const substituted = !row.styles.includes(style);
              return (
                <Fragment key={row.kind}>
                  {" "}
                  <li className="flex flex-col bg-tint">
                    <div
                      className={
                        "flex min-h-[4.5rem] items-center justify-center overflow-x-auto border-b border-border px-4 py-4 " +
                        (theme === "dark" ? "bg-black" : "bg-white")
                      }
                      /* Our own string from the renderer, which escapes its
                         content; every value comes from a published table.
                         The trailing space keeps this badge's last word off
                         the label that follows in the page's text. */
                      dangerouslySetInnerHTML={{ __html: `${v.svg} ` }}
                    />{" "}
                    <div className="flex flex-1 flex-col p-4">
                      <p className="font-heading text-lg font-bold">{row.label}</p>{" "}
                      <p className="mt-1 text-sm leading-relaxed text-soft">{row.meaning}</p>{" "}
                      {substituted ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Shown as {STYLE_LABELS[v.style].toLowerCase()}: {STYLE_LABELS[style].toLowerCase()} needs a
                          figure this one does not have.
                        </p>
                      ) : null}{" "}
                      {row.unavailable ? (
                        <p className="mt-2 text-sm font-bold text-muted-foreground">
                          Nothing was published for this one today, so the badge says so rather than showing an old
                          number.
                        </p>
                      ) : null}{" "}
                      <div className="mt-auto flex items-stretch gap-2 pt-4 [&>*]:min-w-0">
                        <pre className="flex-1 overflow-x-auto whitespace-nowrap bg-tint px-3 py-2.5 font-mono text-sm leading-relaxed">
                          <code>{code}</code>
                        </pre>{" "}
                        <CopyButton text={code} />
                      </div>
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ul>
          )}
        </section>
      ))}
    </>
  );
}
