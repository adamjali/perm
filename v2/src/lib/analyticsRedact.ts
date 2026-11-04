/**
 * What a click may tell PostHog about the page it came from (owner's call, Oct 12 2026).
 *
 * PostHog's autocapture sends the text and attributes of the clicked element and its
 * parents: `$el_text`, the `$elements_chain` string, sometimes `$elements`, and
 * `$selected_content` for copied text. In the signed-in app that text can be a client's
 * name, so there it's dropped entirely; on public pages it's DOL's public record and
 * stays, with identifiers that tie a visitor to one filing taken out first (a link to a
 * case lookup carried the case number in its href, which redactCaseParam never saw).
 *
 * Done in before_send (src/instrumentation-client.ts), the one place that sees every
 * event, rather than by flipping posthog-js's mask_all_text at runtime: the SDK copies
 * that switch into its click recorder through an internal refresh this code can't see.
 */

/**
 * The signed-in app's first path segments: the folders of src/app/(authenticated).
 * analyticsRedact.test.ts holds this list to that folder.
 */
export const APP_SEGMENTS: ReadonlySet<string> = new Set([
  "admin",
  "calendar",
  "cases",
  "dashboard",
  "notifications",
  "settings",
  "timeline",
]);

/** Shapes that identify one filing or one person. */
const IDENTIFIERS: readonly RegExp[] = [
  // FLAG case numbers for every program: G-100-, P-100-, I-200-, H-300-, C-500-, JO-A-300- ...
  /\b(?:JO-)?[A-Z]-\d{3}-\d{5}-\d{6}\b/gi,
  // Old-form PERM numbers.
  /\bA-\d{5}-\d{5}\b/gi,
  // USCIS receipt numbers (the USCIS lookup keeps saved ones on screen).
  /\b[A-Z]{3}\d{10}\b/gi,
  // Email addresses.
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
];

const REDACTED = "[redacted]";

/** A string with every identifier replaced. */
export function redactIdentifiers(s: string): string {
  let out = s;
  for (const re of IDENTIFIERS) out = out.replace(re, REDACTED);
  return out;
}

/** The page's path, from the event's own fields. */
function pathOf(props: Record<string, unknown>): string {
  if (typeof props.$pathname === "string") return props.$pathname;
  const url = typeof props.$current_url === "string" ? props.$current_url : "";
  const m = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*([^?#]*)/i.exec(url);
  return m ? m[1] || "/" : url.split(/[?#]/)[0] || "/";
}

/** Whether a path is a page of the signed-in app. */
export function isAppPath(path: string): boolean {
  const first = path.split("/").filter(Boolean)[0] ?? "";
  return APP_SEGMENTS.has(first.toLowerCase());
}

/** `text="..."` and `attr__x="..."` pairs in an elements chain; values escape `"` as `\"`. */
const TEXT_AND_ATTRIBUTES = /(?:text|attr__[\w-]+)="(?:\\.|[^"\\])*"/g;

/**
 * Scrub one event's click fields in place. App pages lose all element text and
 * attributes (the tag, classes, position and link stay, so a click still says which
 * control it was); every page loses identifiers. Never throws (a throw in before_send
 * would drop the event); if scrubbing fails, the click fields go and the event stays.
 */
export function scrubClickEvent(props: Record<string, unknown> | undefined): void {
  if (!props) return;
  const hasClick =
    "$el_text" in props || "$elements_chain" in props || "$elements" in props || "$selected_content" in props;
  if (!hasClick) return;
  try {
    const app = isAppPath(pathOf(props));
    if (app) {
      delete props.$el_text;
      delete props.$selected_content;
      if (typeof props.$elements_chain === "string") {
        props.$elements_chain = props.$elements_chain.replace(TEXT_AND_ATTRIBUTES, "");
      }
    }
    for (const key of ["$el_text", "$elements_chain", "$selected_content"] as const) {
      const v = props[key];
      if (typeof v === "string") props[key] = redactIdentifiers(v);
    }
    if (Array.isArray(props.$elements)) {
      for (const el of props.$elements as Array<Record<string, unknown>>) {
        if (!el || typeof el !== "object") continue;
        for (const k of Object.keys(el)) {
          const isTextOrAttr = k === "$el_text" || k === "text" || (k.startsWith("attr__") && k !== "attr__href" && k !== "attr__class" && k !== "attr__id");
          if (app && isTextOrAttr) {
            delete el[k];
          } else if (typeof el[k] === "string") {
            el[k] = redactIdentifiers(el[k] as string);
          }
        }
      }
    }
  } catch {
    for (const key of ["$el_text", "$elements_chain", "$elements", "$selected_content"]) delete props[key];
  }
}

const FIELD_TAGS = new Set(["input", "select", "option", "textarea"]);
const BUTTON_INPUT = /attr__type="(?:submit|button|reset|image)"/;

/**
 * A click that only put the cursor in a field or opened a dropdown. The field's `change` event
 * records what was chosen, so the click adds nothing, and these were a fifth of every click PostHog
 * received (Nov 1 to 4 2026: 8,499 on text boxes and 5,624 on dropdowns of 70,442), with the
 * month's events projected past the free million. A submit or button input is a real press and
 * stays. Read before scrubClickEvent, which takes a signed-in page's attributes out.
 */
export function isFieldFocusClick(event: { event?: string; properties?: Record<string, unknown> } | null | undefined): boolean {
  const props = event?.properties;
  if (event?.event !== "$autocapture" || !props || props.$event_type !== "click") return false;
  const chain = typeof props.$elements_chain === "string" ? props.$elements_chain : "";
  const first = chain.split(";")[0] ?? "";
  const fromChain = first.split(/[.:]/)[0]?.toLowerCase() ?? "";
  const elements = Array.isArray(props.$elements) ? (props.$elements as Array<Record<string, unknown>>) : [];
  const tag = fromChain || String(elements[0]?.tag_name ?? "").toLowerCase();
  if (!FIELD_TAGS.has(tag)) return false;
  const type = String(elements[0]?.attr__type ?? "");
  return !(BUTTON_INPUT.test(first) || /^(submit|button|reset|image)$/i.test(type));
}
