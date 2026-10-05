/**
 * A law firm claims its `/perm-attorneys/<slug>` page and adds its own words.
 *
 * ## How a claim is checked
 *
 * DOL's disclosure files print an email address beside the firm on every
 * PERM, wage-request and LCA filing. `scripts/build_firm_domains.py` keeps
 * only the DOMAIN of each (never an address) in `firm_email_domains`. A claim
 * from an address at a domain those files tie to the firm verifies on its own
 * once the claimant clicks the emailed link; anything else (personal mail, a
 * domain DOL never printed beside the firm, a shared service) waits for the
 * admin. Never an automatic refusal: a firm that changed domains is still
 * the firm. The rule itself is `claimVerdict` in src/lib/firmProfile.ts.
 *
 * ## The flow
 *
 * 1. The page's form POSTs to `/firm-claim/request`; the HTTP route looks the
 *    firm's name up in our records (never the form's) and runs the domain
 *    check, then `request` stages the claim and its profile and emails a link.
 * 2. The link opens a page with a POST button (mail gateways open every link;
 *    a GET never changes anything). The click verifies or queues for review.
 * 3. A verified firm edits its profile from an expiring link, from the
 *    confirmation page or emailed on request from the firm page.
 *
 * Every link here grants something, so every one expires
 * (convex/lib/expiringToken.ts): 7 days to confirm, 2 days to edit.
 *
 * ## Budgets
 *
 * Its own pool (`firmClaim`, 10 a day, convex/lib/alertBudgets.ts and the
 * ledger in convex/caseAlerts.ts), charged BEFORE the email is scheduled; a
 * full pool queues the request (convex/confirmationQueue.ts). A per-address
 * cooldown and a per-connection limit sit in front of it. Replies are the same
 * words whatever the state, so the form can't be used to learn who has claimed
 * what.
 *
 * ## What's published
 *
 * `firmProfiles`, one row per firm: website, description, languages, offices,
 * practice focus. Shown on the firm page as the firm's own words, apart from
 * DOL's figures. No attorney's name, no phone number, no link in the
 * description; the website must be on the verified domain unless the admin
 * approves it. The page is refreshed through `/api/revalidate-firm` whenever
 * the profile is published, edited, hidden or revoked.
 *
 * @module convex/firmClaims
 */

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { FROM_EMAIL, getResend, sendOrQueue } from "./lib/email";
import { SITE_URL, actionUrl } from "./lib/links";
import { makeExpiringToken, verifyExpiringToken } from "./lib/expiringToken";
import { one, rows } from "./lib/publicMirror";
import { recordError } from "./lib/errorRecording";
import { checkAndRecordRateLimit } from "./lib/rateLimit";
import { connectionThrottleReply } from "./lib/throttleReply";
import { CONFIRMATION_COOLDOWN_MS } from "./lib/alertBudgets";
import { admitConfirmation, queueConfirmation, replayArgs } from "./confirmationQueue";
import { getAdminEmail, requireAdmin } from "./lib/admin";
import { createLogger } from "./lib/logging";
import { MS_PER_DAY, MS_PER_HOUR } from "./lib/time";
import {
  ROLE_MAX,
  checkProfile,
  claimVerdict,
  emailDomain,
  hasContent,
  websiteMatchesDomain,
  type DomainRow,
  type FirmProfile,
  type ProfileField,
} from "../src/lib/firmProfile";

const log = createLogger("FirmClaims");

export const FIRM_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;
/** Firms one address may claim. A product limit and a read bound. */
export const MAX_CLAIMS_PER_ADDRESS = 5;
export const CONFIRM_VALID_MS = 7 * MS_PER_DAY;
export const EDIT_VALID_MS = 2 * MS_PER_DAY;
/** Claims and edit-link requests from one connection in an hour. */
export const CLAIM_IP_LIMIT = { limit: 10, windowMs: MS_PER_HOUR };
/** Rows read for the admin list, per status group. */
const ADMIN_READ = 200;

export const NEUTRAL_REPLY =
  "Check your inbox. If the address can claim this page, a link to confirm is on its way; it works for 7 days.";
export const EDIT_LINK_REPLY =
  "Check your inbox. If that address holds a confirmed claim on this firm's page, an edit link is on its way; it works for 2 days.";

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (!s) throw new Error("UNSUBSCRIBE_SECRET is not configured");
  return s;
}

