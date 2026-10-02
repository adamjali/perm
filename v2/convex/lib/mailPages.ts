/**
 * The small web pages behind emailed links: confirm an alert, unsubscribe,
 * and the email preferences page.
 *
 * They're served by Convex HTTP actions (convex/http.ts) and branded onto
 * permtracker.app by rewrites in next.config.ts, so they can't use the site's
 * React components or stylesheet. One shell here gives them the site's look
 * (black bar, square corners, hard shadows, the lime accent) in one place.
 *
 * Three rules every page here follows:
 * - Plain HTML, no script. A GET only ever renders a page; anything that
 *   changes a subscription is a POST button, because mail gateways open
 *   every link in an inbox.
 * - Relative form actions resolve against permtracker.app, so each one needs
 *   a rewrite in next.config.ts (src/app/__tests__/convex-relative-urls-rewritten.test.ts
 *   checks this file and convex/http.ts).
 * - Every value from the database goes through `escapeHtml`.
 */

import { SITE_URL } from "./links";
import {
  EMAIL_PREFERENCES_PATH,
  MAIL_KINDS,
  MAIL_RULES,
  NOTIFICATION_SETTINGS_PATH,
  subscriptionRows,
  type SubscriptionRow,
  type SubscriptionState,
  PREFS_KINDS,
} from "./mailKinds";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PREFERENCES_URL = `${SITE_URL}${EMAIL_PREFERENCES_PATH}`;

