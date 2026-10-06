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
label{display:block;margin-top:20px;font-weight:700}
.hint{display:block;font-weight:400;color:#52525b;font-size:15px}
input[type=text],input[type=url],textarea{display:block;width:100%;margin-top:6px;padding:10px 12px;font:inherit;border:2px solid #000;border-radius:0;background:#fff;color:#18181b}
textarea{min-height:128px;resize:vertical}
fieldset{margin:20px 0 0;padding:0;border:0}
legend{font-weight:700}
.check{display:inline-flex;align-items:center;gap:8px;min-height:44px;margin:4px 18px 0 0;font-weight:400}
.check input{width:20px;height:20px;accent-color:#1D8229}
.err{margin-top:6px;color:#B91C1C;font-weight:700;font-size:15px}
.note{margin-top:16px;padding:12px 14px;border:2px solid #000;background:#f0fbf1}
.firm{margin-top:32px;padding-top:8px;border-top:3px solid #000}
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
// Rating the alerts (the boxes in a case's last alert)
// ============================================================================

// Five equal columns that shrink with the card: at 320 wide each box is
// still 45px across (the body's padding narrows under 360), and 52px tall.
const RATING_STYLE = `
.scale{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;max-width:300px;margin-top:20px}
.scale .btn{min-height:52px;padding:0;font-size:20px;box-shadow:3px 3px 0 #000}
.scale .btn.picked{background:#2ECC40;outline:3px solid #000;outline-offset:2px}
.ends{display:flex;justify-content:space-between;max-width:300px;margin-top:8px;color:#52525b;font-size:14px}
.review{margin-top:24px;padding:16px 18px;border:2px solid #000;background:#f0fbf1}
.review p{margin:4px 0 0}
@media (max-width:360px){.body{padding:24px 16px 28px}}
`;

/**
 * The page a box in the email opens. Nothing is recorded yet: the score from
 * the link is marked, and each number is a submit button, so one more tap
 * sends it. `action` is the form's own path with its token, built by the
 * caller from parsed values.
 */
export function ratingPage(action: string, picked: number | null): Response {
  const buttons = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<button type="submit" name="r" value="${n}" class="btn${n === picked ? " go picked" : ""}" aria-label="${n} of 5${n === picked ? ", your pick" : ""}">${n}</button>`,
    )
    .join(" ");
  const lead =
    picked === null
      ? "Tap a number to send it: 1 is not useful, 5 is very useful."
      : `You picked ${picked}. Tap it to send, or pick another.`;
  return htmlPage(
    "Rate your alerts",
    `<style>${RATING_STYLE}</style><h1>How useful were these alerts?</h1><p class="muted">${escapeHtml(lead)}</p>
<form method="POST" action="${action}">
<div class="scale" role="group" aria-label="Your rating">${buttons}</div>
<div class="ends" aria-hidden="true"><span>Not useful</span> <span>Very useful</span></div>
</form>`,
  );
}

/** What the thanks page says for each score: a headline, and what the note box asks. */
export function ratingWords(score: number): { title: string; ask: string } {
  if (score >= 5) return { title: "Thanks, glad they helped", ask: "Anything we could do better?" };
  if (score === 4) return { title: "Thanks, glad they were useful", ask: "What would have made it a 5?" };
  if (score === 3) return { title: "Thanks for rating them", ask: "What would have made it a 5?" };
  return { title: "Sorry they fell short", ask: "What went wrong? One line helps us fix it." };
}

/**
 * After the tap: thanks in words that match the score, a review link for a 4
 * or a 5, the note box until they've written one (with the choice to leave
 * their address off it), and what comes next for a decided case.
 */
export function ratingThanksPage(opts: {
  score: number;
  caseNumber: string;
  /** The form's own path with its token (as for `ratingPage`). */
  action: string;
  /** They've sent a note, now or earlier. */
  noted: boolean;
  anonymous: boolean;
  reviewUrl: string;
  /** The case's final status, which decides what "next" means. */
  status: string | null;
}): Response {
  const { score, caseNumber, action, noted, anonymous, reviewUrl, status } = opts;
  const words = ratingWords(score);
  const caseUrl = `${SITE_URL}/perm-case-status?case=${encodeURIComponent(caseNumber)}`;
  const lead = `You rated these alerts ${score} of 5.${noted ? (anonymous ? " Thanks for the note, kept without your email." : " Thanks for the note too.") : ""}`;
  const review =
    score >= 4
      ? `<div class="review"><b>Would you say so in a short review?</b><p class="muted">It helps other people waiting on a case find the site.</p><p class="actions" style="margin-top:12px"><a class="btn go" href="${escapeHtml(reviewUrl)}">Leave a review</a></p></div>`
      : "";
  const note = noted
    ? ""
    : `<form method="POST" action="${action}">
<input type="hidden" name="r" value="${score}"/>
<label for="note">${escapeHtml(words.ask)} <span class="hint">Optional. We read every note.</span></label>
<textarea id="note" name="note" maxlength="1000"></textarea>
<label class="check"><input type="checkbox" name="anon" value="1"/> Leave my email off this note</label>
<span class="hint">Then we can't reply, and the note isn't tied to your case.</span>
<p class="actions"><button type="submit" class="btn go">Send</button></p>
</form>`;
  // A good rating asks for the review first; a poor one asks what went wrong first.
  const asks = score >= 4 ? `${review}${note}` : `${note}`;
  return htmlPage(
    "Thanks for rating",
    `<style>${RATING_STYLE}</style><h1>${escapeHtml(words.title)}</h1><p class="muted">${escapeHtml(lead)}</p>${asks}
<h2>What comes next</h2>
${nextSteps(status)
    .map((l) => `<p><a href="${l.href}">${escapeHtml(l.label)}</a></p>`)
    .join("\n")}
<p><a href="${caseUrl}">Your case's page</a></p>`,
  );
}

/** What comes after the status the last alert reported. Exported for the test. */
export function nextSteps(status: string | null): Array<{ href: string; label: string }> {
  const s = (status ?? "").trim().toUpperCase();
  if (s === "CERTIFIED") {
    return [
      { href: `${SITE_URL}/guides/waiting-on-your-green-card`, label: "The steps after PERM, and how long each takes" },
      { href: `${SITE_URL}/tools/green-card-line`, label: "Where your green card line stands" },
    ];
  }
  if (s.startsWith("DENIED")) {
    return [{ href: `${SITE_URL}/guides/perm-denied-what-happens-next`, label: "What a denial means, and the options after one" }];
  }
  // Withdrawn, expired or anything else final: the case page says what DOL recorded.
  return [];
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