function normalEmail(raw: string): string | null {
  // The length cap runs before the pattern.
  const email = raw.trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && emailDomain(email) ? email : null;
}

export function firmPagePath(slug: string): string {
  return `/perm-attorneys/${slug}`;
}

// ============================================================================
// Our records, read by the HTTP route before anything is staged
// ============================================================================

/** The firm's name for a slug, from our records; null when we hold no such firm. */
export async function firmNameFor(slug: string): Promise<string | null> {
  if (!FIRM_SLUG_RE.test(slug)) return null;
  const r = await one("SELECT name FROM perm_entities WHERE kind = 'attorney' AND slug = ?", [slug]);
  return typeof r?.name === "string" && r.name ? r.name : null;
}

/** Every firm DOL prints beside this domain. Empty before the table's first build. */
export async function domainRowsFor(domain: string): Promise<DomainRow[]> {
  try {
    const got = await rows(
      "SELECT page_slug, program, filings, firm_filings FROM firm_email_domains WHERE domain = ?",
      [domain],
    );
    return got.map((r) => ({
      page_slug: String(r.page_slug),
      program: String(r.program),
      filings: Number(r.filings ?? 0),
      firm_filings: Number(r.firm_filings ?? 0),
    }));
  } catch (error) {
    // The table arrives with the first monthly build. Until then every claim
    // is a manual review, which is the safe direction.
    if (error instanceof Error && /no such table/i.test(error.message)) return [];
    throw error;
  }
}

// ============================================================================
// Validators
// ============================================================================

const profileInput = v.object({
  website: v.optional(v.string()),
  description: v.optional(v.string()),
  languages: v.optional(v.array(v.string())),
  offices: v.optional(v.array(v.object({ city: v.string(), state: v.string() }))),
  focus: v.optional(v.array(v.string())),
});

const verdictValidator = v.object({
  verified: v.boolean(),
  filings: v.number(),
  reason: v.optional(v.string()),
});

const replyValidator = v.object({
  ok: v.boolean(),
  message: v.string(),
  errors: v.optional(v.record(v.string(), v.string())),
  throttled: v.optional(v.boolean()),
  queued: v.optional(v.boolean()),
});

const profileOut = v.object({
  website: v.optional(v.string()),
  description: v.optional(v.string()),
  languages: v.array(v.string()),
  offices: v.array(v.object({ city: v.string(), state: v.string() })),
  focus: v.array(v.string()),
});

// ============================================================================
// Request a claim
// ============================================================================