/** The site's palette, as these pages can't read its CSS variables. */
const STYLE = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#f4f4f5;color:#18181b;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
.wrap{max-width:560px;margin:0 auto;padding:40px 16px 56px}
.card{background:#fff;border:3px solid #000;box-shadow:6px 6px 0 #000}
.bar{display:block;background:#000;color:#fff;padding:16px 24px;font-size:19px;font-weight:800;text-decoration:none}
.bar b{color:#2ECC40}
.body{padding:28px 24px 32px}
h1{margin:0;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-.01em}
h2{margin:32px 0 4px;font-size:18px;font-weight:800}
p{margin:12px 0 0}
.muted{color:#52525b}
a{color:#1D8229;font-weight:700;text-underline-offset:3px}
form{margin:0}
.row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 16px;padding:14px 0;border-top:2px solid #e4e4e7}
.row.focus{margin:0 -12px;padding:14px 12px;border-left:6px solid #2ECC40;background:#f0fbf1}
.what{font-weight:700}
.detail{color:#52525b;font-size:15px}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px}
.tag{display:block;margin-top:4px;font-size:14px;font-weight:700;color:#1D8229}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 18px;font:inherit;font-size:15px;font-weight:700;color:#18181b;background:#fff;border:2px solid #000;box-shadow:3px 3px 0 #000;cursor:pointer;text-decoration:none}
.btn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #000}
.btn.go{background:#2ECC40;color:#000}
.btn.stop{background:#000;color:#fff;box-shadow:4px 4px 0 #DC2626}
.actions{margin-top:24px}
.rules{margin:28px 0 0;padding:16px 0 0;border-top:2px solid #000;color:#52525b;font-size:15px}
:focus-visible{outline:3px solid #2ECC40;outline-offset:2px}
`;

/** The shared page: the brand bar and one card. `inner` is trusted HTML. */
export function htmlPage(title: string, inner: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="robots" content="noindex"/><title>${escapeHtml(title)} | PERM Tracker</title><style>${STYLE}</style></head>
<body><div class="wrap"><div class="card"><a class="bar" href="${SITE_URL}"><b>PERM</b> Tracker</a><div class="body">${inner}</div></div></div></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/**
 * A titled message with an optional POST button (confirm, unsubscribe) or
 * link. `body` is trusted HTML: callers escape anything from the database.
 */
export function messagePage(
  title: string,
  body: string,
  action?: { post: string; label?: string } | { href: string; label: string },
): Response {
  const control = !action
    ? ""
    : "post" in action
      ? `<form method="POST" action="${action.post}" class="actions"><button type="submit" class="btn go">${escapeHtml(action.label ?? "Unsubscribe")}</button></form>`
      : `<p class="actions"><a class="btn" href="${action.href}">${escapeHtml(action.label)}</a></p>`;
  return htmlPage(title, `<h1>${escapeHtml(title)}</h1><p class="muted">${body}</p>${control}`);
}

/**
 * A link that can't be used: missing or forged token, or one for a
 * subscription that's gone. Status 400, with a way forward instead of a bare
 * line of text.
 */
export function badLinkPage(reason = "This link is incomplete or out of date."): Response {
  return htmlPage(
    "This link doesn't work",
    `<h1>This link doesn't work</h1><p class="muted">${escapeHtml(reason)} Ask for a fresh link to your email preferences, or set up the alert again from the site.</p><p class="actions"><a class="btn go" href="${PREFERENCES_URL}">Email preferences</a></p>`,
    400,
  );
}

// ============================================================================
// The preferences page
// ============================================================================

export type PrefsState = SubscriptionState;

/** `kind` or `kind:id`, the row an email was about. Anything else is ignored. */
export function isFocus(s: string): boolean {
  const [kind, id, extra] = s.split(":");
  if (extra !== undefined || !(PREFS_KINDS as readonly string[]).includes(kind ?? "")) return false;
  return id === undefined || /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

function rowHtml(r: SubscriptionRow, token: string, focused: string | null): string {
  const key = r.id ? `${r.kind}:${r.id}` : r.kind;
  const isFocused = key === focused;
  const meta = MAIL_KINDS[r.kind];
  return `<div class="row${isFocused ? " focus" : ""}"${isFocused ? ' id="focus"' : ""}>
  <div><div class="what">${escapeHtml(meta.one)}</div><div class="detail${r.isCaseNumber ? " mono" : ""}">${escapeHtml(r.detail)}</div>${isFocused ? '<span class="tag">The email you came from was about this one</span>' : ""}</div>
  <form method="POST" action="/prefs/update?token=${encodeURIComponent(token)}"><input type="hidden" name="kind" value="${r.kind}"/>${r.id ? `<input type="hidden" name="id" value="${escapeHtml(r.id)}"/>` : ""}<button type="submit" class="btn">Turn off</button></form>
</div>`;
}

function section(title: string, rows: SubscriptionRow[], token: string, focused: string | null, after = ""): string {
  if (rows.length === 0 && !after) return "";
  return `<h2>${escapeHtml(title)}</h2>${rows.map((r) => rowHtml(r, token, focused)).join("")}${after}`;
}

export function prefsPage(state: PrefsState, token: string, focus?: string | null): Response {
  const focused = focus && isFocus(focus) ? focus : null;
  const t = encodeURIComponent(token);
  const { alerts, digests, account } = subscriptionRows(state);
  const any = alerts.length + digests.length + account.length > 0;

  const accountNote =
    state.weeklyDigest === null
      ? ""
      : `<p class="detail">${escapeHtml(MAIL_KINDS.reminders.name)} and ${escapeHtml(MAIL_KINDS.updates.name.toLowerCase())} are in your <a href="${SITE_URL}${NOTIFICATION_SETTINGS_PATH}">notification settings</a>.</p>`;

  const body = any
    ? section("Alerts", alerts, token, focused) +
      section("Digest and news", digests, token, focused) +
      section("Your account", account, token, focused, accountNote) +
      `<form method="POST" action="/prefs/update?token=${t}" class="actions"><input type="hidden" name="kind" value="all"/><button type="submit" class="btn stop">Stop everything</button></form>`
    : `<p>Nothing is on for this address right now.</p>${accountNote}`;

  return htmlPage(
    "Email preferences",
    `<h1>Your email</h1><p class="muted">Everything PERM Tracker sends to <strong>${escapeHtml(state.email)}</strong>.</p>${body}
<p class="rules">${escapeHtml(MAIL_RULES[2].body)} Turning something on happens on the site, and asks you to confirm first. <a href="${PREFERENCES_URL}">See everything you can get</a></p>`,
  );
}
