import { analytics } from "@/lib/analytics";

/**
 * A field's value as the form holds it at the moment of submit.
 *
 * Read the box itself, not only React's copy of it. A phone's autofill or
 * keyboard suggestion can fill a box without the input event React listens
 * for, so the component's state keeps the old (empty) value while the screen
 * shows the new one, and a search runs on the stale copy in silence. An
 * iPhone (Chrome for iOS) on /perm-cases, Oct 4 2026: twenty taps on Search
 * with a name and two months on screen, the form's own submit handler running
 * each time, and not one request.
 *
 * A field the form doesn't carry (no `name`, disabled, or not rendered)
 * returns `fallback`, so a caller passes its state and loses nothing. When the
 * box and the state disagree, a `form_field_desync` event says which field, so
 * how often this happens is measured rather than guessed. The value itself is
 * never sent.
 */
export function formText(form: HTMLFormElement, name: string, fallback: string): string {
  const value = new FormData(form).get(name);
  if (typeof value !== "string") return fallback;
  if (value !== fallback) {
    analytics.capture("form_field_desync", {
      field: name,
      form: form.getAttribute("aria-label") || form.id || null,
      path: typeof location === "undefined" ? null : location.pathname,
    });
  }
  return value;
}