/** Internal: the only caller is the HTTP route, which verified the name and ran the domain check. */
export const request = internalMutation({
  args: {
    slug: v.string(),
    firmName: v.string(),
    email: v.string(),
    role: v.string(),
    profile: profileInput,
    verdict: verdictValidator,
    source: v.optional(v.string()),
    ip: v.optional(v.string()),
    /** Set only when the confirmation queue replays a request a full pool held back. */
    fromQueue: v.optional(v.boolean()),
  },
  returns: replyValidator,
  handler: async (ctx, args) => {
    const email = normalEmail(args.email);
    if (!email) return { ok: false, message: "That email address doesn't look right." };
    const domain = emailDomain(email)!;
    if (!FIRM_SLUG_RE.test(args.slug)) return { ok: false, message: "We don't know that firm." };
    const role = args.role.trim().replace(/\s+/g, " ").slice(0, ROLE_MAX);
    if (!role) return { ok: false, message: "Say what your role at the firm is.", errors: { role: "Required." } };
    const checked = checkProfile(args.profile);
    if (!checked.ok) {
      return { ok: false, message: "Some of the details need a fix.", errors: checked.errors as Record<string, string> };
    }

    const ip = args.ip?.trim();
    if (ip && ip !== "unknown" && !args.fromQueue) {
      const perIp = await checkAndRecordRateLimit(ctx, ip, "firm_claim_ip", CLAIM_IP_LIMIT);
      if (!perIp.allowed) return { ok: false, message: connectionThrottleReply(perIp.resetInMs), throttled: true };
    }

    const forAddress = await ctx.db
      .query("firmClaims")
      .withIndex("by_email", (q) => q.eq("email", email))
      .take(MAX_CLAIMS_PER_ADDRESS + 1);
    const existing = forAddress.find((r) => r.slug === args.slug) ?? null;
    const now = Date.now();
    const lastSent = forAddress.reduce((a, r) => Math.max(a, r.lastConfirmationSentAt ?? 0, r.lastEditLinkSentAt ?? 0), 0);
    if (!args.fromQueue && lastSent > 0 && now - lastSent < CONFIRMATION_COOLDOWN_MS) {
      return { ok: true, message: NEUTRAL_REPLY };
    }
    if (!existing && forAddress.length >= MAX_CLAIMS_PER_ADDRESS) return { ok: true, message: NEUTRAL_REPLY };
    // A confirmed claimant asking again gets nothing new staged: the edit link
    // is how a verified firm changes its page.
    if (existing?.status === "verified" || existing?.status === "pending_review") {
      return { ok: true, message: NEUTRAL_REPLY };
    }

    // Charged BEFORE the write: a full pool leaves no stamp for a retry to trip over.
    if (!args.fromQueue) {
      const budget = await admitConfirmation(ctx, "firmClaim");
      if (!budget.allowed) {
        log.warn("claim confirmation can't send now; queueing");
        return queueConfirmation(ctx, {
          kind: "firm",
          pool: "firmClaim",
          email,
          args: replayArgs(args),
          resetInMs: budget.resetInMs,
        });
      }
    }

    const fields = {
      firmName: args.firmName.slice(0, 200),
      domain,
      role,
      status: "pending_email" as const,
      domainFilings: args.verdict.filings,
      domainReason: args.verdict.verified ? undefined : (args.verdict.reason ?? "not_listed"),
      draft: checked.profile,
      lastConfirmationSentAt: now,
      source: args.source,
    };
    let claimId: Id<"firmClaims">;
    if (existing) {
      // A claim the admin rejected or revoked can be made again, but it never
      // verifies itself a second time: it goes to review whatever the domain says.
      const held = existing.status === "rejected" || existing.status === "revoked";
      await ctx.db.patch(existing._id, { ...fields, ...(held ? { domainReason: existing.status } : {}) });
      claimId = existing._id;
    } else {
      claimId = await ctx.db.insert("firmClaims", { ...fields, slug: args.slug, email, createdAt: now });
    }
    await ctx.scheduler.runAfter(0, internal.firmClaims.sendConfirmation, { claimId });
    return { ok: true, message: NEUTRAL_REPLY };
  },
});

