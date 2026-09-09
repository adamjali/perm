"use client";

import { useCallback, useId, useState } from "react";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";

/**
 * The badge catalogue: one format switch for the whole page, one code line and
 * one copy button per badge.
 *
 * WHY A SWITCH INSTEAD OF THE CODE BLOCKS IT REPLACES. The old page printed a
 * Markdown block AND an HTML block under every badge. That was six code walls
 * for three badges, and the honest reason it looked low-effort: almost all of
 * the page's surface was chrome for copying and almost none of it was badges.
 * Nine badges the same way would be eighteen. Almost nobody needs two formats
 * at once, and which one they need is a property of where they are pasting,
 * not of which badge they picked - so it is one choice for the whole page.
 *
 * The previews are the SAME SVG STRING the route serves, rendered inline.
 * Not `<img src="/badge/x.svg">`: that would be nine extra requests for
 * figures this page has already read, and it would let the preview drift from
 * the real badge. `renderBadgeSvg` escapes its own content and every value in
 * it comes from DOL's table.
 */

export type BadgeFormat = "markdown" | "html" | "url";

export interface BadgeRow {
  kind: string;
  /** The rendered SVG, exactly as /badge/<kind>.svg serves it. */
  svg: string;
  label: string;
  /** Plain-language description of the figure. */
  meaning: string;
  /** Where the number comes from, on this site. */
  href: string;
  /** The badge's own URL. */
  src: string;
  /** True when DOL published no figure for this one today. */
  unavailable: boolean;
}

const FORMATS: { id: BadgeFormat; label: string; hint: string }[] = [
  { id: "markdown", label: "Markdown", hint: "READMEs, GitHub and Reddit" },
  { id: "html", label: "HTML", hint: "a web page or a forum signature" },
  { id: "url", label: "Image URL", hint: "Notion, Slack, anywhere that takes a link" },
];

function snippet(row: BadgeRow, format: BadgeFormat, origin: string): string {
  const page = `${origin}${row.href}`;
  if (format === "url") return row.src;
  if (format === "html") {
    return `<a href="${page}"><img src="${row.src}" alt="${row.label}, from PERM Tracker" height="20"></a>`;
  }
  return `[![${row.label}](${row.src})](${page})`;
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      // Clipboard access can be refused - an insecure origin, a permission
      // policy, an older browser. Say so rather than showing a success that
      // did not happen; the snippet is selectable below either way.
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
      {state === "copied" ? (
        <CheckIcon size={16} weight="bold" aria-hidden="true" />
      ) : (
        <CopyIcon size={16} weight="bold" aria-hidden="true" />
      )}
      {state === "copied" ? "Copied" : state === "failed" ? "Select it below" : "Copy"}
    </button>
  );
}

export function BadgeCatalogue({ rows, origin }: { rows: BadgeRow[]; origin: string }) {
  const [format, setFormat] = useState<BadgeFormat>("markdown");
  const groupId = useId();
  const active = FORMATS.find((f) => f.id === format);

  return (
    <>
      <section className="mt-12" aria-labelledby={groupId}>
        <h2 id={groupId} className="font-heading text-2xl font-black">Copy one</h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
          Pick the format for wherever it is going. It applies to every badge below.
        </p>{" "}
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Snippet format">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              aria-pressed={format === f.id}
              className={
                "min-h-11 border-2 border-border px-4 font-heading text-sm font-black shadow-hard-sm transition-transform duration-150 hover:-translate-y-[1px] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 " +
                (format === f.id ? "bg-primary text-black" : "bg-background text-foreground")
              }
            >
              {f.label}
            </button>
          ))}
        </div>{" "}
        {active ? <p className="mt-2 text-sm text-muted-foreground">Good for {active.hint}.</p> : null}
      </section>

      <ul className="mt-8 space-y-5">
        {rows.map((row) => {
          const code = snippet(row, format, origin);
          return (
            <li key={row.kind} className="border-2 border-border bg-card p-4 shadow-hard sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div
                    className="inline-block align-top"
                    /* Our own string from `renderBadgeSvg`, which escapes its
                       content, and every value in it comes from DOL's
                       published table. Nothing here is user input. */
                    dangerouslySetInnerHTML={{ __html: row.svg }}
                  />
                  <p className="mt-3 font-heading text-lg font-black">{row.label}</p>{" "}
                  <p className="mt-1 max-w-prose text-sm leading-relaxed text-foreground/75">{row.meaning}</p>{" "}
                  {row.unavailable ? (
                    <p className="mt-2 max-w-prose text-sm font-bold text-foreground/60">
                      DOL printed no figure for this one today, so the badge says so rather than showing an old number.
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
    </>
  );
}
