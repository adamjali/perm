/**
 * The pages behind a firm's claim links: confirm the claim, and edit the profile.
 *
 * Plain HTML with no script, in the shell every emailed-link page uses
 * (convex/lib/mailPages.ts), served by convex/http.ts and branded onto
 * permtracker.app (next.config.ts and nginx route `/firm-claim/*` to it).
 * A GET only ever renders; every change is a POST. Every value from the
 * database goes through `escapeHtml`, and every form action is relative, so
 * src/app/__tests__/convex-relative-urls-rewritten.test.ts reads this file.
 */

import { SITE_URL } from "./links";
import { escapeHtml, htmlPage } from "./mailPages";
import {
  DESCRIPTION_MAX,
  FOCUS_OPTIONS,
  type FirmOffice,
  type ProfileField,
  type ProfileInput,
} from "../../src/lib/firmProfile";

export interface EditFirm {
  slug: string;
  firmName: string;
  domain: string;
  profile: {
    website?: string;
    description?: string;
    languages: string[];
    offices: FirmOffice[];
    focus: string[];
  } | null;
  hidden: boolean;
  hiddenBy?: string;
  pendingWebsite?: string;
}

/** What the form shows after a save: the result, and what was typed when it didn't pass. */
export interface EditNotice {
  slug: string;
  ok: boolean;
  message: string;
  errors?: Partial<Record<ProfileField, string>>;
  submitted?: ProfileInput;
}

function err(n: EditNotice | undefined, field: ProfileField): string {
  const m = n?.errors?.[field];
  return m ? `<div class="err">${escapeHtml(m)}</div>` : "";
}

function asLines(offices: unknown): string {
  if (!Array.isArray(offices)) return "";
  return offices
    .map((o) => {
      const r = (o ?? {}) as { city?: unknown; state?: unknown };
      return `${typeof r.city === "string" ? r.city : ""}${typeof r.state === "string" && r.state ? `, ${r.state}` : ""}`;
    })
    .join("\n");
}

function firmForm(f: EditFirm, token: string, notice?: EditNotice): string {
  const mine = notice?.slug === f.slug ? notice : undefined;
  const typed = mine && !mine.ok ? mine.submitted : undefined;
  const p = f.profile ?? { languages: [], offices: [], focus: [] };
  const website = typeof typed?.website === "string" ? typed.website : (p.website ?? f.pendingWebsite ?? "");
  const description = typeof typed?.description === "string" ? typed.description : (p.description ?? "");
  const languages = Array.isArray(typed?.languages) ? (typed.languages as string[]).join(", ") : p.languages.join(", ");
  const offices = typed ? asLines(typed.offices) : asLines(p.offices);
  const focus = new Set(Array.isArray(typed?.focus) ? (typed.focus as string[]) : p.focus);
  const action = `/firm-claim/edit?token=${encodeURIComponent(token)}&amp;slug=${encodeURIComponent(f.slug)}`;
  const status = mine
    ? `<p class="note" role="status">${escapeHtml(mine.message)}</p>`
    : f.hidden
      ? `<p class="note">${f.hiddenBy === "admin" ? "We've taken this profile down, so nothing from the firm shows on its page." : "The profile is down, so nothing from the firm shows on its page."}</p>`
      : "";
  const pending = f.pendingWebsite
    ? `<p class="detail">${escapeHtml(f.pendingWebsite)} isn't on ${escapeHtml(f.domain)}, the domain you confirmed with, so it shows once we've checked it.</p>`
    : "";
  const toggle =
    f.hiddenBy === "admin" || !f.profile
      ? ""
      : `<form method="POST" action="${action}" class="actions"><input type="hidden" name="action" value="${f.hidden ? "show" : "hide"}"/><button type="submit" class="btn${f.hidden ? " go" : ""}">${f.hidden ? "Put the profile back up" : "Take the profile down"}</button></form>`;
  return `<section class="firm">
<h2>${escapeHtml(f.firmName)}</h2>
<p class="detail"><a href="${SITE_URL}/perm-attorneys/${encodeURIComponent(f.slug)}">The firm's page</a></p>
${status}
<form method="POST" action="${action}">
<input type="hidden" name="action" value="save"/>
<label for="w-${escapeHtml(f.slug)}">Website <span class="hint">On ${escapeHtml(f.domain)}, starting https://</span></label>
<input id="w-${escapeHtml(f.slug)}" type="url" name="website" value="${escapeHtml(website)}" maxlength="200" autocomplete="url"/>${err(mine, "website")}
${pending}
<label for="d-${escapeHtml(f.slug)}">About the firm <span class="hint">Up to ${DESCRIPTION_MAX} characters. Plain text: no links, addresses, phone numbers or people's names.</span></label>
<textarea id="d-${escapeHtml(f.slug)}" name="description" maxlength="${DESCRIPTION_MAX}">${escapeHtml(description)}</textarea>${err(mine, "description")}
<label for="l-${escapeHtml(f.slug)}">Languages <span class="hint">Separated by commas: Spanish, Mandarin</span></label>
<input id="l-${escapeHtml(f.slug)}" type="text" name="languages" value="${escapeHtml(languages)}" maxlength="500"/>${err(mine, "languages")}
<label for="o-${escapeHtml(f.slug)}">Offices <span class="hint">One a line, city then state: Tampa, FL</span></label>
<textarea id="o-${escapeHtml(f.slug)}" name="offices">${escapeHtml(offices)}</textarea>${err(mine, "offices")}
<fieldset><legend>What the firm handles</legend>
${FOCUS_OPTIONS.map((o) => `<label class="check"><input type="checkbox" name="focus" value="${o.id}"${focus.has(o.id) ? " checked" : ""}/>${escapeHtml(o.label)}</label>`).join("")}
</fieldset>
<p class="actions"><button type="submit" class="btn go">Save the profile</button></p>
</form>
${toggle}
</section>`;
}

/** The edit page for every firm this address holds a verified claim on. */
export function firmEditPage(firms: EditFirm[], token: string, notice?: EditNotice): Response {
  if (firms.length === 0) {
    return htmlPage(
      "No confirmed claim",
      `<h1>No confirmed claim</h1><p class="muted">This address has no confirmed claim on a firm's page any more. Claim the page again from the firm's page on ${escapeHtml(SITE_URL.replace("https://", ""))}.</p>`,
    );
  }
  const intro = `<h1>Your firm's profile</h1><p class="muted">What you save shows on the firm's page as the firm's own words, apart from DOL's figures. This link works for 2 days; ask for a fresh one from the firm's page any time.</p>`;
  return htmlPage("Your firm's profile", intro + firms.map((f) => firmForm(f, token, notice)).join(""));
}

/** A claim or edit link that can't be used, with the way forward for a firm (not the alert wording). */
export function firmBadLinkPage(reason = "This link is incomplete or out of date."): Response {
  return htmlPage(
    "This link doesn't work",
    `<h1>This link doesn't work</h1><p class="muted">${escapeHtml(reason)} Start again from the firm's page: claim it, or ask for a fresh edit link.</p><p class="actions"><a class="btn go" href="${SITE_URL}/perm-attorneys">Find the firm</a></p>`,
    400,
  );
}