export const getClaim = internalQuery({
  args: { claimId: v.id("firmClaims") },
  returns: v.union(
    v.object({
      email: v.string(),
      slug: v.string(),
      firmName: v.string(),
      status: v.string(),
      autoVerify: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.claimId);
    if (!c) return null;
    return { email: c.email, slug: c.slug, firmName: c.firmName, status: c.status, autoVerify: c.domainReason === undefined };
  },
});

export const clearCooldown = internalMutation({
  args: { claimId: v.id("firmClaims"), which: v.union(v.literal("confirm"), v.literal("edit")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.claimId);
    if (c) await ctx.db.patch(c._id, args.which === "confirm" ? { lastConfirmationSentAt: undefined } : { lastEditLinkSentAt: undefined });
    return null;
  },
});

async function sendFirmEmail(
  ctx: Parameters<typeof sendOrQueue>[0] & Parameters<typeof recordError>[0],
  args: {
    kind: "confirm" | "approved" | "edit";
    email: string;
    firmName: string;
    url: string;
    validFor: string;
    domainVerified?: boolean;
  },
): Promise<boolean> {
  const subject =
    args.kind === "confirm"
      ? `Confirm your claim on ${args.firmName}'s page`
      : args.kind === "approved"
        ? `Your claim on ${args.firmName}'s page is approved`
        : `Edit ${args.firmName}'s profile on PERM Tracker`;
  let html: string | undefined;
  try {
    const { render } = await import("@react-email/render");
    const { FirmClaimEmail } = await import("../src/emails/FirmClaimEmail");
    html = await render(FirmClaimEmail(args));
  } catch (error) {
    await recordError(ctx, "action", `firmClaims.${args.kind}.render`, error);
  }
  const lead =
    args.kind === "confirm"
      ? args.domainVerified
        ? "Confirm and your profile goes up on the firm's page, marked as the firm's own words."
        : "Confirm and we'll check the claim by hand, because DOL's files don't tie this address's domain to the firm."
      : args.kind === "approved"
        ? "We checked your claim and your profile is up on the firm's page. Change it or take it down here:"
        : "Here's your link to change the firm's profile or take it down:";
  const result = await sendOrQueue(ctx, `firm-claim-${args.kind}`, getResend(), {
    from: FROM_EMAIL,
    to: args.email,
    subject,
    html,
    text: [
      `${args.firmName} on PERM Tracker`,
      "",
      lead,
      args.url,
      "",
      `The link works for ${args.validFor}. If you didn't ask for this, ignore it: nothing changes.`,
      "",
      "PERM Tracker",
      SITE_URL,
    ].join("\n"),
  });
  if (result.error) {
    await recordError(ctx, "action", `firmClaims.send.${args.kind}`, new Error(`Resend: ${result.error.name}: ${result.error.message}`));
    return false;
  }
  return true;
}

export const sendConfirmation = internalAction({
  args: { claimId: v.id("firmClaims") },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const c = await ctx.runQuery(internal.firmClaims.getClaim, { claimId: args.claimId });
      if (!c || c.status !== "pending_email") return null;
      const token = await makeExpiringToken(c.email, secret(), "firm-confirm", Date.now() + CONFIRM_VALID_MS);
      const ok = await sendFirmEmail(ctx, {
        kind: "confirm",
        email: c.email,
        firmName: c.firmName,
        url: actionUrl("/firm-claim/confirm", token),
        validFor: "7 days",
        domainVerified: c.autoVerify,
      });
      if (!ok) await ctx.runMutation(internal.firmClaims.clearCooldown, { claimId: args.claimId, which: "confirm" });
    } catch (error) {
      await recordError(ctx, "action", "firmClaims.sendConfirmation", error);
      await ctx.runMutation(internal.firmClaims.clearCooldown, { claimId: args.claimId, which: "confirm" });
    }
    return null;
  },
});

// ============================================================================
// Confirm
// ============================================================================

/** Publish a verified claim's draft as the firm's profile. */
async function publishDraft(ctx: MutationCtx, claim: Doc<"firmClaims">, verifiedBy: "domain" | "admin"): Promise<void> {
  const now = Date.now();
  const d = claim.draft;
  const siteOk = d.website ? websiteMatchesDomain(d.website, claim.domain) : false;
  const existing = await ctx.db
    .query("firmProfiles")
    .withIndex("by_slug", (q) => q.eq("slug", claim.slug))
    .unique();
  const fields = {
    description: d.description,
    languages: d.languages,
    offices: d.offices,
    focus: d.focus,
    verifiedBy,
    updatedAt: now,
    ...(d.website
      ? siteOk || d.website === existing?.website
        ? { website: d.website, pendingWebsite: undefined }
        : { pendingWebsite: d.website }
      : { website: undefined, pendingWebsite: undefined }),
  };
  if (existing) {
    // A profile the admin hid stays hidden whoever verifies next.
    const unhide = existing.hiddenBy === "admin" ? {} : { hidden: undefined, hiddenBy: undefined };
    await ctx.db.patch(existing._id, { ...fields, ...unhide });
  } else {
    await ctx.db.insert("firmProfiles", { slug: claim.slug, ...fields, languages: d.languages, offices: d.offices, focus: d.focus, publishedAt: now });
  }
  await ctx.scheduler.runAfter(0, internal.firmClaims.revalidateFirmPage, { slug: claim.slug });
}

