"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";

import { BADGE_THEMES, type BadgeStyle, type BadgeTheme } from "@/lib/badge";

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
      className={
        "min-h-11 border-2 border-border px-4 font-heading text-sm font-black shadow-hard-sm transition-transform duration-150 hover:-translate-y-[1px] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 " +
        (active ? "bg-primary text-black" : "bg-background text-foreground")
      }
    >
      {children}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
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
      className="flex min-h-11 shrink-0 items-center gap-2 border-2 border-border bg-background px-3 font-heading text-sm font-black shadow-hard-sm transition-transform duration-150 hover:-translate-y-[1px] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {state === "copied" ? <CheckIcon size={16} weight="bold" aria-hidden="true" /> : <CopyIcon size={16} weight="bold" aria-hidden="true" />}
      {state === "copied" ? "Copied" : state === "failed" ? "Select it below" : "Copy"}
    </button>
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
      <section className="mt-10 border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 className="font-heading text-2xl font-black">Set them up</h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
          These three choices apply to every badge below, so you only make them once.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3 [&>*]:min-w-0">
          <div>
            <p className="font-heading text-sm font-black">Shape</p>{" "}
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Badge shape">
              {styles.map((s) => (
                <Chip key={s} active={style === s} onClick={() => setStyle(s)}>{STYLE_LABELS[s]}</Chip>
              ))}
            </div>{" "}
            <p className="mt-2 text-sm text-muted-foreground">{STYLE_HINTS[style]}</p>
          </div>

          <div>
            <p className="font-heading text-sm font-black">Background</p>{" "}
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
            <p className="font-heading text-sm font-black">Snippet</p>{" "}
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
          <h2 className="font-heading text-2xl font-black">{group}</h2>{" "}
          <ul className="mt-5 space-y-5">
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
                <li key={row.kind} className="border-2 border-border bg-card p-4 shadow-hard sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div
                        className="inline-block max-w-full overflow-x-auto align-top"
                        /* Our own string from the renderer, which escapes its
                           content; every value comes from a published table. */
                        dangerouslySetInnerHTML={{ __html: v.svg }}
                      />
                      <p className="mt-3 font-heading text-lg font-black">{row.label}</p>{" "}
                      <p className="mt-1 max-w-prose text-sm leading-relaxed text-foreground/75">{row.meaning}</p>{" "}
                      {substituted ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Shown as {STYLE_LABELS[v.style].toLowerCase()}: {STYLE_LABELS[style].toLowerCase()} needs a
                          figure this one does not have.
                        </p>
                      ) : null}{" "}
                      {row.unavailable ? (
                        <p className="mt-2 max-w-prose text-sm font-bold text-foreground/60">
                          Nothing was published for this one today, so the badge says so rather than showing an old
                          number.
                        </p>
                      ) : null}
                    </div>
                    <CopyButton text={code} />
                  </div>
                  <pre className="mt-4 overflow-x-auto border-2 border-border bg-background p-3 font-mono text-xs leading-relaxed">
                    <code>{code}</code>
                  </pre>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
