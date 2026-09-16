import { actionUrl } from "./links";
import { makeUnsubscribeToken } from "./unsubscribeToken";

/**
 * The preference page for one address, as the magic link every subscriber
 * email carries beside its one-click unsubscribe.
 *
 * `focus` names the row the email was about (`case:<id>`, `queue:<id>`,
 * `bulletin:<id>`, or a bare kind), so the page opens on that row instead
 * of a list. The token is purpose-scoped to `prefs` and the page it opens is
 * off-only, so a forwarded email can turn things off and never on.
 */
export async function prefsLink(email: string, secret: string, focus?: string): Promise<string> {
  const token = await makeUnsubscribeToken(email, secret, "prefs");
  const base = actionUrl("/prefs", token);
  return focus ? `${base}&focus=${encodeURIComponent(focus)}` : base;
}

/** The one-click unsubscribe target for a kind, for the `List-Unsubscribe` header. */
export function oneClickUnsubscribeUrl(token: string, kind: string, id?: string): string {
  const base = actionUrl("/prefs/unsubscribe", token);
  return `${base}&kind=${encodeURIComponent(kind)}${id ? `&id=${encodeURIComponent(id)}` : ""}`;
}