export const confirmByToken = internalMutation({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      published: v.array(v.object({ slug: v.string(), firmName: v.string() })),
      review: v.array(v.string()),
      already: v.array(v.string()),
      editToken: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const now = Date.now();
    const email = await verifyExpiringToken(args.token, secret(), "firm-confirm", now);
    if (!email) return null;
    const claims = await ctx.db
      .query("firmClaims")
      .withIndex("by_email", (q) => q.eq("email", email))
      .take(MAX_CLAIMS_PER_ADDRESS + 1);
    const published: { slug: string; firmName: string }[] = [];
    const review: string[] = [];
    const already: string[] = [];
    for (const c of claims) {
      if (c.status === "verified") {
        already.push(c.firmName);
        continue;
      }
      if (c.status === "pending_review") {
        review.push(c.firmName);
        continue;
      }
      if (c.status !== "pending_email") continue;
      if (c.domainReason === undefined) {
        await ctx.db.patch(c._id, { status: "verified", verifiedBy: "domain", confirmedAt: now });
        await publishDraft(ctx, { ...c, status: "verified" }, "domain");
        published.push({ slug: c.slug, firmName: c.firmName });
      } else {
        await ctx.db.patch(c._id, { status: "pending_review", confirmedAt: now });
        await ctx.scheduler.runAfter(0, internal.firmClaims.notifyAdminOfReview, { claimId: c._id });
        review.push(c.firmName);
      }
    }
    if (published.length === 0 && review.length === 0 && already.length === 0) return null;
    const canEdit = published.length > 0 || already.length > 0;
    return {
      published,
      review,
      already,
      ...(canEdit ? { editToken: await makeExpiringToken(email, secret(), "firm-edit", now + EDIT_VALID_MS) } : {}),
    };
  },
});

export const notifyAdminOfReview = internalAction({
  args: { claimId: v.id("firmClaims") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const to = getAdminEmail();
    if (!to) return null;
    try {
      const c = await ctx.runQuery(internal.firmClaims.getClaim, { claimId: args.claimId });
      if (!c) return null;
      await sendOrQueue(
        ctx,
        "firm-claim-review",
        getResend(),
        {
          from: FROM_EMAIL,
          to,
          subject: `A firm-page claim needs a look: ${c.firmName}`,
          text: [
            `A claim on ${c.firmName}'s page was confirmed by email, and DOL's files don't tie the address's domain to the firm.`,
            "",
            `Approve or reject it on the admin page: ${SITE_URL}/admin#firm-claims`,
          ].join("\n"),
        },
        { priority: "high" },
      );
    } catch (error) {
      await recordError(ctx, "action", "firmClaims.notifyAdminOfReview", error);
    }
    return null;
  },
});

// ============================================================================
// Edit
// ============================================================================

