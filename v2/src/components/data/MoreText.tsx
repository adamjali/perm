/**
 * A long note, met as one line.
 *
 * A one-line gist, written for the note, with the original words verbatim one
 * tap away: nothing is rewritten, so no fact changes, and the full text stays
 * in the HTML for search and answer engines.
 *
 * Plain `<details>`: keyboard and screen-reader correct, works before
 * hydration and with scripts off, and find-in-page opens it. Use FinePrint for
 * provenance and method notes (its summary names what is inside); use this
 * where the gist IS the point and the rest is the reasoning behind it.
 */
import { isValidElement, type ReactNode } from "react";

/** The plain text of a React node: strings and numbers, through children. */
export function plainText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return plainText(props.children);
  }
  return "";
}

/** Words in a node's text. */
export function wordCount(node: ReactNode): number {
  return plainText(node).split(/\s+/).filter(Boolean).length;
}

// Tokens a full stop does not end a sentence after: initials (U.S.), and the
// abbreviations this site's copy uses.
const NOT_AN_END = /^(?:(?:[A-Z]\.){1,3}|e\.g\.|i\.e\.|vs\.|No\.|St\.|Inc\.|Co\.|Ltd\.|approx\.)$/;

/** The first sentence of a text, for a gist. */
export function firstSentence(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  const re = /[.!?](?=\s+[A-Z0-9“"(])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const head = t.slice(0, m.index + 1);
    const last = head.split(" ").pop() ?? "";
    if (NOT_AN_END.test(last)) continue;
    return head;
  }
  return t;
}

export function MoreText({
  gist,
  children,
  className = "",
  size = "base",
}: {
  /** One short sentence: what the note says. Always visible. */
  gist: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** "sm" inside a caption or a note band. */
  size?: "sm" | "base";
}) {
  return (
    <details className={`group max-w-3xl ${className}`}>
      <summary className={`flex min-h-[44px] cursor-pointer list-none items-baseline gap-x-2 py-1 leading-relaxed text-foreground/80 [&::-webkit-details-marker]:hidden ${size === "sm" ? "text-sm" : "text-base"}`}>
        <span>
          {gist}{" "}
          <span className="whitespace-nowrap font-bold text-foreground underline decoration-primary decoration-2 underline-offset-4 group-open:hidden">
            More
          </span>
        </span>
      </summary>{" "}
      <div className="mt-1 [&>*+*]:mt-2">{children}</div>
    </details>
  );
}