/** The verified claims and profiles for an address the HTTP route already verified. */
export const editStateFor = internalQuery({
  args: { email: v.string() },
  returns: v.array(
    v.object({
      slug: v.string(),
      firmName: v.string(),
      domain: v.string(),
      profile: v.union(profileOut, v.null()),
      hidden: v.boolean(),
      hiddenBy: v.optional(v.string()),
      pendingWebsite: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const claims = await ctx.db
      .query("firmClaims")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .take(MAX_CLAIMS_PER_ADDRESS + 1);
    const out = [];
    for (const c of claims) {
      if (c.status !== "verified") continue;
      const p = await ctx.db
        .query("firmProfiles")
        .withIndex("by_slug", (q) => q.eq("slug", c.slug))
        .unique();
      out.push({
        slug: c.slug,
        firmName: c.firmName,
        domain: c.domain,
        profile: p
          ? { website: p.website, description: p.description, languages: p.languages, offices: p.offices, focus: p.focus }
          : null,
        hidden: p?.hidden === true,
        hiddenBy: p?.hiddenBy,
        pendingWebsite: p?.pendingWebsite,
      });
    }
    return out;
  },
});

export const saveProfile = internalMutation({
  args: {
    email: v.string(),
    slug: v.string(),
    profile: profileInput,
    action: v.optional(v.union(v.literal("save"), v.literal("hide"), v.literal("show"))),
  },
  returns: v.object({ ok: v.boolean(), message: v.string(), errors: v.optional(v.record(v.string(), v.string())) }),
  handler: async (ctx, args) => {
    const claim = await ctx.db
      .query("firmClaims")
      .withIndex("by_email_slug", (q) => q.eq("email", args.email).eq("slug", args.slug))
      .first();
    if (!claim || claim.status !== "verified") {
      return { ok: false, message: "This address has no confirmed claim on that firm any more." };
    }
    const existing = await ctx.db
      .query("firmProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    const now = Date.now();
    if (args.action === "hide" || args.action === "show") {
      if (!existing) return { ok: false, message: "There's no profile to change yet." };
      if (existing.hiddenBy === "admin") {
        return { ok: false, message: "We've taken this profile down. Reply to the email we sent if you think that's wrong." };
      }
      await ctx.db.patch(existing._id, args.action === "hide" ? { hidden: true, hiddenBy: "firm", updatedAt: now } : { hidden: undefined, hiddenBy: undefined, updatedAt: now });
      await ctx.scheduler.runAfter(0, internal.firmClaims.revalidateFirmPage, { slug: args.slug });
      return { ok: true, message: args.action === "hide" ? "The profile is down. Nothing from the firm shows on the page." : "The profile is back up." };
    }
    const checked = checkProfile(args.profile);
    if (!checked.ok) return { ok: false, message: "Some of the details need a fix.", errors: checked.errors as Record<string, string> };
    await ctx.db.patch(claim._id, { draft: checked.profile });
    await publishDraft(ctx, { ...claim, draft: checked.profile }, claim.verifiedBy ?? "domain");
    const saved = await ctx.db
      .query("firmProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    return {
      ok: true,
      message: saved?.pendingWebsite
        ? "Saved. The website isn't on the domain you confirmed with, so it shows once we've checked it."
        : saved?.hidden
          ? "Saved. The profile is down, so nothing shows until it's back up."
          : "Saved. The firm's page shows the change within a few minutes.",
    };
  },
});

/** Internal: the HTTP route's "send me an edit link". The reply never says whether a claim exists. */
export const requestEditLink = internalMutation({
  args: {
    email: v.string(),
    slug: v.string(),
    ip: v.optional(v.string()),
    editLink: v.optional(v.boolean()),
    fromQueue: v.optional(v.boolean()),
  },
  returns: replyValidator,
  handler: async (ctx, args) => {
    const email = normalEmail(args.email);
    if (!email) return { ok: false, message: "That email address doesn't look right." };
    if (!FIRM_SLUG_RE.test(args.slug)) return { ok: false, message: "We don't know that firm." };
    const ip = args.ip?.trim();
    if (ip && ip !== "unknown" && !args.fromQueue) {
      const perIp = await checkAndRecordRateLimit(ctx, ip, "firm_claim_ip", CLAIM_IP_LIMIT);
      if (!perIp.allowed) return { ok: false, message: connectionThrottleReply(perIp.resetInMs), throttled: true };
    }
    const claim = await ctx.db
      .query("firmClaims")
      .withIndex("by_email_slug", (q) => q.eq("email", email).eq("slug", args.slug))
      .first();
    // The budget is charged only for a real claim, so a stranger typing
    // addresses can't spend the pool, and the reply is the same either way.
    if (!claim || claim.status !== "verified") return { ok: true, message: EDIT_LINK_REPLY };
    const now = Date.now();
    if (!args.fromQueue && claim.lastEditLinkSentAt && now - claim.lastEditLinkSentAt < CONFIRMATION_COOLDOWN_MS) {
      return { ok: true, message: EDIT_LINK_REPLY };
    }
    if (!args.fromQueue) {
      const budget = await admitConfirmation(ctx, "firmClaim");
      if (!budget.allowed) {
        return queueConfirmation(ctx, {
          kind: "firm",
          pool: "firmClaim",
          email,
          args: { ...replayArgs(args), editLink: true },
          resetInMs: budget.resetInMs,
        });
      }
    }
    await ctx.db.patch(claim._id, { lastEditLinkSentAt: now });
    await ctx.scheduler.runAfter(0, internal.firmClaims.sendEditLink, { claimId: claim._id, kind: "edit" });
    return { ok: true, message: EDIT_LINK_REPLY };
  },
});

export const sendEditLink = internalAction({
  args: { claimId: v.id("firmClaims"), kind: v.union(v.literal("edit"), v.literal("approved")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const c = await ctx.runQuery(internal.firmClaims.getClaim, { claimId: args.claimId });
      if (!c || c.status !== "verified") return null;
      const token = await makeExpiringToken(c.email, secret(), "firm-edit", Date.now() + EDIT_VALID_MS);
      const ok = await sendFirmEmail(ctx, {
        kind: args.kind,
        email: c.email,
        firmName: c.firmName,
        url: actionUrl("/firm-claim/edit", token),
        validFor: "2 days",
      });
      if (!ok && args.kind === "edit") await ctx.runMutation(internal.firmClaims.clearCooldown, { claimId: args.claimId, which: "edit" });
    } catch (error) {
      await recordError(ctx, "action", "firmClaims.sendEditLink", error);
    }
    return null;
  },
});

// ============================================================================
// The public read
// ============================================================================

/** What the firm page shows, or null: nothing unless a verified, visible profile has something in it. */
export const publishedProfile = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      website: v.optional(v.string()),
      description: v.optional(v.string()),
      languages: v.array(v.string()),
      offices: v.array(v.object({ city: v.string(), state: v.string() })),
      focus: v.array(v.string()),
      verifiedBy: v.union(v.literal("domain"), v.literal("admin")),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    if (!FIRM_SLUG_RE.test(args.slug)) return null;
    const p = await ctx.db
      .query("firmProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!p || p.hidden) return null;
    const live = await ctx.db
      .query("firmClaims")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .take(50);
    if (!live.some((c) => c.status === "verified")) return null;
    const profile: FirmProfile = {
      website: p.website,
      description: p.description,
      languages: p.languages,
      offices: p.offices,
      focus: p.focus as FirmProfile["focus"],
    };
    if (!hasContent(profile)) return null;
    return { ...profile, verifiedBy: p.verifiedBy, updatedAt: p.updatedAt };
  },
});

// ============================================================================
// The page refresh
// ============================================================================

/**
 * Refresh the firm's page now rather than at the end of its 30-day window.
 * Needs REVALIDATE_SECRET on the deployment; without it the profile shows when
 * the page next regenerates, and a warning says so.
 */
export const revalidateFirmPage = internalAction({
  args: { slug: v.string() },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const key = process.env.REVALIDATE_SECRET;
    if (!key) {
      log.warn("REVALIDATE_SECRET isn't set; the firm page shows the change when it next regenerates", { slug: args.slug });
      return null;
    }
    try {
      const res = await fetch(`${SITE_URL}/api/revalidate-firm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-revalidate-secret": key },
        body: JSON.stringify({ slug: args.slug }),
      });
      if (!res.ok) log.warn("firm page refresh refused", { slug: args.slug, status: res.status });
    } catch (error) {
      log.warn("firm page refresh failed", { slug: args.slug, error: error instanceof Error ? error.message : String(error) });
    }
    return null;
  },
});

// ============================================================================
// Admin
// ============================================================================

const adminClaim = v.object({
  _id: v.id("firmClaims"),
  slug: v.string(),
  firmName: v.string(),
  email: v.string(),
  domain: v.string(),
  role: v.string(),
  status: v.string(),
  verifiedBy: v.optional(v.string()),
  domainFilings: v.number(),
  domainReason: v.optional(v.string()),
  draft: profileOut,
  createdAt: v.number(),
  confirmedAt: v.optional(v.number()),
  reviewedAt: v.optional(v.number()),
  revokedAt: v.optional(v.number()),
  profileHidden: v.optional(v.boolean()),
  profileHiddenBy: v.optional(v.string()),
  pendingWebsite: v.optional(v.string()),
});

/** Every claim the admin needs to see, newest first, by group. SECURITY: requireAdmin; rows carry addresses. */
export const listForAdmin = query({
  args: {},
  returns: v.object({ review: v.array(adminClaim), verified: v.array(adminClaim), other: v.array(adminClaim) }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const read = async (status: Doc<"firmClaims">["status"]) =>
      ctx.db
        .query("firmClaims")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(ADMIN_READ);
    const shape = async (c: Doc<"firmClaims">) => {
      const p = await ctx.db
        .query("firmProfiles")
        .withIndex("by_slug", (q) => q.eq("slug", c.slug))
        .unique();
      return {
        _id: c._id,
        slug: c.slug,
        firmName: c.firmName,
        email: c.email,
        domain: c.domain,
        role: c.role,
        status: c.status,
        verifiedBy: c.verifiedBy,
        domainFilings: c.domainFilings,
        domainReason: c.domainReason,
        draft: c.draft,
        createdAt: c.createdAt,
        confirmedAt: c.confirmedAt,
        reviewedAt: c.reviewedAt,
        revokedAt: c.revokedAt,
        profileHidden: p?.hidden,
        profileHiddenBy: p?.hiddenBy,
        pendingWebsite: p?.pendingWebsite,
      };
    };
    const [review, verified, pending, rejected, revoked] = await Promise.all([
      read("pending_review"),
      read("verified"),
      read("pending_email"),
      read("rejected"),
      read("revoked"),
    ]);
    return {
      review: await Promise.all(review.map(shape)),
      verified: await Promise.all(verified.map(shape)),
      other: await Promise.all([...pending, ...rejected, ...revoked].sort((a, b) => b.createdAt - a.createdAt).map(shape)),
    };
  },
});

export const approveClaim = mutation({
  args: { claimId: v.id("firmClaims") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const c = await ctx.db.get(args.claimId);
    if (!c || c.status !== "pending_review") throw new Error("Only a claim waiting for review can be approved.");
    const now = Date.now();
    await ctx.db.patch(c._id, { status: "verified", verifiedBy: "admin", reviewedAt: now });
    await publishDraft(ctx, { ...c, status: "verified" }, "admin");
    await ctx.scheduler.runAfter(0, internal.firmClaims.sendEditLink, { claimId: c._id, kind: "approved" });
    return null;
  },
});

export const rejectClaim = mutation({
  args: { claimId: v.id("firmClaims") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const c = await ctx.db.get(args.claimId);
    if (!c || (c.status !== "pending_review" && c.status !== "pending_email")) {
      throw new Error("Only an unconfirmed or waiting claim can be rejected.");
    }
    await ctx.db.patch(c._id, { status: "rejected", reviewedAt: Date.now() });
    return null;
  },
});

/** Revoke a verified claim. The profile comes down when no verified claim on the firm is left. */
export const revokeClaim = mutation({
  args: { claimId: v.id("firmClaims") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const c = await ctx.db.get(args.claimId);
    if (!c || c.status !== "verified") throw new Error("Only a verified claim can be revoked.");
    const now = Date.now();
    await ctx.db.patch(c._id, { status: "revoked", revokedAt: now });
    const others = await ctx.db
      .query("firmClaims")
      .withIndex("by_slug", (q) => q.eq("slug", c.slug))
      .take(50);
    if (!others.some((o) => o._id !== c._id && o.status === "verified")) {
      const p = await ctx.db
        .query("firmProfiles")
        .withIndex("by_slug", (q) => q.eq("slug", c.slug))
        .unique();
      if (p && p.hiddenBy !== "admin") await ctx.db.patch(p._id, { hidden: true, hiddenBy: "revoked", updatedAt: now });
    }
    await ctx.scheduler.runAfter(0, internal.firmClaims.revalidateFirmPage, { slug: c.slug });
    return null;
  },
});

/** Hide or show a firm's profile whatever its claims say. */
export const setProfileHidden = mutation({
  args: { slug: v.string(), hidden: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const p = await ctx.db
      .query("firmProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!p) throw new Error("That firm has no profile.");
    await ctx.db.patch(
      p._id,
      args.hidden ? { hidden: true, hiddenBy: "admin", updatedAt: Date.now() } : { hidden: undefined, hiddenBy: undefined, updatedAt: Date.now() },
    );
    await ctx.scheduler.runAfter(0, internal.firmClaims.revalidateFirmPage, { slug: args.slug });
    return null;
  },
});

/** Let a website on another domain than the verified address's through. */
export const approveWebsite = mutation({
  args: { slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const p = await ctx.db
      .query("firmProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!p?.pendingWebsite) throw new Error("That firm has no website waiting.");
    await ctx.db.patch(p._id, { website: p.pendingWebsite, pendingWebsite: undefined, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.firmClaims.revalidateFirmPage, { slug: args.slug });
    return null;
  },
});

/** The claim check, for the HTTP route: our records, then the rule. */
export async function verdictFor(slug: string, email: string): Promise<{ verified: boolean; filings: number; reason?: string }> {
  const domain = emailDomain(email);
  if (!domain) return { verified: false, filings: 0, reason: "not_listed" };
  const v = claimVerdict(domain, slug, await domainRowsFor(domain));
  return v.verified ? { verified: true, filings: v.filings } : { verified: false, filings: v.filings, reason: v.reason };
}

export type { ProfileField };
